from __future__ import annotations
import uuid
import re
from pathlib import Path
from typing import List, Optional

from scanner.engine.finding import Finding

SCANNABLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".php", ".rb", ".java", ".go",
    ".html", ".htm", ".env",
    ".cfg", ".conf", ".ini", ".yaml", ".yml", ".json",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "env", "dist", "build", ".mypy_cache", "coverage",
}

PATTERNS = [

    # ── SECRETS & CREDENTIALS ──────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'(?:password|passwd|pwd|secret|api_key|apikey|token|auth_token|access_token)\s*'
            r'=\s*["\'][^"\']{4,}["\']',
            re.IGNORECASE,
        ),
        "title": "Hardcoded Password or Secret",
        "description": (
            "A credential or secret key is hardcoded as a string literal. "
            "This exposes the credential to anyone with access to the source code."
        ),
        "severity": "critical",
        "type": "hardcoded_credential",
        "cwe_id": "CWE-798",
        "owasp": "A02:2021 — Cryptographic Failures",
        "recommendation": "Move all secrets to environment variables. Never hardcode credentials.",
        "extensions": None,
    },
    {
        "pattern": re.compile(
            r'(?:AWS_ACCESS_KEY_ID|AWS_SECRET|GITHUB_TOKEN|SLACK_TOKEN|STRIPE_KEY)\s*=\s*["\'][A-Za-z0-9/+]{10,}["\']',
            re.IGNORECASE,
        ),
        "title": "Hardcoded Cloud or Service Credential",
        "description": "A cloud provider or third-party service credential is hardcoded.",
        "severity": "critical",
        "type": "hardcoded_credential",
        "cwe_id": "CWE-798",
        "owasp": "A02:2021 — Cryptographic Failures",
        "recommendation": "Use environment variables or a dedicated secrets manager.",
        "extensions": None,
    },
    {
        "pattern": re.compile(r'BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY', re.IGNORECASE),
        "title": "Private Key in Source Code",
        "description": "A cryptographic private key is embedded in the source file.",
        "severity": "critical",
        "type": "hardcoded_credential",
        "cwe_id": "CWE-321",
        "owasp": "A02:2021 — Cryptographic Failures",
        "recommendation": "Remove and rotate the key immediately. Store keys outside the codebase.",
        "extensions": None,
    },

    # ── SQL INJECTION ──────────────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'(?:execute|cursor\.execute|db\.execute|query)\s*\(\s*'
            r'(?:f["\']|["\'].*?\+|.*?%\s*(?:user|request|input|param|data|name|id|value))',
            re.IGNORECASE,
        ),
        "title": "SQL Injection via String Formatting",
        "description": (
            "A database query is constructed by concatenating or formatting "
            "user-controlled data into the SQL string."
        ),
        "severity": "critical",
        "type": "sql_injection",
        "cwe_id": "CWE-89",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use parameterized queries. Never format user input directly into SQL strings.",
        "extensions": {".py", ".php", ".rb", ".java"},
    },
    {
        "pattern": re.compile(
            r'["\']SELECT\s.+FROM\s.+WHERE\s.+["\'\s]*\+|f["\']SELECT\s.+FROM\s.+WHERE\s',
            re.IGNORECASE,
        ),
        "title": "SQL Injection — Raw Query Construction",
        "description": "A SELECT statement is built using string concatenation or f-string formatting.",
        "severity": "critical",
        "type": "sql_injection",
        "cwe_id": "CWE-89",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use parameterized queries: cursor.execute('SELECT ... WHERE id = %s', (id,))",
        "extensions": {".py", ".js", ".ts", ".php"},
    },
    {
        "pattern": re.compile(
            r'(?:db|connection|conn|pool)\.query\s*\(\s*'
            r'(?:`[^`]*\$\{|["\'].*?\+\s*(?:req\.|request\.|params\.|body\.|query\.))',
            re.IGNORECASE,
        ),
        "title": "SQL Injection in JavaScript Query",
        "description": "A SQL query in JavaScript is built with request data via template literals or concatenation.",
        "severity": "critical",
        "type": "sql_injection",
        "cwe_id": "CWE-89",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use parameterized queries: db.query('SELECT ... WHERE id = ?', [id])",
        "extensions": {".js", ".ts"},
    },

    # ── COMMAND INJECTION ──────────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'os\.system\s*\([^)]*(?:input|request|param|user|data|name|cmd|command|args?)',
            re.IGNORECASE,
        ),
        "title": "Command Injection via os.system()",
        "description": (
            "os.system() is called with a value that may originate from user input. "
            "Attackers can inject shell commands using metacharacters like ; | & `"
        ),
        "severity": "critical",
        "type": "command_injection",
        "cwe_id": "CWE-78",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use subprocess.run() with a list of arguments and shell=False.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'os\.system\s*\(\s*(?:f["\']|["\'][^"\']*\+)',
            re.IGNORECASE,
        ),
        "title": "Command Injection via os.system() with Dynamic String",
        "description": "os.system() is called with a dynamically constructed string.",
        "severity": "critical",
        "type": "command_injection",
        "cwe_id": "CWE-78",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Replace os.system() with subprocess.run(args_list, shell=False).",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(r'os\.popen\s*\(', re.IGNORECASE),
        "title": "Command Injection via os.popen()",
        "description": "os.popen() executes a shell command and is vulnerable to injection.",
        "severity": "high",
        "type": "command_injection",
        "cwe_id": "CWE-78",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use subprocess.run() with a list of arguments instead.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'subprocess\.(call|run|Popen|check_output)\s*\([^)]*shell\s*=\s*True',
            re.IGNORECASE,
        ),
        "title": "subprocess Called with shell=True",
        "description": (
            "Passing shell=True exposes the application to shell injection "
            "if any part of the command is user-controlled."
        ),
        "severity": "high",
        "type": "command_injection",
        "cwe_id": "CWE-78",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use shell=False and pass the command as a list.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'(?:exec|execSync|spawn|spawnSync|execFile)\s*\(\s*'
            r'(?:`[^`]*\$\{|[^)]*(?:req\.|request\.|params\.|body\.|query\.))',
            re.IGNORECASE,
        ),
        "title": "Command Injection in JavaScript",
        "description": "A child_process function is called with user-controlled data in the command string.",
        "severity": "critical",
        "type": "command_injection",
        "cwe_id": "CWE-78",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Avoid shell execution with user input. Use execFile with an argument array.",
        "extensions": {".js", ".ts"},
    },

    # ── PATH TRAVERSAL ─────────────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'\bopen\s*\(\s*(?:[^)]*(?:request\.|input\b|param|user|data|filename|file_path|path))',
            re.IGNORECASE,
        ),
        "title": "Path Traversal via open()",
        "description": (
            "A file is opened using a path that may be derived from user input. "
            "Attackers can use sequences like ../../ to access arbitrary files."
        ),
        "severity": "high",
        "type": "path_traversal",
        "cwe_id": "CWE-22",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Use os.path.realpath() and verify the path is within the expected base directory.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'(?:readFile|readFileSync|createReadStream)\s*\(\s*'
            r'(?:`[^`]*\$\{|[^)]*(?:req\.|request\.|params\.|body\.|query\.))',
            re.IGNORECASE,
        ),
        "title": "Path Traversal in JavaScript File Read",
        "description": "A file is read using a path influenced by request data.",
        "severity": "high",
        "type": "path_traversal",
        "cwe_id": "CWE-22",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Resolve paths with path.resolve() and verify they are within a safe base directory.",
        "extensions": {".js", ".ts"},
    },
    {
        "pattern": re.compile(r'\.\./|\.\.[/\\]|%2e%2e[/\\%]', re.IGNORECASE),
        "title": "Path Traversal Sequence Detected",
        "description": "A literal path traversal sequence (../) was found in the code.",
        "severity": "medium",
        "type": "path_traversal",
        "cwe_id": "CWE-22",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Do not use relative traversal sequences. Resolve and validate all paths.",
        "extensions": {".cfg", ".conf", ".ini", ".yaml", ".yml", ".json", ".env", ".php", ".rb"},
    },

    # ── XSS ───────────────────────────────────────────────────────────────────
    {
        "pattern": re.compile(r'\.innerHTML\s*=\s*(?![\'"]\s*[\'"])', re.IGNORECASE),
        "title": "Cross-Site Scripting via innerHTML",
        "description": (
            "Assigning to innerHTML with a non-static value can introduce XSS. "
            "If the value contains user-controlled content, scripts can be injected."
        ),
        "severity": "high",
        "type": "xss",
        "cwe_id": "CWE-79",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Use textContent for text. If HTML is required, sanitize with DOMPurify.",
        "extensions": {".js", ".ts", ".jsx", ".tsx", ".html", ".htm"},
    },
    {
        "pattern": re.compile(r'document\.write\s*\(', re.IGNORECASE),
        "title": "Cross-Site Scripting via document.write()",
        "description": "document.write() can inject arbitrary HTML and is a common XSS vector.",
        "severity": "high",
        "type": "xss",
        "cwe_id": "CWE-79",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Avoid document.write(). Use createElement and appendChild instead.",
        "extensions": {".js", ".ts", ".jsx", ".tsx", ".html"},
    },
    {
        "pattern": re.compile(r'\.outerHTML\s*=|\.insertAdjacentHTML\s*\(', re.IGNORECASE),
        "title": "Cross-Site Scripting via outerHTML/insertAdjacentHTML",
        "description": "These methods insert raw HTML and can introduce XSS if content is user-controlled.",
        "severity": "high",
        "type": "xss",
        "cwe_id": "CWE-79",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Sanitize all content inserted as HTML. Prefer textContent or DOMPurify.",
        "extensions": {".js", ".ts", ".jsx", ".tsx"},
    },

    # ── MISCONFIGURATIONS ──────────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'cors\s*\(\s*\{[^}]*origin\s*:\s*["\']?\*["\']?',
            re.IGNORECASE,
        ),
        "title": "CORS Wildcard Origin",
        "description": "CORS is configured with a wildcard origin (*), allowing any website to make cross-origin requests.",
        "severity": "medium",
        "type": "misconfiguration",
        "cwe_id": "CWE-942",
        "owasp": "A05:2021 — Security Misconfiguration",
        "recommendation": "Restrict CORS to specific trusted origins. Never use * for authenticated APIs.",
        "extensions": {".js", ".ts", ".py"},
    },
    {
        "pattern": re.compile(
            r'Access-Control-Allow-Origin["\s]*:\s*["\']?\*',
            re.IGNORECASE,
        ),
        "title": "CORS Wildcard in Response Header",
        "description": "The Access-Control-Allow-Origin header is set to *, allowing any origin.",
        "severity": "medium",
        "type": "misconfiguration",
        "cwe_id": "CWE-942",
        "owasp": "A05:2021 — Security Misconfiguration",
        "recommendation": "Set Access-Control-Allow-Origin to a specific domain.",
        "extensions": None,
    },
    {
        "pattern": re.compile(
            r'(?:DEBUG|debug)\s*=\s*(?:True|true|1|"true"|\'true\')',
            re.IGNORECASE,
        ),
        "title": "Debug Mode Enabled in Production Config",
        "description": "Debug mode exposes stack traces, internal paths, and configuration details.",
        "severity": "medium",
        "type": "misconfiguration",
        "cwe_id": "CWE-94",
        "owasp": "A05:2021 — Security Misconfiguration",
        "recommendation": "Disable debug mode in production. Use environment variables to toggle it.",
        "extensions": None,
    },
    {
        "pattern": re.compile(
            r'(?:res\.json|response\.json|res\.send|console\.log)\s*\(\s*process\.env\b',
            re.IGNORECASE,
        ),
        "title": "Environment Variables Exposed in Response",
        "description": "process.env is sent in a response or logged, potentially exposing secrets.",
        "severity": "critical",
        "type": "misconfiguration",
        "cwe_id": "CWE-200",
        "owasp": "A05:2021 — Security Misconfiguration",
        "recommendation": "Never send process.env in a response. Whitelist only non-sensitive keys.",
        "extensions": {".js", ".ts"},
    },

    # ── LOGIC FLAWS ───────────────────────────────────────────────────────────
    {
        "pattern": re.compile(
            r'(?:get|find|fetch|query|select)\w*\s*\(\s*(?:request\.|req\.|params\.|input\.|user_)?'
            r'(?:id|user_id|account_id|object_id|resource_id)\b',
            re.IGNORECASE,
        ),
        "title": "Potential Insecure Direct Object Reference (IDOR)",
        "description": (
            "An object is looked up using an ID that may come from user input "
            "without verifying the requesting user is authorized."
        ),
        "severity": "high",
        "type": "access_control",
        "cwe_id": "CWE-639",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Verify the authenticated user's ownership before returning or modifying records.",
        "extensions": {".py", ".js", ".ts"},
    },
    {
        "pattern": re.compile(
            r'Object\.assign\s*\(\s*\w+\s*,\s*req\.body\b',
            re.IGNORECASE,
        ),
        "title": "Mass Assignment via Object.assign(req.body)",
        "description": (
            "Object.assign() copies all req.body properties onto a model. "
            "An attacker can inject unexpected fields like isAdmin."
        ),
        "severity": "high",
        "type": "access_control",
        "cwe_id": "CWE-915",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Explicitly whitelist allowed fields. Never assign req.body directly to a model.",
        "extensions": {".js", ".ts"},
    },
    {
        "pattern": re.compile(r'(?:\.\.\.req\.body|spread\s*\(\s*req\.body)', re.IGNORECASE),
        "title": "Mass Assignment via Spread of req.body",
        "description": "Spreading req.body into a model allows attackers to inject arbitrary fields.",
        "severity": "high",
        "type": "access_control",
        "cwe_id": "CWE-915",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Destructure only explicitly allowed fields from req.body.",
        "extensions": {".js", ".ts"},
    },
    {
        "pattern": re.compile(
            r'@app\.(?:route|get|post|put|delete|patch)\s*\([^)]*\)\s*\n'
            r'(?:(?:@(?!login_required|require_login|auth_required)[^\n]+\n)*)'
            r'(?:async\s+)?def\s+\w+\s*\([^)]*\)\s*:',
            re.IGNORECASE,
        ),
        "title": "Route Potentially Missing Authentication Check",
        "description": (
            "A route handler does not appear to use an authentication decorator. "
            "If this route accesses sensitive data, unauthenticated users may reach it."
        ),
        "severity": "high",
        "type": "access_control",
        "cwe_id": "CWE-306",
        "owasp": "A01:2021 — Broken Access Control",
        "recommendation": "Add authentication verification to all routes that handle sensitive operations.",
        "extensions": {".py"},
    },

    # ── CODE QUALITY ──────────────────────────────────────────────────────────
    {
        "pattern": re.compile(r'\beval\s*\(', re.IGNORECASE),
        "title": "Dynamic Code Execution via eval()",
        "description": (
            "eval() executes arbitrary code at runtime. If the argument contains "
            "user-controlled data, this is a critical code injection vulnerability."
        ),
        "severity": "critical",
        "type": "code_quality",
        "cwe_id": "CWE-95",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Remove eval(). Use json.loads() for data parsing or explicit function calls.",
        "extensions": {".py", ".js", ".ts"},
    },
    {
        "pattern": re.compile(r'\bexec\s*\(\s*(?!subprocess)', re.IGNORECASE),
        "title": "Dynamic Code Execution via exec()",
        "description": "exec() executes arbitrary Python code and is dangerous with user-controlled input.",
        "severity": "critical",
        "type": "code_quality",
        "cwe_id": "CWE-95",
        "owasp": "A03:2021 — Injection",
        "recommendation": "Avoid exec() entirely. Refactor to use explicit functions.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(r'pickle\.(?:loads?|Unpickler)\s*\(', re.IGNORECASE),
        "title": "Unsafe Deserialization with pickle.loads()",
        "description": (
            "pickle.load/loads can execute arbitrary code during deserialization "
            "if data comes from an untrusted source."
        ),
        "severity": "critical",
        "type": "code_quality",
        "cwe_id": "CWE-502",
        "owasp": "A08:2021 — Software and Data Integrity Failures",
        "recommendation": "Use json or another safe format. Never unpickle data from untrusted sources.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'\byaml\.load\s*\([^)]*\)(?!\s*,\s*Loader\s*=\s*yaml\.SafeLoader)',
            re.IGNORECASE,
        ),
        "title": "Unsafe YAML Deserialization",
        "description": "yaml.load() without SafeLoader can execute arbitrary Python code embedded in YAML.",
        "severity": "high",
        "type": "code_quality",
        "cwe_id": "CWE-502",
        "owasp": "A08:2021 — Software and Data Integrity Failures",
        "recommendation": "Use yaml.safe_load() instead of yaml.load().",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(r'hashlib\.(?:md5|sha1)\s*\(', re.IGNORECASE),
        "title": "Use of Weak Cryptographic Hash Function",
        "description": "MD5 and SHA-1 are cryptographically broken and should not be used for security.",
        "severity": "medium",
        "type": "code_quality",
        "cwe_id": "CWE-327",
        "owasp": "A02:2021 — Cryptographic Failures",
        "recommendation": "Use SHA-256 or SHA-3 for hashing. For passwords, use bcrypt, scrypt, or argon2.",
        "extensions": {".py"},
    },
    {
        "pattern": re.compile(
            r'verify\s*=\s*False|ssl\._create_unverified_context|check_hostname\s*=\s*False',
            re.IGNORECASE,
        ),
        "title": "SSL/TLS Certificate Verification Disabled",
        "description": "TLS verification is disabled, making connections vulnerable to man-in-the-middle attacks.",
        "severity": "high",
        "type": "misconfiguration",
        "cwe_id": "CWE-295",
        "owasp": "A02:2021 — Cryptographic Failures",
        "recommendation": "Always verify SSL certificates. Remove verify=False.",
        "extensions": {".py"},
    },
]


