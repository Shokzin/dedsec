from pydantic import BaseModel, field_validator
from enum import Enum
from datetime import datetime
import re


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ScanStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanCreateRequest(BaseModel):
    repo_url: str

    @field_validator("repo_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        pattern = r"^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/?$"
        if not re.match(pattern, v.rstrip("/")):
            raise ValueError(
                "Only public GitHub repository URLs are supported "
                "(e.g. https://github.com/owner/repo)"
            )
        return v.rstrip("/")


class VulnerabilityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    severity: SeverityLevel
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    recommendation: str
    cwe_id: str | None = None
    owasp_category: str | None = None


class ScanReport(BaseModel):
    scan_id: str
    repo_url: str
    status: ScanStatus
    score: int | None = None
    total_vulnerabilities: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    vulnerabilities: list[VulnerabilityItem] = []
    scanned_files: int = 0
    scan_duration_seconds: float | None = None
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None


class ScanListItem(BaseModel):
    scan_id: str
    repo_url: str
    status: ScanStatus
    score: int | None
    total_vulnerabilities: int
    created_at: datetime
