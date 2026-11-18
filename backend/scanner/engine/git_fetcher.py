"""
git_fetcher.py — obtencao do repositorio analisado pela plataforma web.

O repositorio vem de qualquer pessoa na internet, entao todo o conteudo dele e
tratado como hostil. Tres cuidados decorrem disso:

1. Links simbolicos. Um repositorio pode conter um arquivo que, na verdade,
   aponta para fora dele (/proc/self/environ, um arquivo de configuracao do
   servidor, /dev/zero). Segui-lo faria o servidor ler os proprios arquivos e
   devolver trechos deles no relatorio, ou travar lendo um arquivo infinito.
   O clone e feito com core.symlinks=false, que grava cada link como um
   arquivo comum contendo apenas o caminho de destino, e a coleta ainda
   descarta qualquer coisa que nao seja arquivo regular dentro da pasta.

2. Tamanho. O limite MAX_REPO_SIZE_MB e conferido na API do GitHub antes do
   clone. Se a API nao responder, o clone segue: o prazo de 60 segundos do
   processo continua limitando quanto pode ser baixado.

3. Interacao. GIT_TERMINAL_PROMPT=0 impede que o git espere uma senha (o que
   acontece com repositorios privados ou inexistentes), e GIT_LFS_SKIP_SMUDGE
   evita baixar arquivos grandes armazenados no Git LFS.
"""
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

from scanner.engine.safe_files import is_regular_file_inside

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".php",
    ".rb", ".go", ".cs", ".cpp", ".c", ".h", ".rs",
    ".env", ".env.example", ".env.local", ".env.production",
    ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg",
    ".xml", ".html", ".htm", ".conf", ".htaccess", ".sh", ".bash",
    ".dockerfile", "dockerfile",
}

SKIP_DIRS = {
    "node_modules", ".git", "vendor", "dist", "build",
    "__pycache__", ".venv", "venv", "env",
}

MAX_FILE_SIZE_BYTES = 500_000
CLONE_TIMEOUT_SECONDS = 60

_GITHUB_REPO = re.compile(r"^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$")


class RepositoryRejected(ValueError):
    """O repositorio nao pode ser analisado (inexistente, privado ou grande demais)."""


def check_repository_size(repo_url: str, max_size_mb: int | None) -> None:
    """
    Recusa o repositorio se a API do GitHub informar que ele e maior que o limite
    ou que nao existe. Qualquer falha da propria API (limite de consultas, rede)
    deixa o clone seguir, para que uma instabilidade do GitHub nao derrube o servico.
    """
    if not max_size_mb:
        return
    m = _GITHUB_REPO.match(repo_url)
    if not m:
        return
    owner, repo = m.group(1), m.group(2)
    req = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "dedsec-scanner"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read(200_000).decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise RepositoryRejected("Repository not found or not public.")
        return
    except (urllib.error.URLError, OSError, ValueError):
        return

    size_kb = data.get("size")
    if isinstance(size_kb, int) and size_kb > max_size_mb * 1024:
        raise RepositoryRejected(
            f"Repository is larger than the {max_size_mb} MB limit "
            f"({size_kb // 1024} MB)."
        )


class GitFetcher:
    def __init__(self, base_dir: str, max_repo_size_mb: int | None = None):
        self.base_dir = base_dir
        self.max_repo_size_mb = max_repo_size_mb

    def clone(self, repo_url: str) -> tuple[str, list[str]]:
        check_repository_size(repo_url, self.max_repo_size_mb)

        repo_path = os.path.join(self.base_dir, "repo")
        env = {
            **os.environ,
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_LFS_SKIP_SMUDGE": "1",
        }
        try:
            result = subprocess.run(
                [
                    "git",
                    "-c", "core.symlinks=false",
                    "clone", "--depth=1", "--single-branch", "--no-tags",
                    "--", repo_url, repo_path,
                ],
                capture_output=True, text=True,
                timeout=CLONE_TIMEOUT_SECONDS, env=env,
            )
        except subprocess.TimeoutExpired:
            raise RepositoryRejected(
                f"Cloning took longer than {CLONE_TIMEOUT_SECONDS} seconds."
            )
        if result.returncode != 0:
            raise ValueError(f"Git clone failed: {result.stderr[:200]}")
        file_list = self._collect_files(repo_path)
        return repo_path, file_list

    def _collect_files(self, repo_path: str) -> list[str]:
        files = []
        root = Path(repo_path)
        for path in root.rglob("*"):
            parts = set(path.relative_to(root).parts)
            if parts & SKIP_DIRS:
                continue
            # lstat, nao stat: um link simbolico nunca e seguido
            if not is_regular_file_inside(path, root):
                continue
            if path.lstat().st_size > MAX_FILE_SIZE_BYTES:
                continue
            suffix = path.suffix.lower() or path.name.lower()
            if suffix not in ALLOWED_EXTENSIONS:
                continue
            files.append(str(path.relative_to(root)))
        return files
