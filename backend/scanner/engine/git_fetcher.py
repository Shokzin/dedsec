import os
import subprocess
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".php",
    ".rb", ".go", ".cs", ".cpp", ".c", ".h", ".rs",
    ".env", ".env.example", ".env.local", ".env.production",
    ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg",
    ".xml", ".html", ".htaccess", ".sh", ".bash",
    ".dockerfile", "dockerfile",
}

SKIP_DIRS = {
    "node_modules", ".git", "vendor", "dist", "build",
    "__pycache__", ".venv", "venv", "env",
}

MAX_FILE_SIZE_BYTES = 500_000


class GitFetcher:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir

    def clone(self, repo_url: str) -> tuple[str, list[str]]:
        repo_path = os.path.join(self.base_dir, "repo")
        result = subprocess.run(
            ["git", "clone", "--depth=1", "--single-branch", repo_url, repo_path],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            raise ValueError(f"Git clone failed: {result.stderr[:200]}")
        file_list = self._collect_files(repo_path)
        return repo_path, file_list

    def _collect_files(self, repo_path: str) -> list[str]:
        files = []
        root = Path(repo_path)
        for path in root.rglob("*"):
            if path.is_dir():
                continue
            parts = set(path.relative_to(root).parts)
            if parts & SKIP_DIRS:
                continue
            try:
                if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                    continue
            except OSError:
                continue
            suffix = path.suffix.lower() or path.name.lower()
            if suffix not in ALLOWED_EXTENSIONS:
                continue
            files.append(str(path.relative_to(root)))
        return files