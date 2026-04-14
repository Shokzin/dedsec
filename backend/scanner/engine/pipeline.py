import os
import shutil
import tempfile
from dataclasses import dataclass, field
from typing import Callable
from scanner.engine.git_fetcher import GitFetcher
from scanner.engine.pattern_scanner import PatternScanner
from scanner.engine.ast_analyzer import ASTAnalyzer
from scanner.engine.ai_analyzer import AIAnalyzer
from scanner.engine.scorer import SecurityScorer
import structlog

logger = structlog.get_logger()


@dataclass
class PipelineResult:
    vulnerabilities: list = field(default_factory=list)
    security_score: int = 100
    total_vulnerabilities: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    scanned_files: int = 0


class ScanPipeline:
    def __init__(self, scan_id: str, repo_url: str, progress_callback: Callable | None = None):
        self.scan_id = scan_id
        self.repo_url = repo_url
        self.progress = progress_callback or (lambda msg, pct, partial=0: None)

    def run(self) -> PipelineResult:
        tmp_dir = tempfile.mkdtemp(prefix=f"dedsec_{self.scan_id}_")
        try:
            return self._execute(tmp_dir)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def _execute(self, tmp_dir: str) -> PipelineResult:
        all_vulns = []

        self.progress("Cloning repository...", 10)
        fetcher = GitFetcher(tmp_dir)
        repo_path, file_list = fetcher.clone(self.repo_url)
        self.progress(f"Cloned {len(file_list)} files", 20)

        self.progress("Scanning for secrets and credentials...", 30)
        pattern_findings = PatternScanner().scan(repo_path, file_list)
        all_vulns.extend(pattern_findings)
        self.progress(f"Pattern scan done — {len(pattern_findings)} findings", 45, len(all_vulns))

        self.progress("Analyzing code structure...", 50)
        ast_findings = ASTAnalyzer().analyze(repo_path, file_list)
        all_vulns.extend(ast_findings)
        self.progress(f"AST analysis done — {len(ast_findings)} findings", 65, len(all_vulns))

        self.progress("Running AI-enhanced deep analysis...", 70)
        ai_findings = AIAnalyzer().analyze(repo_path, file_list)
        all_vulns.extend(ai_findings)
        self.progress(f"AI analysis done — {len(ai_findings)} findings", 90, len(all_vulns))

        self.progress("Calculating security score...", 95)
        unique_vulns = self._deduplicate(all_vulns)
        score = SecurityScorer().calculate(unique_vulns)

        result = PipelineResult(
            vulnerabilities=unique_vulns,
            security_score=score,
            total_vulnerabilities=len(unique_vulns),
            critical_count=sum(1 for v in unique_vulns if v.severity == "critical"),
            high_count=sum(1 for v in unique_vulns if v.severity == "high"),
            medium_count=sum(1 for v in unique_vulns if v.severity == "medium"),
            low_count=sum(1 for v in unique_vulns if v.severity == "low"),
            scanned_files=len(file_list),
        )
        logger.info("pipeline_complete", scan_id=self.scan_id, total=len(unique_vulns), score=score)
        return result

    def _deduplicate(self, vulns: list) -> list:
        seen = set()
        unique = []
        for v in vulns:
            key = (v.file_path, v.line_start, v.type)
            if key not in seen:
                seen.add(key)
                unique.append(v)
        return unique