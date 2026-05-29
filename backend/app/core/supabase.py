from functools import lru_cache
from supabase import create_client, Client
from app.core.config import get_settings
import httpx

@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    # Patch only the transport to force HTTP/1.1 — keeps base_url and headers intact
    client.postgrest.session._transport = httpx.HTTPTransport(http2=False)
    return client

def get_supabase_user_client(user_jwt: str) -> Client:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(user_jwt, "")
    client.postgrest.session._transport = httpx.HTTPTransport(http2=False)
    return client

def _apply_http1(client: Client, key: str, jwt: str) -> Client:
    """Force HTTP/1.1 — Supabase drops HTTP/2 connections after a few requests."""
    client.postgrest.session = httpx.Client(
        http2=False,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {jwt}",
        }
    )
    return client