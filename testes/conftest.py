import pytest
import httpx
import os
import time
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

BASE_URL  = os.getenv("DEDSEC_API_URL")
SUP_URL   = os.getenv("SUPABASE_URL")
SUP_KEY   = os.getenv("SUPABASE_ANON_KEY")
TEST_EMAIL    = os.getenv("TEST_EMAIL")
TEST_PASSWORD = os.getenv("TEST_PASSWORD")
TEST_EMAIL_B    = os.getenv("TEST_EMAIL_B")
TEST_PASSWORD_B = os.getenv("TEST_PASSWORD_B")


def supabase_login(email, password):
    """Autentica direto no Supabase e retorna o access_token."""
    resp = httpx.post(
        f"{SUP_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": SUP_KEY, "Content-Type": "application/json"},
        timeout=15,
    )
    return resp


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL

@pytest.fixture(scope="session")
def supabase_url():
    return SUP_URL

@pytest.fixture(scope="session")
def supabase_key():
    return SUP_KEY

@pytest.fixture(scope="session")
def auth_token():
    resp = supabase_login(TEST_EMAIL, TEST_PASSWORD)
    assert resp.status_code == 200, f"Login Supabase falhou: {resp.text}"
    return resp.json()["access_token"]

@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture(scope="session")
def auth_token_b():
    resp = supabase_login(TEST_EMAIL_B, TEST_PASSWORD_B)
    assert resp.status_code == 200, f"Login user_B falhou: {resp.text}"
    return resp.json()["access_token"]

@pytest.fixture(scope="session")
def auth_headers_b(auth_token_b):
    return {"Authorization": f"Bearer {auth_token_b}"}


def wait_for_scan(base_url, scan_id, headers, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = httpx.get(
            f"{base_url}/api/v1/scans/{scan_id}",
            headers=headers, timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        if data.get("status") in ("completed", "failed"):
            return data
        time.sleep(2)
    pytest.fail(f"Scan {scan_id} não concluiu em {timeout}s")