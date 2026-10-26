import ast
import uuid
import os
from pathlib import Path
from scanner.engine.finding import Finding


class ASTAnalyzer:
    """
    Análise estrutural (AST) de código Python.

    Dois modos de uso:

    1) Repositório em disco (pipeline web, interface original):
           ASTAnalyzer().analyze(repo_path, file_list)

    2) Conteúdo em memória (CLI, extensão do VS Code, hook de pre-commit):
           ASTAnalyzer().analyze_content(content, "src/app.py")
       Se o código tiver erro de sintaxe (comum enquanto se digita),
       devolve lista vazia em vez de lançar exceção.
    """

    def analyze(self, repo_path: str, file_list: list[str]) -> list[Finding]:
        findings = []
        for rel_path in file_list:
            if not rel_path.endswith(".py"):
                continue
            abs_path = os.path.join(repo_path, rel_path)
            try:
                source = Path(abs_path).read_text(errors="replace")
            except OSError:
                continue
            findings.extend(self.analyze_content(source, rel_path))
        return findings

    def analyze_content(self, content: str, file_path: str) -> list[Finding]:
        if not file_path.endswith(".py"):
            return []
        try:
            tree = ast.parse(content, filename=file_path)
        except (SyntaxError, ValueError):
            return []
        visitor = VulnVisitor(file_path, content.splitlines())
        visitor.visit(tree)
        return visitor.findings


class VulnVisitor(ast.NodeVisitor):
    MAX_SNIPPET_LINES = 5

    def __init__(self, file_path: str, source_lines: list[str] | None = None):
        self.file_path = file_path
        self.source_lines = source_lines or []
        self.findings: list[Finding] = []

    def visit_Call(self, node: ast.Call) -> None:
        self._check_pickle(node)
        self._check_yaml_load(node)
        self._check_eval(node)
        self._check_subprocess_shell(node)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._check_mass_assignment(node)
        self._check_missing_auth_decorator(node)
        self.generic_visit(node)

    def _check_pickle(self, node: ast.Call) -> None:
        if self._is_call(node, "pickle", "loads"):
            self._add(
                node,
                "unsafe_deserialization",
                "Unsafe Deserialization with pickle.loads()",
                "critical", "CWE-502",
                "A08:2021 – Software and Data Integrity Failures",
                "Never deserialize untrusted data with pickle. Use JSON or a safe alternative.",
            )

    def _check_yaml_load(self, node: ast.Call) -> None:
        if self._is_call(node, "yaml", "load"):
            args = node.args + [kw.value for kw in node.keywords]
            has_safe_loader = any(
                isinstance(a, ast.Attribute) and "SafeLoader" in ast.unparse(a)
                for a in args
            )
            if not has_safe_loader:
                self._add(
                    node,
                    "unsafe_yaml_load",
                    "Unsafe yaml.load() Without SafeLoader",
                    "high", "CWE-502",
                    "A08:2021 – Software and Data Integrity Failures",
                    "Use yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader).",
                )

    def _check_eval(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name) and node.func.id in ("eval", "exec", "compile"):
            if node.args and not isinstance(node.args[0], ast.Constant):
                self._add(
                    node,
                    "code_injection",
                    f"Dynamic Code Execution via {node.func.id}()",
                    "critical", "CWE-94",
                    "A03:2021 – Injection",
                    f"Avoid {node.func.id}() with dynamic input. Refactor to use explicit logic.",
                )

    def _check_subprocess_shell(self, node: ast.Call) -> None:
        if self._is_call(node, "subprocess", ("call", "run", "Popen", "check_output")):
            for kw in node.keywords:
                if (
                    kw.arg == "shell"
                    and isinstance(kw.value, ast.Constant)
                    and kw.value.value is True
                ):
                    self._add(
                        node,
                        "command_injection_shell",
                        "subprocess Called with shell=True",
                        "high", "CWE-78",
                        "A03:2021 – Injection",
                        "Use shell=False and pass arguments as a list instead of a string.",
                    )

    def _check_mass_assignment(self, node: ast.FunctionDef) -> None:
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                for kw in child.keywords:
                    if kw.arg is None and isinstance(kw.value, ast.Call):
                        func_str = ast.unparse(kw.value.func)
                        if any(term in func_str for term in ["json", "dict", "form", "body"]):
                            self._add(
                                child,
                                "mass_assignment",
                                "Potential Mass Assignment Vulnerability",
                                "high", "CWE-915",
                                "A03:2021 – Injection",
                                "Use explicit Pydantic models instead of unpacking "
                                "request data directly into model constructors.",
                            )
                            break

    def _check_missing_auth_decorator(self, node: ast.FunctionDef) -> None:
        decorator_names = [ast.unparse(d) for d in node.decorator_list]
        is_route = any(
            any(m in d for m in ["get", "post", "put", "delete", "patch"])
            for d in decorator_names
        )
        if not is_route:
            return
        has_id_param = any(
            arg.arg in ("user_id", "account_id", "id") for arg in node.args.args
        )
        has_auth = any("Depends" in d or "current_user" in d for d in decorator_names)
        if has_id_param and not has_auth:
            self._add(
                node,
                "potential_idor",
                "Potential IDOR — Route with ID Param Lacks Auth Dependency",
                "high", "CWE-639",
                "A01:2021 – Broken Access Control",
                "Verify the authenticated user owns the requested resource. "
                "Add Depends(get_current_user) and check user_id matches.",
            )

    def _is_call(self, node: ast.Call, module: str, func) -> bool:
        funcs = (func,) if isinstance(func, str) else func
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name):
                return node.func.value.id == module and node.func.attr in funcs
        return False

    def _snippet(self, node) -> str:
        """Trecho real do código (até MAX_SNIPPET_LINES linhas); cai para 'Line N'."""
        if self.source_lines:
            start = max(0, node.lineno - 1)
            end = min(len(self.source_lines), getattr(node, "end_lineno", node.lineno))
            end = min(end, start + self.MAX_SNIPPET_LINES)
            snippet = "\n".join(self.source_lines[start:end]).strip()
            if snippet:
                return snippet
        return f"Line {node.lineno}"

    def _add(self, node, vuln_type, title, severity, cwe, owasp, rec) -> None:
        self.findings.append(Finding(
            id=str(uuid.uuid4()),
            type=vuln_type,
            title=title,
            description=f"Detected {title} at line {node.lineno} in {self.file_path}",
            severity=severity,
            file_path=self.file_path,
            line_start=node.lineno,
            line_end=getattr(node, "end_lineno", node.lineno),
            code_snippet=self._snippet(node),
            recommendation=rec,
            cwe_id=cwe,
            owasp_category=owasp,
        ))
