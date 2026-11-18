import time
import sys

sys.path.insert(0, "/scanner")

from worker.celery_app import celery_app
from app.core.supabase import get_supabase
from app.core.config import get_settings
from app.models.scan import ScanStatus
from scanner.engine.pipeline import ScanPipeline
import structlog

logger = structlog.get_logger()


def _update_scan(db, scan_id: str, data: dict) -> None:
    db.table("scans").update(data).eq("id", scan_id).execute()


def _broadcast_progress(db, scan_id: str, message: str, progress_pct: int, partial: int = 0) -> None:
    db.table("scan_progress").upsert({
        "scan_id": scan_id,
        "message": message,
        "progress_pct": progress_pct,
        "partial_findings": partial,
    }).execute()


@celery_app.task(name="worker.tasks.run_scan_task", bind=True)
def run_scan_task(self, scan_id: str, repo_url: str) -> dict:
    db = get_supabase()
    start_time = time.time()

    try:
        _update_scan(db, scan_id, {"status": ScanStatus.RUNNING.value})
        _broadcast_progress(db, scan_id, "Starting scan...", 5)

        pipeline = ScanPipeline(
            scan_id=scan_id,
            repo_url=repo_url,
            max_repo_size_mb=get_settings().max_repo_size_mb,
            progress_callback=lambda msg, pct, partial=0: _broadcast_progress(
                db, scan_id, msg, pct, partial
            ),
        )

        result = pipeline.run()
        duration = round(time.time() - start_time, 2)

        if result.vulnerabilities:
            vuln_rows = [
                {
                    "id": v.id,
                    "scan_id": scan_id,
                    "type": v.type,
                    "title": v.title,
                    "description": v.description,
                    "severity": v.severity,
                    "file_path": v.file_path,
                    "line_start": v.line_start,
                    "line_end": v.line_end,
                    "code_snippet": v.code_snippet,
                    "recommendation": v.recommendation,
                    "cwe_id": v.cwe_id,
                    "owasp_category": v.owasp_category,
                }
                for v in result.vulnerabilities
            ]
            db.table("vulnerabilities").insert(vuln_rows).execute()

        _update_scan(db, scan_id, {
            "status": ScanStatus.COMPLETED.value,
            "security_score": result.security_score,
            "total_vulnerabilities": result.total_vulnerabilities,
            "critical_count": result.critical_count,
            "high_count": result.high_count,
            "medium_count": result.medium_count,
            "low_count": result.low_count,
            "scanned_files": result.scanned_files,
            "scan_duration_seconds": duration,
            "completed_at": "now()",
        })

        _broadcast_progress(db, scan_id, "Scan complete", 100, result.total_vulnerabilities)
        logger.info("scan_completed", scan_id=scan_id, score=result.security_score)

        return {"scan_id": scan_id, "status": "completed"}

    except Exception as exc:
        logger.error("scan_failed", scan_id=scan_id, error=str(exc))
        _update_scan(db, scan_id, {
            "status": ScanStatus.FAILED.value,
            "error_message": str(exc)[:500],
            "completed_at": "now()",
        })
        _broadcast_progress(db, scan_id, f"Scan failed: {str(exc)[:100]}", 0)
        raise
