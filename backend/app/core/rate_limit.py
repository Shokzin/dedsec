"""
rate_limit.py — limitacao de requisicoes.

A contagem fica no Redis, que ja faz parte da infraestrutura como intermediario
do Celery. Guardar em memoria do processo nao serviria: em producao a API roda
em mais de uma instancia, e cada uma teria o proprio contador, multiplicando o
limite pelo numero de instancias.

A janela e fixa: a chave carrega o inicio do intervalo e expira sozinha. Uma
janela deslizante seria mais precisa nas bordas, mas exige guardar o instante de
cada requisicao; para o proposito aqui, conter abuso e proteger a fila de
analises, a janela fixa basta e custa uma operacao por requisicao.

Se o Redis estiver fora do ar a requisicao passa. A alternativa seria derrubar a
API inteira junto com o Redis, o que troca um problema de abuso por um de
indisponibilidade.
"""
import time
from typing import Callable, Optional

import redis
import structlog
from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings

logger = structlog.get_logger()

_cliente: Optional[redis.Redis] = None


def _redis() -> Optional[redis.Redis]:
    global _cliente
    if _cliente is None:
        try:
            _cliente = redis.Redis.from_url(
                get_settings().redis_url,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                decode_responses=True,
            )
        except Exception as erro:
            logger.warning("rate_limit_sem_redis", error=str(erro))
            return None
    return _cliente


def _identificador(request: Request, user_id: Optional[str]) -> str:
    """Usuario autenticado quando houver; caso contrario, o endereco de origem."""
    if user_id:
        return f"u:{user_id}"
    # Atras de um proxy o endereco real vem no cabecalho. O primeiro valor e o
    # do cliente; os seguintes sao os proxies pelos quais a requisicao passou.
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return f"ip:{encaminhado.split(',')[0].strip()}"
    origem = request.client.host if request.client else "desconhecido"
    return f"ip:{origem}"


def _consumir(chave: str, limite: int, janela_s: int) -> tuple[bool, int]:
    """Retorna (permitido, segundos_para_liberar)."""
    cliente = _redis()
    if cliente is None:
        return True, 0

    agora = int(time.time())
    inicio = agora - (agora % janela_s)
    chave_completa = f"ratelimit:{chave}:{inicio}"

    try:
        cano = cliente.pipeline()
        cano.incr(chave_completa)
        cano.expire(chave_completa, janela_s)
        usado = cano.execute()[0]
    except Exception as erro:
        logger.warning("rate_limit_indisponivel", error=str(erro))
        return True, 0

    if usado > limite:
        return False, inicio + janela_s - agora
    return True, 0


def limitar(limite: int, janela_s: int, escopo: str) -> Callable:
    """
    Dependencia de rota. Exemplo:

        @router.post("", dependencies=[Depends(limitar(5, 60, "criar-analise"))])
    """
    async def verificar(
        request: Request,
        user_id: Optional[str] = Depends(_usuario_opcional),
    ) -> None:
        quem = _identificador(request, user_id)
        permitido, espera = _consumir(f"{escopo}:{quem}", limite, janela_s)
        if not permitido:
            logger.info("rate_limit_atingido", escopo=escopo, quem=quem)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Limite de {limite} requisicoes a cada {janela_s} segundos "
                    f"atingido. Tente de novo em {espera} segundos."
                ),
                headers={"Retry-After": str(max(espera, 1))},
            )

    return verificar


async def _usuario_opcional(request: Request) -> Optional[str]:
    """
    Identifica o usuario quando o token for valido, sem exigir autenticacao.
    Permite limitar por usuario nas rotas autenticadas e por endereco nas demais,
    sem duplicar a validacao nem transformar o limitador em porta de entrada.
    """
    cabecalho = request.headers.get("authorization", "")
    if not cabecalho.lower().startswith("bearer "):
        return None
    try:
        from app.core.supabase import get_supabase
        from app.core.security import _validar

        token = cabecalho.split(" ", 1)[1].strip()
        user_id, _ = _validar(token, get_supabase())
        return user_id
    except Exception:
        return None
