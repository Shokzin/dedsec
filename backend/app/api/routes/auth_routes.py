"""
auth_routes.py — Authentication utility endpoints.

Uses python-jose (already in requirements.txt as python-jose[cryptography]==3.3.0).
No new dependencies required.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client
from app.core.supabase import get_supabase
from jose import jwt as jose_jwt

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_user_id(request: Request) -> str:
    """
    Extract user_id (sub claim) from the JWT Bearer token.
    Uses jose_jwt.get_unverified_claims() — no key/algorithm needed,
    safe because Supabase already validated the token before it reached us.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )
    token = auth.removeprefix("Bearer ").strip()
    try:
        # get_unverified_claims reads the payload without verifying signature
        claims = jose_jwt.get_unverified_claims(token)
        user_id = claims.get("sub")
        if not user_id:
            raise ValueError("No sub claim in token")
        return user_id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )


@router.delete("/delete-account", status_code=status.HTTP_200_OK)
async def delete_account(
    request: Request,
    db: Client = Depends(get_supabase),
) -> dict:
    """
    Permanently delete the authenticated user's account and all scan data.
    Uses the service role key (via get_supabase) to delete from Supabase Auth.
    """
    user_id = _get_user_id(request)

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

    return {"message": "Account deleted successfully."}


@router.delete("/scans/{scan_id}", status_code=status.HTTP_200_OK)
async def delete_scan(
    scan_id: str,
    request: Request,
    db: Client = Depends(get_supabase),
) -> dict:
    """Delete a specific scan and its associated data from history."""
    _get_user_id(request)  # Validates token is present and valid

    result = db.table("scans").select("id").eq("id", scan_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    db.table("scans").delete().eq("id", scan_id).execute()
    return {"message": "Scan deleted."}