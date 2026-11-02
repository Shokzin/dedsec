"""
security.py — validacao de credenciais.

IMPORTANTE: o token precisa ser validado AQUI. A API e alcancada diretamente
pelo navegador, entao nada verificou a assinatura antes de a requisicao chegar.
Ler as claims sem conferir a assinatura (get_unverified_claims, ou um
base64 do payload) permite que qualquer pessoa forje o campo "sub" e passe
por outro usuario. Como as rotas usam a chave service_role, que ignora as
politicas de seguranca em nivel de linha do banco, essa confianca indevida
daria acesso total aos dados alheios.

Quem confere a assinatura e a validade e o proprio Supabase, em
auth.get_user(token).
"""
import threading
import time
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from app.core.supabase import get_supabase
import structlog

logger = structlog.get_logger()
bearer_scheme = HTTPBearer()

# Cada validacao e uma ida ao Supabase. Para nao repetir a chamada a cada
# requisicao de uma mesma sessao, o resultado fica em memoria por um intervalo
# curto. O prazo e deliberadamente pequeno: e o atraso maximo entre o encerramento
# de uma sessao e a API deixar de aceitar aquele token.
_TTL_SEGUNDOS = 30
_LIMITE_ENTRADAS = 1000
_cache: dict[str, tuple[str, str | None, float]] = {}
_trava = threading.Lock()


def _do_cache(token: str) -> tuple[str, str | None] | None:
    agora = time.monotonic()
    with _trava:
        item = _cache.get(token)
        if item and item[2] > agora:
            return item[0], item[1]
        if item:
            _cache.pop(token, None)
    return None


def _guarda(token: str, user_id: str, email: str | None) -> None:
    with _trava:
        if len(_cache) >= _LIMITE_ENTRADAS:
            _cache.clear()
        _cache[token] = (user_id, email, time.monotonic() + _TTL_SEGUNDOS)


def _nao_autorizado(detalhe: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detalhe,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _validar(token: str, db: Client) -> tuple[str, str | None]:
    em_cache = _do_cache(token)
    if em_cache:
        return em_cache

    try:
        resposta = db.auth.get_user(token)
    except Exception as erro:
        # Token invalido, expirado ou Supabase indisponivel. Em qualquer dos
        # casos a requisicao nao pode prosseguir como autenticada.
        logger.warning("auth_failure", error=str(erro))
        raise _nao_autorizado()

    usuario = getattr(resposta, "user", None)
    if not usuario or not getattr(usuario, "id", None):
        raise _nao_autorizado("Invalid or expired token")

    _guarda(token, usuario.id, getattr(usuario, "email", None))
    return usuario.id, getattr(usuario, "email", None)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Client = Depends(get_supabase),
) -> dict:
    """Usuario autenticado, com o token ja verificado pelo Supabase."""
    token = credentials.credentials
    user_id, email = _validar(token, db)
    return {"id": user_id, "email": email, "token": token}


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Client = Depends(get_supabase),
) -> str:
    """Apenas o identificador do usuario autenticado."""
    token = credentials.credentials
    user_id, _ = _validar(token, db)
    return user_id


def limpar_cache_de_sessao() -> None:
    """Usado pelos testes e apos encerrar uma conta."""
    with _trava:
        _cache.clear()
