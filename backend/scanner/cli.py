"""
DedSec CLI: scan local de vulnerabilidades (camadas Regex + AST).

Roda só com a biblioteca padrão do Python (3.11+, por causa da leitura do .dedsec.toml),
sem rede, sem Docker e sem IA.

Uso, a partir da pasta backend/:

    python -m scanner scan src/app.py src/pasta       # arquivos e pastas
    python -m scanner scan --staged                   # versão staged do git
    python -m scanner scan --stdin --stdin-filename src/app.py < src/app.py
    python -m scanner scan src --json                 # saída para a extensão
    python -m scanner scan --staged --fail-on critical

Configuração opcional: arquivo .dedsec.toml na raiz do projeto
    fail_on      = "high"               # low | medium | high | critical | none
    ignore_paths = ["testes/", "*.min.js", "backend/scanner/engine/x.py"]
    ignore_rules = ["CWE-306"]          # CWE ou "type" do achado

Silenciar uma linha: comentário `dedsec: ignore` (ou `dedsec: ignore[CWE-306]`).

Hook de pre-commit (trava o commit quando há achado grave):
    python -m scanner.cli install-hook
    python -m scanner.cli uninstall-hook

Códigos de saída:
    0  nenhum achado com severidade >= --fail-on (padrão: high)
    1  há achados com severidade >= --fail-on  (bloqueia o commit no hook)
    2  erro de uso ou de execução
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

try:
    import tomllib
except ImportError:  # Python < 3.11
    tomllib = None

from scanner.engine.finding import Finding
from scanner.engine.local_scanner import LocalScanner
from scanner.engine.pattern_scanner import SCANNABLE_EXTENSIONS, SKIP_DIRS, _effective_suffix

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
MAX_FILE_BYTES = 1_000_000  # arquivos maiores que ~1 MB são ignorados
CONFIG_NAME = ".dedsec.toml"
HOOK_MARKER = "# DedSec pre-commit hook"
_CONFIG_KEYS = {"fail_on", "ignore_paths", "ignore_rules"}

_COLORS = {
    "critical": "\033[1;31m",
    "high": "\033[31m",
    "medium": "\033[33m",
    "low": "\033[36m",
}
_DIM, _BOLD, _RESET = "\033[2m", "\033[1m", "\033[0m"


# ── coleta de arquivos ─────────────────────────────────────────────────────────
def _is_scannable(path: str) -> bool:
    p = Path(path)
    if any(part in SKIP_DIRS for part in p.parts):
        return False
    return _effective_suffix(p) in SCANNABLE_EXTENSIONS


def _decode(raw: bytes) -> str:
    # utf-8-sig remove o BOM, que faria o ast.parse falhar
    return raw.decode("utf-8-sig", errors="replace")


def _display_path(path: Path) -> str:
    try:
        return Path(os.path.relpath(path)).as_posix()
    except ValueError:  # outro drive no Windows
        return path.as_posix()


def _collect_from_disk(paths: list[str], warnings: list[str]) -> dict[str, str]:
    files: dict[str, str] = {}

    def add(path: Path, explicit: bool) -> None:
        shown = _display_path(path)
        if not _is_scannable(shown):
            if explicit:
                warnings.append(f"ignorado (tipo de arquivo não suportado): {shown}")
            return
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                warnings.append(f"ignorado (maior que 1 MB): {shown}")
                return
            files[shown] = _decode(path.read_bytes())
        except OSError as exc:
            warnings.append(f"não foi possível ler {shown}: {exc}")

    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            for root, dirs, names in os.walk(p):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for name in sorted(names):
                    add(Path(root) / name, explicit=False)
        elif p.is_file():
            add(p, explicit=True)
        else:
            raise RuntimeError(f"caminho não encontrado: {raw}")
    return files


def _git(args: list[str], cwd: str) -> bytes:
    try:
        result = subprocess.run(["git", *args], cwd=cwd, capture_output=True)
    except FileNotFoundError:
        raise RuntimeError("git não encontrado no PATH")
    if result.returncode != 0:
        msg = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(msg or "comando git falhou")
    return result.stdout


def _collect_staged(warnings: list[str]) -> tuple[dict[str, str], Path]:
    """Lê a versão que está no índice (staged), não a do disco."""
    root = _git(["rev-parse", "--show-toplevel"], os.getcwd()).decode("utf-8").strip()
    out = _git(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"], root)
    names = [n for n in out.decode("utf-8", errors="replace").split("\0") if n]

    files: dict[str, str] = {}
    for name in names:
        if not _is_scannable(name):
            continue
        blob = _git(["show", f":{name}"], root)
        if len(blob) > MAX_FILE_BYTES:
            warnings.append(f"ignorado (maior que 1 MB): {name}")
            continue
        files[name] = _decode(blob)
    return files, Path(root)


# ── configuração (.dedsec.toml) ────────────────────────────────────────────────
def _find_config() -> Path | None:
    """Procura .dedsec.toml na pasta atual e nas de cima, até a raiz do repositório git."""
    cwd = Path.cwd()
    for folder in [cwd, *cwd.parents]:
        candidate = folder / CONFIG_NAME
        if candidate.is_file():
            return candidate
        if (folder / ".git").exists():
            break
    return None


def _load_config(explicit: str | None, warnings: list[str]) -> tuple[dict, Path | None]:
    if explicit:
        path = Path(explicit)
        if not path.is_file():
            raise RuntimeError(f"arquivo de configuração não encontrado: {explicit}")
    else:
        path = _find_config()
        if path is None:
            return {}, None

    if tomllib is None:
        raise RuntimeError(f"ler {path.name} exige Python 3.11 ou mais novo")
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise RuntimeError(f"erro ao ler {path}: {exc}")

    for key in data:
        if key not in _CONFIG_KEYS:
            warnings.append(f"{path.name}: chave desconhecida '{key}' (ignorada)")
    fail_on = data.get("fail_on")
    if fail_on is not None and fail_on not in (*SEVERITY_RANK, "none"):
        raise RuntimeError(f"{path.name}: fail_on inválido: {fail_on!r}")
    for key in ("ignore_paths", "ignore_rules"):
        value = data.get(key, [])
        if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
            raise RuntimeError(f"{path.name}: {key} deve ser uma lista de textos")
    return data, path.resolve()


def _relative_to(base_dir: Path, name: str, config_dir: Path) -> str:
    """Caminho do arquivo relativo à pasta onde está o .dedsec.toml."""
    try:
        return Path(os.path.relpath(base_dir / name, config_dir)).as_posix()
    except ValueError:  # outro drive no Windows
        return name.replace("\\", "/")


def _path_ignored(rel: str, patterns: list[str]) -> bool:
    for raw in patterns:
        pat = raw.replace("\\", "/").removeprefix("./")
        if not pat:
            continue
        if pat.endswith("/"):  # pasta, em qualquer nível
            if f"/{pat}" in f"/{rel}":
                return True
        elif fnmatch.fnmatch(rel, pat) or ("/" not in pat and fnmatch.fnmatch(rel.rsplit("/", 1)[-1], pat)):
            return True
    return False


# ── saída ──────────────────────────────────────────────────────────────────────
def _summarize(findings: list[Finding]) -> dict[str, int]:
    counts = {sev: 0 for sev in ("critical", "high", "medium", "low")}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    return counts


def _print_text(findings: list[Finding], n_files: int, fail_on: str,
                blocked: bool, color: bool, verbose: bool, ignored: int = 0) -> None:
    def paint(text: str, code: str) -> str:
        return f"{code}{text}{_RESET}" if color else text

    note = paint(f"({ignored} achado(s) ignorado(s) pelo {CONFIG_NAME})", _DIM) if ignored else ""
    if not findings:
        print(f"DedSec: nenhum achado em {n_files} arquivo(s). {note}".rstrip())
        return

    print(paint(f"DedSec: {n_files} arquivo(s) analisado(s)", _BOLD))
    current = None
    for f in findings:
        if f.file_path != current:
            current = f.file_path
            print(f"\n{paint(current, _BOLD)}")
        sev = paint(f"{f.severity:<8}", _COLORS.get(f.severity, ""))
        cwe = paint(f"({f.cwe_id})", _DIM) if f.cwe_id else ""
        print(f"  L{f.line_start:<5} {sev} {f.title} {cwe}".rstrip())
        if verbose:
            print(paint(f"         {f.recommendation}", _DIM))

    counts = _summarize(findings)
    parts = [f"{n} {sev}" for sev, n in counts.items() if n]
    print(f"\n{len(findings)} achado(s): {', '.join(parts)} {note}".rstrip())
    if blocked:
        print(paint(f"Bloqueado: há achados com severidade >= {fail_on}.", _COLORS["critical"]))


def _print_json(findings: list[Finding], n_files: int, fail_on: str, blocked: bool,
                ignored: int = 0, config_file: Path | None = None) -> None:
    payload = {
        "version": 1,
        "files_scanned": n_files,
        "total": len(findings),
        "by_severity": _summarize(findings),
        "fail_on": fail_on,
        "blocked": blocked,
        "ignored_by_config": ignored,
        "config_file": str(config_file) if config_file else None,
        "findings": [asdict(f) for f in findings],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


# ── comando scan ───────────────────────────────────────────────────────────────
def _run_scan(args: argparse.Namespace, parser: argparse.ArgumentParser) -> int:
    modes = [bool(args.staged), bool(args.stdin), bool(args.paths)]
    if sum(modes) > 1:
        parser.error("use apenas um modo: caminhos, --staged ou --stdin")

    warnings: list[str] = []
    try:
        config, config_path = _load_config(args.config, warnings)
        base_dir = Path.cwd()
        if args.stdin:
            if not args.stdin_filename:
                parser.error("--stdin exige --stdin-filename (usado para saber a extensão)")
            name = args.stdin_filename.replace("\\", "/")
            files = {name: _decode(sys.stdin.buffer.read())}
        elif args.staged:
            files, base_dir = _collect_staged(warnings)
        else:
            files = _collect_from_disk(args.paths or ["."], warnings)
    except RuntimeError as exc:
        print(f"dedsec: {exc}", file=sys.stderr)
        return 2

    for w in warnings:
        print(f"dedsec: aviso: {w}", file=sys.stderr)

    patterns = config.get("ignore_paths", [])
    if patterns and config_path:
        config_dir = config_path.parent
        files = {n: c for n, c in files.items()
                 if not _path_ignored(_relative_to(base_dir, n, config_dir), patterns)}

    findings = LocalScanner().scan_files(files)

    ignored_rules = {r.strip().lower() for r in config.get("ignore_rules", [])}
    ignored = 0
    if ignored_rules:
        kept = []
        for f in findings:
            if (f.cwe_id or "").lower() in ignored_rules or f.type.lower() in ignored_rules:
                ignored += 1
            else:
                kept.append(f)
        findings = kept
    findings.sort(key=lambda f: (f.file_path, f.line_start, -SEVERITY_RANK.get(f.severity, 0)))

    fail_on = args.fail_on or config.get("fail_on") or "high"
    threshold = SEVERITY_RANK.get(fail_on)  # None quando fail_on = "none"
    blocked = threshold is not None and any(
        SEVERITY_RANK.get(f.severity, 0) >= threshold for f in findings
    )

    if args.json:
        _print_json(findings, len(files), fail_on, blocked, ignored, config_path)
    else:
        color = (not args.no_color and sys.stdout.isatty()
                 and "NO_COLOR" not in os.environ)
        if color and os.name == "nt":
            os.system("")  # habilita sequências ANSI no console do Windows
        _print_text(findings, len(files), fail_on, blocked, color, args.verbose, ignored)

    return 1 if blocked else 0


# ── hook de pre-commit ─────────────────────────────────────────────────────────
def _sh_quote(text: str) -> str:
    return "'" + text.replace("'", "'\\''") + "'"


def _hook_script(scanner_dir: str) -> str:
    """Script do hook. `scanner_dir` é a expressão de shell da pasta que contém o pacote scanner."""
    return f"""#!/bin/sh
{HOOK_MARKER} (gerado por: python -m scanner.cli install-hook)
# Para pular uma vez: git commit --no-verify
# Para remover: python -m scanner.cli uninstall-hook
ROOT="$(git rev-parse --show-toplevel)" || exit 0
cd "$ROOT" || exit 0
SCANNER_DIR={scanner_dir}
[ -d "$SCANNER_DIR/scanner" ] || {{ echo "DedSec: pasta do scanner nao encontrada; scan ignorado." >&2; exit 0; }}
for PY in python python3 py; do
  if command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import sys; sys.exit(sys.version_info < (3, 11))" >/dev/null 2>&1; then
    exec "$PY" -c "import sys; sys.path.insert(0, sys.argv[1]); del sys.argv[1]; from scanner.cli import main; sys.exit(main())" "$SCANNER_DIR" scan --staged
  fi
