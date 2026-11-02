from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
import uuid
from datetime import datetime, timezone
from app.models.scan import (
    ScanCreateRequest, ScanReport, ScanListItem, ScanListPage, ScanStats, ScanStatus,
)
from app.core.supabase import get_supabase
from app.core.security import get_current_user_id
from app.core.config import get_settings
from app.core.rate_limit import limitar

_lim = get_settings()
from supabase import Client

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[
        Depends(limitar(_lim.rate_limit_criar_analise_min, 60, "criar-analise-min")),
        Depends(limitar(_lim.rate_limit_criar_analise_hora, 3600, "criar-analise-hora")),
    ],
)
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


@router.get("", response_model=ScanListPage,
            dependencies=[Depends(limitar(_lim.rate_limit_leitura_min, 60, "leitura"))])
async def list_scans(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repo_url: Optional[str] = Query(default=None, description="Restringe a um repositório"),
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> ScanListPage:
    query = (
        db.table("scans")
        .select(
            "id, repo_url, status, security_score, total_vulnerabilities, created_at",
            count="exact",           # ← total de registros, para montar a navegação
        )
        .eq("user_id", user_id)      # ← filter by real user
    )
    if repo_url:
        query = query.eq("repo_url", repo_url)

    response = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    items = [
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
    return ScanListPage(
        items=items,
        total=response.count if response.count is not None else len(items),
        limit=limit,
        offset=offset,
    )


# Precisa vir antes de "/{scan_id}", senão "stats" seria lido como um identificador.
@router.get("/stats", response_model=ScanStats,
            dependencies=[Depends(limitar(_lim.rate_limit_leitura_min, 60, "leitura"))])
async def scan_stats(
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id),
) -> ScanStats:
    """Agregados de todas as análises do usuário, independentes da paginação."""
    response = (
        db.table("scans")
        .select("status, security_score, total_vulnerabilities")
        .eq("user_id", user_id)
        .execute()
    )
    rows = response.data or []
    pontuacoes = [
        r["security_score"] for r in rows
        if r.get("status") == ScanStatus.COMPLETED.value and r.get("security_score") is not None
    ]
    return ScanStats(
        total_scans=len(rows),
        completed=sum(1 for r in rows if r.get("status") == ScanStatus.COMPLETED.value),
        average_score=round(sum(pontuacoes) / len(pontuacoes)) if pontuacoes else None,
        total_vulnerabilities=sum(r.get("total_vulnerabilities") or 0 for r in rows),
    )


@router.get("/{scan_id}", response_model=ScanReport,
            dependencies=[Depends(limitar(_lim.rate_limit_leitura_min, 60, "leitura"))])
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