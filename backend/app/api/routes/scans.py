from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from typing import Optional
import base64
import json
import uuid
from datetime import datetime, timezone
from app.models.scan import ScanCreateRequest, ScanReport, ScanListItem, ScanStatus
from app.core.supabase import get_supabase
from supabase import Client

router = APIRouter(prefix="/scans", tags=["scans"])


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        # JWT = header.payload.signature — we just need the payload
        payload_b64 = token.split(".")[1]
        # Pad base64 string to valid length
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    request: ScanCreateRequest,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    from worker.tasks import run_scan_task

    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": scan_id,
        "user_id": user_id,          # ← real user now
        "repo_url": request.repo_url,
        "status": ScanStatus.QUEUED.value,
        "created_at": now,
    }

    db.table("scans").insert(record).execute()
    run_scan_task.delay(scan_id, request.repo_url)
    return {"scan_id": scan_id, "status": ScanStatus.QUEUED.value}


@router.get("", response_model=list[ScanListItem])
async def list_scans(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> list[ScanListItem]:
    response = (
        db.table("scans")
        .select("id, repo_url, status, security_score, total_vulnerabilities, created_at")
        .eq("user_id", user_id)      # ← filter by real user
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [
        ScanListItem(
            scan_id=row["id"],
            repo_url=row["repo_url"],
            status=row["status"],
            score=row.get("security_score"),
            total_vulnerabilities=row.get("total_vulnerabilities", 0),
            created_at=row["created_at"],
        )
        for row in (response.data or [])
    ]


@router.get("/{scan_id}", response_model=ScanReport)
async def get_scan(
    scan_id: str,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> ScanReport:
    response = (
        db.table("scans")
        .select("*, vulnerabilities(*)")
        .eq("id", scan_id)
        .eq("user_id", user_id)      # ← can't access other users' scans
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    row = response.data
    from app.models.scan import VulnerabilityItem, SeverityLevel
    vulns = [
        VulnerabilityItem(
            id=v["id"], type=v["type"], title=v["title"],
            description=v["description"], severity=SeverityLevel(v["severity"]),
            file_path=v["file_path"], line_start=v["line_start"],
            line_end=v["line_end"], code_snippet=v["code_snippet"],
            recommendation=v["recommendation"],
            cwe_id=v.get("cwe_id"), owasp_category=v.get("owasp_category"),
        )
        for v in (row.get("vulnerabilities") or [])
    ]

    return ScanReport(
        scan_id=row["id"], repo_url=row["repo_url"],
        status=ScanStatus(row["status"]),
        score=row.get("security_score"),
        total_vulnerabilities=row.get("total_vulnerabilities", 0),
        critical_count=row.get("critical_count", 0),
        high_count=row.get("high_count", 0),
        medium_count=row.get("medium_count", 0),
        low_count=row.get("low_count", 0),
        vulnerabilities=vulns,
        scanned_files=row.get("scanned_files", 0),
        scan_duration_seconds=row.get("scan_duration_seconds"),
        created_at=row["created_at"],
        completed_at=row.get("completed_at"),
        error_message=row.get("error_message"),
    )