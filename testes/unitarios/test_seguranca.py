# -*- coding: utf-8 -*-
"""
Falhas encontradas na auditoria de seguranca de novembro de 2026.

1. Links simbolicos: um repositorio analisado podia conter um arquivo que
   apontava para fora dele, e o scanner lia o arquivo do servidor e devolvia
   trechos dele no relatorio. Um link para /dev/zero travava o processo.
2. Validacao da URL: re.match com "$" aceitava texto depois de uma quebra de
   linha, e nomes impossiveis no GitHub, como "..".
3. Identificador de analise invalido virava erro 500 no banco.
4. O limite MAX_REPO_SIZE_MB existia na configuracao, mas nunca era aplicado.

"""
import io
import json
import os
import subprocess
import urllib.error
from pathlib import Path

import pytest

import conftest as dubles
from fastapi.testclient import TestClient
from app.main import app
from app.models.scan import ScanCreateRequest
from scanner.engine import git_fetcher
from scanner.engine.git_fetcher import GitFetcher, RepositoryRejected, check_repository_size
from scanner.engine.pattern_scanner import PatternScanner
from scanner.engine.ast_analyzer import ASTAnalyzer
from scanner.engine.safe_files import is_regular_file_inside
from scanner import cli

SEGREDO = 'db_password = "segredo-do-servidor"\n'


def _git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                   env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                        "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"})


@pytest.fixture
def repo_com_link(tmp_path):
    """Repositorio com um link simbolico para um arquivo de fora dele."""
    fora = tmp_path / "fora"
    fora.mkdir()
    (fora / "config_do_servidor.py").write_text(SEGREDO)
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "main.py").write_text('print("ola")\n')
    os.symlink(fora / "config_do_servidor.py", repo / "inocente.py")
    return repo


# ── 1. links simbolicos ──────────────────────────────────────────────────────
def test_coleta_ignora_link_para_fora_do_repositorio(repo_com_link):
    arquivos = GitFetcher("/nao-usado")._collect_files(str(repo_com_link))
    assert arquivos == ["main.py"]


def test_coleta_ignora_link_para_arquivo_infinito(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    os.symlink("/dev/zero", repo / "infinito.py")
    assert GitFetcher("/nao-usado")._collect_files(str(repo)) == []


def test_camadas_nao_leem_link_mesmo_se_listado(repo_com_link):
    """Defesa em profundidade: mesmo recebendo o link na lista, nada e lido."""
    lista = ["main.py", "inocente.py"]
    lexica = PatternScanner().scan(str(repo_com_link), lista)
    estrutural = ASTAnalyzer().analyze(str(repo_com_link), lista)
    trechos = " ".join(f.code_snippet for f in lexica + estrutural)
    assert "segredo-do-servidor" not in trechos


def test_clone_grava_link_como_arquivo_comum(repo_com_link, tmp_path):
    """core.symlinks=false: o link vira um arquivo com o caminho de destino."""
    _git("init", "-q", cwd=repo_com_link)
    _git("add", "-A", cwd=repo_com_link)
    _git("commit", "-qm", "inicial", cwd=repo_com_link)
    destino = tmp_path / "clone"
    destino.mkdir()
    caminho, arquivos = GitFetcher(str(destino)).clone(str(repo_com_link))
    clonado = Path(caminho) / "inocente.py"
    assert not clonado.is_symlink()
    assert "segredo-do-servidor" not in clonado.read_text()
    assert "inocente.py" in arquivos


def test_helper_aceita_so_arquivo_regular_dentro_da_raiz(repo_com_link):
    assert is_regular_file_inside(repo_com_link / "main.py", repo_com_link)
    assert not is_regular_file_inside(repo_com_link / "inocente.py", repo_com_link)
    assert not is_regular_file_inside(repo_com_link / "nao-existe.py", repo_com_link)


def test_cli_ignora_link_em_varredura_de_pasta(repo_com_link):
    avisos = []
    arquivos = cli._collect_from_disk([str(repo_com_link)], avisos)
    assert not any("inocente" in nome for nome in arquivos)
    assert not any("segredo-do-servidor" in texto for texto in arquivos.values())


def test_cli_recusa_arquivo_especial_mesmo_explicito(tmp_path):
    os.symlink("/dev/zero", tmp_path / "infinito.py")
    avisos = []
    arquivos = cli._collect_from_disk([str(tmp_path / "infinito.py")], avisos)
    assert arquivos == {}
    assert any("não é um arquivo comum" in a for a in avisos)


# ── 2. validacao da URL ──────────────────────────────────────────────────────
@pytest.mark.parametrize("url", [
    "https://github.com/Shokzin/dedsec",
    "https://github.com/Shokzin/dedsec/",
    "https://github.com/org-x/.github",
    "  https://github.com/a/b  ",
])
def test_url_valida(url):
    assert ScanCreateRequest(repo_url=url).repo_url.startswith("https://github.com/")


@pytest.mark.parametrize("url", [
    "https://github.com/a/..",
    "https://github.com/../x",
    "https://github.com/a/b\nhttps://evil.example",
    "https://github.com.evil.example/a/b",
    "https://github.com/a/b?x=1",
    "http://github.com/a/b",
    "file:///etc/passwd",
])
def test_url_invalida(url):
    with pytest.raises(ValueError):
        ScanCreateRequest(repo_url=url)


# ── 3. identificador de analise ──────────────────────────────────────────────
def test_identificador_invalido_responde_422_e_nao_500():
    dubles.TOKENS_VALIDOS["token-seguranca"] = "usuario-seguranca"
    cliente = TestClient(app)
    h = {"Authorization": "Bearer token-seguranca"}
    assert cliente.get("/api/v1/scans/nao-e-um-uuid", headers=h).status_code == 422
    assert cliente.delete("/api/v1/auth/scans/nao-e-um-uuid", headers=h).status_code == 422


# ── 4. limite de tamanho do repositorio ──────────────────────────────────────
class _Resposta(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False


def _api_github(monkeypatch, *, tamanho_kb=None, erro=None):
    def falso(req, timeout=None):
        if erro:
            raise erro
        return _Resposta(json.dumps({"size": tamanho_kb}).encode())
    monkeypatch.setattr(git_fetcher.urllib.request, "urlopen", falso)


def test_repositorio_grande_demais_e_recusado(monkeypatch):
    _api_github(monkeypatch, tamanho_kb=500 * 1024)
    with pytest.raises(RepositoryRejected, match="100 MB"):
        check_repository_size("https://github.com/a/b", 100)


def test_repositorio_inexistente_ou_privado_e_recusado(monkeypatch):
    erro = urllib.error.HTTPError("u", 404, "Not Found", {}, None)
    _api_github(monkeypatch, erro=erro)
    with pytest.raises(RepositoryRejected, match="not found"):
        check_repository_size("https://github.com/a/b", 100)


def test_api_do_github_fora_do_ar_nao_bloqueia(monkeypatch):
    _api_github(monkeypatch, erro=urllib.error.URLError("sem rede"))
    check_repository_size("https://github.com/a/b", 100)


def test_repositorio_dentro_do_limite_passa(monkeypatch):
    _api_github(monkeypatch, tamanho_kb=2048)
    check_repository_size("https://github.com/a/b", 100)
