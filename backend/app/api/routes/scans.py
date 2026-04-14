from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.models.scan import ScanCreateRequest, ScanReport, ScanListItem
from app.core.supabase import get_supabase
from supabase import Client
import uuid
from datetime import datetime, timezone
from app.models.scan import ScanStatus

router = APIRouter(prefix="/scans", tags=["scans"])

TEST_USER_ID = "00000000-0000-0000-0000-000000000000"


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    request: ScanCreateRequest,
    db: Client = Depends(get_supabase),
) -> dict:
    from worker.tasks import run_scan_task

    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": scan_id,
        "user_id": TEST_USER_ID,
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
) -> list[ScanListItem]:
    response = (
        db.table("scans")
        .select("id, repo_url, status, security_score, total_vulnerabilities, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [
        ScanListItem(
            scan_id=row["id"],
            repo_url=row["repo_url"],
            status=row["status"],
            security_score=row.get("security_score"),
            total_vulnerabilities=row.get("total_vulnerabilities", 0),
            created_at=row["created_at"],
        )
        for row in (response.data or [])
    ]


@router.get("/{scan_id}", response_model=ScanReport)
async def get_scan(
    scan_id: str,
    db: Client = Depends(get_supabase),
) -> ScanReport:
    response = (
        db.table("scans")
        .select("*, vulnerabilities(*)")
        .eq("id", scan_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    row = response.data
    from app.models.scan import VulnerabilityItem, SeverityLevel
    vulns = [
        VulnerabilityItem(
            id=v["id"],
            type=v["type"],
            title=v["title"],
            description=v["description"],
            severity=SeverityLevel(v["severity"]),
            file_path=v["file_path"],
            line_start=v["line_start"],
            line_end=v["line_end"],
            code_snippet=v["code_snippet"],
            recommendation=v["recommendation"],
            cwe_id=v.get("cwe_id"),
            owasp_category=v.get("owasp_category"),
        )
        for v in (row.get("vulnerabilities") or [])
    ]

    return ScanReport(
        scan_id=row["id"],
        repo_url=row["repo_url"],
        status=ScanStatus(row["status"]),
        security_score=row.get("security_score"),
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