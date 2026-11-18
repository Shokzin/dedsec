"""
safe_files.py — decide se um caminho pode ser lido com seguranca.

Um projeto analisado pode conter links simbolicos para fora dele, ou arquivos
especiais como /dev/zero, que nunca termina. Ler qualquer um deles faria o
scanner expor arquivos da maquina que o executa ou travar. Por isso so se le
arquivo regular, que nao seja link, e cujo caminho real fique dentro da raiz.

Usa apenas a biblioteca padrao: este modulo vai embutido na extensao do editor.
"""
import stat
from pathlib import Path


def is_regular_file_inside(path: Path, root: Path) -> bool:
    try:
        info = path.lstat()
    except OSError:
        return False
    if not stat.S_ISREG(info.st_mode):
        return False
    try:
        return path.resolve().is_relative_to(root.resolve())
    except (OSError, ValueError):
        return False
