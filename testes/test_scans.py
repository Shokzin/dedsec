"""
TC-05 a TC-11 — Pipeline de Scan e Funcionalidades
"""
import httpx
import pytest
import time
import os
from conftest import wait_for_scan

BASE_URL = os.getenv("DEDSEC_API_URL", "http://localhost:8000")

REPO_WEBGOAT  = "https://github.com/WebGoat/WebGoat"
REPO_DEDSEC   = "https://github.com/Shokzin/dedsec"
REPO_FIXTURES = "https://github.com/Shokzin/tests"


# ─── TC-05: Submissão de scan — URL válida ────────────────────────────────────
def test_tc05_submissao_url_valida(base_url, auth_headers):
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_WEBGOAT},
        headers=auth_headers,
        timeout=15,
    )
    assert resp.status_code == 202, f"Esperado 202, obtido {resp.status_code}: {resp.text}"

    data = resp.json()
    assert "scan_id" in data, "Campo 'scan_id' ausente na resposta"
    assert data.get("status") == "queued", f"Status inicial esperado 'queued', obtido: {data.get('status')}"


# ─── TC-06: Submissão com URL inválida ───────────────────────────────────────
def test_tc06_url_invalida(base_url, auth_headers):
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": "nao-e-uma-url-valida"},
        headers=auth_headers,
        timeout=10,
    )
    assert resp.status_code == 422, (
        f"Esperado 422 para URL inválida, obtido {resp.status_code}. "
        f"(Se retornou 500, DEF-001 ainda não foi corrigido.)"
    )


@pytest.mark.parametrize("bad_url", [
    "",
    "http://",
    "ftp://github.com/repo",
    "github.com/sem-schema",
])
def test_tc06_urls_invalidas_multiplas(base_url, auth_headers, bad_url):
    """Variações de URL inválida — partição de equivalência."""
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": bad_url},
        headers=auth_headers,
        timeout=10,
    )
    assert resp.status_code == 422, f"URL '{bad_url}' deveria retornar 422, obtido {resp.status_code}"


# ─── TC-07: Polling de status durante scan ────────────────────────────────────
def test_tc07_polling_estados(base_url, auth_headers):
    # Cria um scan novo para observar as transições
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_DEDSEC},
        headers=auth_headers,
        timeout=15,
    )
    assert resp.status_code == 202
    scan_id = resp.json()["scan_id"]

    estados_observados = set()
    deadline = time.time() + 90
    while time.time() < deadline:
        poll = httpx.get(
            f"{base_url}/api/v1/scans/{scan_id}",
            headers=auth_headers,
            timeout=10,
        )
        assert poll.status_code == 200
        status = poll.json().get("status")
        estados_observados.add(status)
        if status in ("completed", "failed"):
            break
        time.sleep(2)

    # Deve ter passado por pelo menos 'running' ou 'completed'
    assert estados_observados & {"running", "completed"}, (
        f"Estados observados: {estados_observados}. Esperado ao menos 'running' ou 'completed'."
    )
    assert "completed" in estados_observados or "failed" in estados_observados, (
        "Scan não concluiu dentro do tempo esperado."
    )


# ─── TC-08: Resultado completo — repositório DedSec ──────────────────────────
def test_tc08_resultado_dedsec(base_url, auth_headers):
    inicio = time.time()
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_DEDSEC},
        headers=auth_headers,
        timeout=15,
    )
    assert resp.status_code == 202
    scan_id = resp.json()["scan_id"]

    result = wait_for_scan(base_url, scan_id, auth_headers, timeout=60)
    duracao = time.time() - inicio

    assert result["status"] == "completed", f"Scan terminou com status: {result['status']}"
    assert "score" in result, "Campo 'score' ausente no resultado"
    assert 0 <= result["score"] <= 100, f"Score fora do intervalo [0,100]: {result['score']}"
    assert "vulnerabilities" in result, "Campo 'vulnerabilities' ausente"
    assert isinstance(result["vulnerabilities"], list)
    assert duracao < 60, f"Scan demorou mais que 60s: {duracao:.1f}s"


# ─── TC-09: Detecção de credencial hardcoded ─────────────────────────────────
def test_tc09_credencial_hardcoded(base_url, auth_headers):
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_FIXTURES},
        headers=auth_headers,
        timeout=15,
    )
    assert resp.status_code == 202
    scan_id = resp.json()["scan_id"]

    result = wait_for_scan(base_url, scan_id, auth_headers, timeout=60)
    assert result["status"] == "completed"

    vulns = result.get("vulnerabilities", [])
    tipos = [v.get("type", "").lower() for v in vulns]
    assert any("hardcoded" in t or "credential" in t for t in tipos), (
        f"Nenhuma vulnerabilidade de credencial hardcoded detectada. Tipos encontrados: {tipos}"
    )

    criticas = [v for v in vulns if v.get("severity", "").upper() == "CRITICAL"]
    assert len(criticas) > 0, "Nenhuma vulnerabilidade CRITICAL detectada para credencial hardcoded"


# ─── TC-10: Scan do WebGoat ───────────────────────────────────────────────────
def test_tc10_webgoat_score_baixo(base_url, auth_headers):
    resp = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_WEBGOAT},
        headers=auth_headers,
        timeout=15,
    )
    assert resp.status_code == 202
    scan_id = resp.json()["scan_id"]

    result = wait_for_scan(base_url, scan_id, auth_headers, timeout=120)
    assert result["status"] == "completed"

    score = result.get("score", 100)
    vulns = result.get("vulnerabilities", [])

    assert score < 50, f"Score do WebGoat deveria ser < 50, obtido: {score}"
    assert len(vulns) > 10, f"Esperado > 10 vulnerabilidades, encontradas: {len(vulns)}"


# ─── TC-11: Isolamento de dados entre usuários ────────────────────────────────
def test_tc11_isolamento_usuario(base_url, auth_headers, auth_headers_b):
    # Cria um scan como user_B
    resp_b = httpx.post(
        f"{base_url}/api/v1/scans",
        json={"repo_url": REPO_DEDSEC},
        headers=auth_headers_b,
        timeout=15,
    )
    assert resp_b.status_code == 202
    scan_id_b = resp_b.json()["scan_id"]

    # Autentica como user_A e lista scans
    lista_a = httpx.get(
        f"{base_url}/api/v1/scans",
        headers=auth_headers,
        timeout=10,
    )
    assert lista_a.status_code == 200

    ids_a = [s["scan_id"] for s in lista_a.json()]
    assert scan_id_b not in ids_a, (
        f"Scan do user_B ({scan_id_b}) apareceu na listagem do user_A — falha de isolamento!"
    )
