/**
 * DedSec — Teste de Carga com k6
 * TC Performance: 50 VUs por 60 segundos
 *
 * Como rodar:
 *   k6 run k6_load_test.js
 *   k6 run --env BASE_URL=http://localhost:8000 k6_load_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Configuração ─────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 25 },  // Ramp-up
    { duration: '40s', target: 50 },  // Carga constante
    { duration: '10s', target: 0  },  // Ramp-down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],          // < 1% de erros
    http_req_duration: ['p(95)<500'],          // p95 < 500ms
    'auth_duration':   ['p(95)<600'],          // Login pode ser mais lento (bcrypt)
    'health_duration': ['p(95)<200'],          // Health check deve ser muito rápido
  },
};

// ─── Métricas customizadas ────────────────────────────────────────────────────
const authDuration   = new Trend('auth_duration',   true);
const healthDuration = new Trend('health_duration', true);
const errorRate      = new Rate('error_rate');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// ─── Setup: obtém token JWT uma vez ──────────────────────────────────────────
export function setup() {
  const resp = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'test@dedsec.local', password: 'TestPass@2026' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (resp.status !== 200) {
    throw new Error(`Setup falhou — login retornou ${resp.status}: ${resp.body}`);
  }

  const token = resp.json('access_token');
  console.log('Setup concluído. Token obtido.');
  return { token };
}

// ─── Cenário principal ────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type':  'application/json',
  };

  // 1. Health check
  const health = http.get(`${BASE_URL}/api/v1/health`);
  healthDuration.add(health.timings.duration);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body ok':    (r) => r.json('status') === 'healthy',
  });
  errorRate.add(health.status !== 200);

  sleep(0.5);

  // 2. Listagem de scans
  const scans = http.get(`${BASE_URL}/api/v1/scans`, { headers });
  check(scans, {
    'scans status 200': (r) => r.status === 200,
    'scans é array':    (r) => Array.isArray(r.json()),
  });
  errorRate.add(scans.status !== 200);

  sleep(0.5);

  // 3. Login (apenas 20% das iterações para não sobrecarregar bcrypt)
  if (Math.random() < 0.2) {
    const login = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: 'test@dedsec.local', password: 'TestPass@2026' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    authDuration.add(login.timings.duration);
    check(login, {
      'login status 200':    (r) => r.status === 200,
      'login tem token':     (r) => r.json('access_token') !== undefined,
    });
    errorRate.add(login.status !== 200);
  }

  sleep(1);
}

// ─── Teardown: exibe resumo ────────────────────────────────────────────────────
export function teardown(data) {
  console.log('Teste de carga concluído.');
}
