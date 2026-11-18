from functools import lru_cache

import httpx
from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """
    Cliente com a chave service_role, que ignora as politicas de seguranca em
    nivel de linha do banco. Por isso toda consulta feita com ele precisa filtrar
    pelo usuario autenticado (veja app/api/routes).
    """
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    # Forca HTTP/1.1: o Supabase derrubava conexoes HTTP/2 depois de algumas requisicoes.
    client.postgrest.session._transport = httpx.HTTPTransport(http2=False)
    return client
