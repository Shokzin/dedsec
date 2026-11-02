# -*- coding: utf-8 -*-
"""
Autorizacao e limite de requisicoes.

Estes casos cobrem tres defeitos corrigidos na segunda etapa do trabalho:

1. A identidade saia do token sem conferir a assinatura, o que permitia forjar
   o campo "sub" e passar por qualquer usuario.
2. A remocao de uma analise filtrava apenas pelo identificador da analise, sem
   exigir que ela pertencesse a quem pediu (IDOR).
3. Nao havia limite de requisicoes; criar analise e caro e ocupa um trabalhador.

Rodando este arquivo contra a versao anterior do codigo, os tres primeiros
casos falham, o que confirma que exercitam de fato o comportamento corrigido.
"""
import base64
import json

import conftest as dubles
from fastapi.testclient import TestClient
from app.main import app

cliente = TestClient(app)

ALICE, BOB = "alice-uuid", "bob-uuid"
dubles.TOKENS_VALIDOS["token-da-alice"] = ALICE
dubles.TOKENS_VALIDOS["token-do-bob"] = BOB
H_ALICE = {"Authorization": "Bearer token-da-alice"}
H_BOB = {"Authorization": "Bearer token-do-bob"}


def token_forjado(uid):
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f"{b({'alg':'HS256','typ':'JWT'})}.{b({'sub':uid,'exp':9999999999})}.inventada"


def zerar():
    dubles.BANCO["scans"] = []
    dubles.CONTADORES.clear()
    from app.core.security import limpar_cache_de_sessao
    limpar_cache_de_sessao()


def test_token_forjado_e_recusado():
    zerar()
    h = {"Authorization": f"Bearer {token_forjado(ALICE)}"}
    r = cliente.get("/api/v1/scans", headers=h)
    assert r.status_code == 401, f"token forjado foi aceito: {r.status_code}"


def test_token_valido_e_aceito():
    zerar()
    r = cliente.get("/api/v1/scans", headers=H_ALICE)
    assert r.status_code == 200, r.text


def test_sem_token_e_recusado():
    zerar()
    assert cliente.get("/api/v1/scans").status_code in (401, 403)


def test_nao_apaga_analise_de_outro_usuario():
    zerar()
    dubles.BANCO["scans"].append({"id": "analise-da-alice", "user_id": ALICE,
                                  "repo_url": "https://github.com/a/b", "status": "completed"})
    r = cliente.delete("/api/v1/auth/scans/analise-da-alice", headers=H_BOB)
    assert r.status_code == 404, f"Bob apagou analise da Alice: {r.status_code}"
    assert any(s["id"] == "analise-da-alice" for s in dubles.BANCO["scans"]), "a analise sumiu"


def test_dono_apaga_a_propria_analise():
    zerar()
    dubles.BANCO["scans"].append({"id": "analise-da-alice", "user_id": ALICE,
                                  "repo_url": "https://github.com/a/b", "status": "completed"})
    r = cliente.delete("/api/v1/auth/scans/analise-da-alice", headers=H_ALICE)
    assert r.status_code == 200, r.text
    assert not dubles.BANCO["scans"]


def test_limite_de_criacao_de_analise():
    zerar()
    from app.core.config import get_settings
    limite = get_settings().rate_limit_criar_analise_min
    corpo = {"repo_url": "https://github.com/exemplo/projeto"}
    codigos = [cliente.post("/api/v1/scans", json=corpo, headers=H_ALICE).status_code
               for _ in range(limite + 3)]
    assert codigos[:limite] == [202] * limite, codigos
    assert codigos[limite] == 429, f"nao limitou: {codigos}"
    assert all(c == 429 for c in codigos[limite:]), codigos


def test_limite_traz_retry_after():
    zerar()
    corpo = {"repo_url": "https://github.com/exemplo/projeto"}
    from app.core.config import get_settings
    for _ in range(get_settings().rate_limit_criar_analise_min + 1):
        r = cliente.post("/api/v1/scans", json=corpo, headers=H_ALICE)
    assert r.status_code == 429
    assert r.headers.get("Retry-After"), "faltou o cabecalho Retry-After"


def test_limite_separa_usuarios():
    zerar()
    corpo = {"repo_url": "https://github.com/exemplo/projeto"}
    from app.core.config import get_settings
    for _ in range(get_settings().rate_limit_criar_analise_min + 1):
        cliente.post("/api/v1/scans", json=corpo, headers=H_ALICE)
    r = cliente.post("/api/v1/scans", json=corpo, headers=H_BOB)
    assert r.status_code == 202, f"o limite da Alice atingiu o Bob: {r.status_code}"
