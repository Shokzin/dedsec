"""
TC-12 — Health Check
Endpoint real: GET /health (sem prefixo /api/v1)
"""
import httpx
import subprocess
import time
import pytest
import os

BASE_URL = os.getenv("DEDSEC_API_URL", "http://localhost:8000")


# TC-12a: Cenário normal — todos os serviços UP
def test_tc12_health_normal(base_url):
    resp = httpx.get(f"{base_url}/health", timeout=10)
    assert resp.status_code == 200, f"Esperado 200, obtido {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data.get("status") == "ok", f"Status inesperado: {data}"


# TC-12b: Simula falha no Redis — requer Docker local
@pytest.mark.skipif(
    os.getenv("SKIP_DOCKER_STOP", "true").lower() == "true",
    reason="Pulado: SKIP_DOCKER_STOP=true"
)
def test_tc12_health_redis_down(base_url):
    container = "dedsec_redis_1"  # ajuste se o nome for diferente
    try:
        subprocess.run(["docker", "stop", container],
                       check=True, capture_output=True)
        time.sleep(3)
        resp = httpx.get(f"{base_url}/health", timeout=10)
        assert resp.status_code in (200, 503)
    finally:
        subprocess.run(["docker", "start", container], capture_output=True)
        time.sleep(3)