done
echo "DedSec: Python 3.11+ nao encontrado; scan ignorado." >&2
exit 0
"""


def _hooks_location() -> tuple[Path, Path]:
    root = Path(_git(["rev-parse", "--show-toplevel"], os.getcwd()).decode("utf-8").strip())
    raw = _git(["rev-parse", "--git-path", "hooks"], str(root)).decode("utf-8").strip()
    hooks = Path(raw)
    if not hooks.is_absolute():
        hooks = root / hooks
    return root, hooks


def _cmd_install_hook(args: argparse.Namespace) -> int:
    try:
        root, hooks = _hooks_location()
    except RuntimeError as exc:
        print(f"dedsec: {exc}", file=sys.stderr)
        return 2

    # pasta que contém o pacote "scanner" (aqui: backend/)
    pkg_parent = Path(__file__).resolve().parent.parent
    try:
        rel = pkg_parent.relative_to(root.resolve()).as_posix()
        target = '"$ROOT"' if rel == "." else f'"$ROOT"/{_sh_quote(rel)}'
    except ValueError:  # scanner fora do repositório: caminho absoluto
        target = _sh_quote(pkg_parent.as_posix())

    hook = hooks / "pre-commit"
    if hook.exists():
        current = hook.read_text(encoding="utf-8", errors="replace")
        if HOOK_MARKER not in current:
            if not args.force:
                print(f"dedsec: já existe um hook pre-commit que não é do DedSec em {hook}.\n"
                      "        Use --force para fazer backup dele e instalar o do DedSec.",
                      file=sys.stderr)
                return 2
            backup = hooks / "pre-commit.dedsec-backup"
            hook.replace(backup)
            print(f"Backup do hook antigo: {backup}")

    hooks.mkdir(parents=True, exist_ok=True)
    hook.write_text(_hook_script(target), encoding="utf-8", newline="\n")  # LF: obrigatório em sh
    try:
        hook.chmod(hook.stat().st_mode | 0o111)
    except OSError:
        pass
    print(f"Hook instalado: {hook}")
    print("Agora todo 'git commit' analisa os arquivos staged. Para pular uma vez: git commit --no-verify")
    return 0


def _cmd_uninstall_hook(args: argparse.Namespace) -> int:
    try:
        _, hooks = _hooks_location()
    except RuntimeError as exc:
        print(f"dedsec: {exc}", file=sys.stderr)
        return 2
    hook = hooks / "pre-commit"
    if not hook.exists():
        print("Nenhum hook pre-commit instalado.")
        return 0
    if HOOK_MARKER not in hook.read_text(encoding="utf-8", errors="replace"):
        print(f"dedsec: o hook em {hook} não é do DedSec; não vou remover.", file=sys.stderr)
        return 2
    hook.unlink()
    print(f"Hook removido: {hook}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dedsec",
        description="DedSec: análise local de vulnerabilidades (Regex + AST).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    scan = sub.add_parser("scan", help="analisa arquivos, pastas, o staged do git ou stdin")
    scan.add_argument("paths", nargs="*", help="arquivos ou pastas (padrão: pasta atual)")
    scan.add_argument("--staged", action="store_true",
                      help="analisa a versão staged dos arquivos (git diff --cached)")
    scan.add_argument("--stdin", action="store_true",
                      help="lê o conteúdo de um arquivo pela entrada padrão")
    scan.add_argument("--stdin-filename", metavar="CAMINHO",
                      help="nome do arquivo lido via --stdin")
    scan.add_argument("--json", action="store_true", help="saída em JSON")
    scan.add_argument("--fail-on", choices=[*SEVERITY_RANK, "none"], default=None,
                      help="severidade mínima que faz o comando sair com código 1 "
                           "(padrão: o do .dedsec.toml, ou high)")
    scan.add_argument("--config", metavar="ARQUIVO",
                      help="caminho do .dedsec.toml (padrão: procura na pasta atual e acima)")
    scan.add_argument("-v", "--verbose", action="store_true", help="mostra a recomendação de cada achado")
    scan.add_argument("--no-color", action="store_true", help="desativa cores")

    install = sub.add_parser("install-hook", help="instala o hook de pre-commit no repositório git atual")
    install.add_argument("--force", action="store_true",
                         help="substitui um pre-commit existente (faz backup do antigo)")
    sub.add_parser("uninstall-hook", help="remove o hook de pre-commit do DedSec")
    return parser


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "install-hook":
        return _cmd_install_hook(args)
    if args.command == "uninstall-hook":
        return _cmd_uninstall_hook(args)
    return _run_scan(args, parser)


if __name__ == "__main__":
    sys.exit(main())
