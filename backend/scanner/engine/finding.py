from dataclasses import dataclass


@dataclass
class Finding:
    id: str
    type: str
    title: str
    description: str
    severity: str       # "low" | "medium" | "high" | "critical"
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    recommendation: str
    cwe_id: str | None = None
    owasp_category: str | None = None