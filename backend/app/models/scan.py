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


# Dono: letras, numeros e hifens, ate 39 caracteres (regra do GitHub).
# Repositorio: letras, numeros, ".", "_" e "-", ate 100, nunca "." ou "..".
# fullmatch, e nao match com "$": em Python o "$" aceita uma quebra de linha
# no final do texto.
_URL_GITHUB = re.compile(
    r"https://github\.com/"
    r"[A-Za-z0-9][A-Za-z0-9-]{0,38}/"
    r"(?!\.{1,2}(?:\.git)?$)[A-Za-z0-9_.-]{1,100}"
)


class ScanCreateRequest(BaseModel):
    repo_url: str

    @field_validator("repo_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        url = v.strip().rstrip("/")
        if not _URL_GITHUB.fullmatch(url):
            raise ValueError(
                "Only public GitHub repository URLs are supported "
                "(e.g. https://github.com/owner/repo)"
            )
        return url


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


class ScanListPage(BaseModel):
    """Uma página da lista de análises, com o total para montar a navegação."""
    items: list[ScanListItem]
    total: int
    limit: int
    offset: int


class ScanStats(BaseModel):
    """Números agregados de TODAS as análises do usuário, não só da página atual."""
    total_scans: int = 0
    completed: int = 0
    average_score: int | None = None
    total_vulnerabilities: int = 0