class PatternScanner:
    """
    Pattern-based vulnerability scanner.

    Matches the original interface used by pipeline.py:
        scanner = PatternScanner()
        findings = scanner.scan(repo_path, file_list)
    """

    def __init__(self) -> None:
        # No constructor arguments — repo_path is passed to scan()
        pass

    def scan(
        self,
        repo_path: Path,
        file_list: Optional[List[Path]] = None,
    ) -> List[Finding]:
        """
        Scan files for vulnerability patterns.

        Args:
            repo_path: Root of the cloned repository.
            file_list: If provided, only scan these files.
                       If None, scan all files under repo_path.
        """
        if file_list is not None:
            files_to_scan = []
            seen_paths = set()
            for f in file_list:
                p = Path(f)
                if not p.is_absolute():
                    p = Path(repo_path) / p
                resolved = str(p.resolve())
                if p.is_file() and resolved not in seen_paths:
                    seen_paths.add(resolved)
                    files_to_scan.append(p)
        else:
            files_to_scan = [
                f for f in Path(repo_path).rglob("*")
                if f.is_file()
                and not any(part in SKIP_DIRS for part in f.parts)
            ]

        all_findings: List[Finding] = []
        for file_path in files_to_scan:
            if any(part in SKIP_DIRS for part in file_path.parts):
                continue
            all_findings.extend(self._scan_file(file_path, Path(repo_path)))

        return all_findings

    def _scan_file(self, file_path: Path, repo_root: Path) -> List[Finding]:
        suffix = file_path.suffix.lower()
        if suffix not in SCANNABLE_EXTENSIONS:
            return []
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return []

        lines = content.splitlines()
        try:
            relative_path = str(file_path.relative_to(repo_root))
        except ValueError:
            relative_path = str(file_path)

        findings: List[Finding] = []
        seen: set = set()

        for rule in PATTERNS:
            if rule["extensions"] is not None and suffix not in rule["extensions"]:
                continue
            for match in rule["pattern"].finditer(content):
                line_start = content.count("\n", 0, match.start()) + 1
                line_end = line_start + match.group().count("\n")
                key = (rule["title"], relative_path, line_start)
                if key in seen:
                    continue
                seen.add(key)

                snippet_start = max(0, line_start - 2)
                snippet_end = min(len(lines), line_end + 2)
                code_snippet = "\n".join(lines[snippet_start:snippet_end]).strip()

                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    title=rule["title"],
                    description=rule["description"],
                    severity=rule["severity"],
                    type=rule["type"],
                    file_path=relative_path,
                    line_start=line_start,
                    line_end=line_end,
                    code_snippet=code_snippet,
                    recommendation=rule["recommendation"],
                    cwe_id=rule.get("cwe_id"),
                    owasp_category=rule.get("owasp"),
                ))

        return findings