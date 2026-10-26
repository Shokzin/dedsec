from __future__ import annotations
import re
from typing import Mapping

from scanner.engine.finding import Finding
from scanner.engine.pattern_scanner import PatternScanner, SKIP_DIRS
from scanner.engine.ast_analyzer import ASTAnalyzer

# Comentário que silencia um achado:
#   código_problemático()  # dedsec: ignore
#   # dedsec: ignore[CWE-306]   <- só silencia esse CWE (ou o "type" do achado)
_IGNORE_RE = re.compile(r"dedsec:\s*ignore(?:\[([^\]]*)\])?", re.IGNORECASE)
_COMMENT_STARTS = ("#", "//", "/*", "*", "<!--")


class LocalScanner:
    """
    Scanner leve para uso local (CLI, extensão do VS Code, hook de pre-commit).

    Roda as camadas Regex e AST sobre texto em memória. Não clona repositório,
    não usa Celery/Supabase e não chama a camada de IA, então responde em
    milissegundos e funciona offline.

        scanner = LocalScanner()
        findings = scanner.scan_content(texto_do_arquivo, "src/app.py")
        findings = scanner.scan_files({"src/a.py": "...", "src/b.js": "..."})

    Achados podem ser silenciados com um comentário `dedsec: ignore` na própria
    linha do achado ou numa linha de comentário logo acima.
    """

    def __init__(self) -> None:
        self._pattern = PatternScanner()
        self._ast = ASTAnalyzer()

    def scan_content(self, content: str, file_path: str) -> list[Finding]:
        # Aceita separador "/" (git) e "\" (Windows)
        parts = file_path.replace("\\", "/").split("/")
        if any(part in SKIP_DIRS for part in parts):
            return []

        findings = self._pattern.scan_content(content, file_path)
        findings.extend(self._ast.analyze_content(content, file_path))
        findings = self._deduplicate(findings)

        lines = content.split("\n")
        findings = [f for f in findings if not self._is_suppressed(f, lines)]
        return sorted(findings, key=lambda f: f.line_start)

    def scan_files(self, files: Mapping[str, str]) -> list[Finding]:
        """files: dicionário {caminho_relativo: conteúdo}."""
        findings: list[Finding] = []
        for file_path, content in files.items():
            findings.extend(self.scan_content(content, file_path))
        return findings

    @staticmethod
    def _is_suppressed(finding: Finding, lines: list[str]) -> bool:
        first = max(1, finding.line_start)
        last = min(len(lines), max(finding.line_end, finding.line_start))
        candidates = list(range(first, last + 1))  # linhas do achado (base 1)
        # linha de cima só vale se for um comentário puro
        if first > 1 and lines[first - 2].lstrip().startswith(_COMMENT_STARTS):
            candidates.insert(0, first - 1)

        for n in candidates:
            if n < 1 or n > len(lines):
                continue
            match = _IGNORE_RE.search(lines[n - 1])
            if not match:
                continue
            listed = (match.group(1) or "").strip()
            if not listed:
                return True  # "dedsec: ignore" sem lista: silencia tudo da linha
            wanted = {x.strip().lower() for x in listed.split(",") if x.strip()}
            if (finding.cwe_id or "").lower() in wanted or finding.type.lower() in wanted:
                return True
        return False

    @staticmethod
    def _deduplicate(findings: list[Finding]) -> list[Finding]:
        # Mesma chave usada em ScanPipeline._deduplicate
        seen = set()
        unique = []
        for f in findings:
            key = (f.file_path, f.line_start, f.title)
            if key not in seen:
                seen.add(key)
                unique.append(f)
        return unique
