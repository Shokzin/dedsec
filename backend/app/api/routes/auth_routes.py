"""
auth_routes.py — endpoints de conta.

A identidade vem de app.core.security, que valida a assinatura do token no
Supabase. Ler as claims sem verificar a assinatura permitiria forjar o campo
"sub"; como estas rotas usam a chave service_role, isso daria a qualquer
pessoa o poder de apagar a conta de outra.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from app.core.supabase import get_supabase
from app.core.security import get_current_user_id, limpar_cache_de_sessao
from app.core.config import get_settings
from app.core.rate_limit import limitar

_lim = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])


@router.delete(
    "/delete-account",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(limitar(_lim.rate_limit_conta_hora, 3600, "remover-conta"))],
)
async def delete_account(
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """
    Apaga definitivamente a conta de quem chamou e todos os dados de analise.
    O identificador vem do token ja verificado, nunca do corpo da requisicao.
    """

    # Delete scan data first (cascades to vulnerabilities + scan_progress)
    try:
        db.table("scans").delete().eq("user_id", user_id).execute()
    except Exception:
        pass  # Non-fatal — proceed to delete the user anyway

    # Delete from Supabase Auth using service role
    try:
        db.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete account: {str(e)}",
        )

    limpar_cache_de_sessao()
    return {"message": "Account deleted successfully."}


@router.delete(
    "/scans/{scan_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(limitar(_lim.rate_limit_remocao_min, 60, "remover-analise"))],
)
async def delete_scan(
    scan_id: str,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """
    Apaga uma analise do historico de quem chamou.

    A consulta e a remocao filtram por user_id alem do scan_id. Sem esse filtro,
    conhecer o identificador de uma analise alheia bastaria para apaga-la, ja que
    a chave service_role ignora as politicas de seguranca do banco (IDOR).
    Uma analise de outro usuario responde 404, e nao 403, para nao revelar que
    aquele identificador existe.
    """
    result = (
        db.table("scans")
        .select("id")
        .eq("id", scan_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    db.table("scans").delete().eq("id", scan_id).eq("user_id", user_id).execute()
    return {"message": "Scan deleted."}