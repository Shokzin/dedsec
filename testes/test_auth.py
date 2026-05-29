"""
TC-01 a TC-04 — Autenticação
O DedSec não tem endpoint próprio de login: a autenticação é feita pelo Supabase.
TC-01 e TC-02 testam o Supabase Auth diretamente.
TC-03 e TC-04 testam o middleware JWT do backend DedSec.
"""
import httpx
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import supabase_login

BASE_URL  = os.getenv("DEDSEC_API_URL",    "http://localhost:8000")
TEST_EMAIL    = os.getenv("TEST_EMAIL",    "test@dedsec.local")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "TestPass@2026")


# TC-01: Login com credenciais válidas (via Supabase Auth)
def test_tc01_login_valido(supabase_url, supabase_key):
    resp = supabase_login(TEST_EMAIL, TEST_PASSWORD)
    assert resp.status_code == 200, f"Esperado 200, obtido {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "access_token" in data, "Campo 'access_token' ausente"
    assert data.get("token_type") == "bearer"
    assert len(data["access_token"]) > 20


# TC-02: Login com senha incorreta (via Supabase Auth)
def test_tc02_login_senha_errada(supabase_url, supabase_key):
    resp = supabase_login(TEST_EMAIL, "senhaErrada999")
    assert resp.status_code in (400, 401, 422), (
        f"Esperado erro de autenticação, obtido {resp.status_code}: {resp.text}"
    )
    body = resp.text.lower()
    assert "traceback" not in body
    assert "sqlalchemy" not in body


# TC-03: Requisição sem token — backend DedSec bloqueia
def test_tc03_sem_token(base_url):
    resp = httpx.get(f"{base_url}/api/v1/scans", timeout=10)
    assert resp.status_code == 401, f"Esperado 401, obtido {resp.status_code}"


# TC-04: Token completamente inválido (não é JWT) — backend deve retornar 401
def test_tc04_token_invalido(base_url):
    resp = httpx.get(
        f"{base_url}/api/v1/scans",
        headers={"Authorization": "Bearer isso.nao.e.um.jwt.valido"},
        timeout=10,
    )
    assert resp.status_code == 401, (
        f"Esperado 401 para token inválido, obtido {resp.status_code}"
    )