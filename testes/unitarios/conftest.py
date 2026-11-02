"""
conftest.py — dubles para os testes unitarios.

Os testes em testes/ sao de integracao: exigem a API no ar e credenciais reais
do Supabase. Os daqui exercitam as regras de autorizacao e o limite de
requisicoes sem infraestrutura, substituindo supabase, redis e celery por
implementacoes em memoria. Rodam em qualquer maquina, inclusive em integracao
continua, e por isso servem como rede de protecao contra regressao.
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RAIZ, "backend"))

os.environ.setdefault("SUPABASE_URL", "https://exemplo.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-de-teste")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-de-teste")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("ENVIRONMENT", "development")

import types
import time

# ---------- supabase ----------
TOKENS_VALIDOS = {}      # token -> user_id
BANCO = {"scans": []}    # linhas

class _Usuario:
    def __init__(self, uid): self.id = uid; self.email = f"{uid}@teste.local"

class _RespUser:
    def __init__(self, uid): self.user = _Usuario(uid)

class _Auth:
    class _Admin:
        def delete_user(self, uid): BANCO["scans"] = [s for s in BANCO["scans"] if s["user_id"] != uid]
    admin = _Admin()
    def get_user(self, token):
        if token not in TOKENS_VALIDOS:
            raise Exception("invalid JWT: unable to parse or verify signature")
        return _RespUser(TOKENS_VALIDOS[token])
    def set_session(self, *a, **k): pass

class _Resultado:
    def __init__(self, data, count=None): self.data = data; self.count = count

class _Consulta:
    def __init__(self, tabela, acao="select"):
        self.tabela, self.acao, self.filtros = tabela, acao, {}
        self._um = False
    def select(self, *a, **k): self.acao = "select"; return self
    def delete(self): self.acao = "delete"; return self
    def insert(self, rec): self.acao = "insert"; self._rec = rec; return self
    def eq(self, campo, valor): self.filtros[campo] = valor; return self
    def order(self, *a, **k): return self
    def range(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def maybe_single(self): self._um = True; return self
    def execute(self):
        linhas = BANCO[self.tabela]
        if self.acao == "insert":
            linhas.append(dict(self._rec)); return _Resultado([self._rec])
        casa = [l for l in linhas if all(l.get(k) == v for k, v in self.filtros.items())]
        if self.acao == "delete":
            BANCO[self.tabela] = [l for l in linhas if l not in casa]
            return _Resultado(casa)
        if self._um:
            return _Resultado(casa[0] if casa else None, len(casa))
        return _Resultado(casa, len(casa))

class ClienteFalso:
    auth = _Auth()
    def table(self, nome): return _Consulta(nome)
    class _PG:
        class _S: _transport = None
        session = _S()
    postgrest = _PG()

def create_client(url, key): return ClienteFalso()
Client = ClienteFalso

mod = types.ModuleType("supabase")
mod.create_client = create_client
mod.Client = ClienteFalso
sys.modules["supabase"] = mod

# ---------- redis ----------
CONTADORES = {}
class _Pipeline:
    def __init__(self): self.ops = []
    def incr(self, k): self.ops.append(("incr", k)); return self
    def expire(self, k, s): self.ops.append(("expire", k, s)); return self
    def execute(self):
        saida = []
        for op in self.ops:
            if op[0] == "incr":
                CONTADORES[op[1]] = CONTADORES.get(op[1], 0) + 1
                saida.append(CONTADORES[op[1]])
            else:
                saida.append(True)
        return saida

class RedisFalso:
    @classmethod
    def from_url(cls, url, **k): return cls()
    def pipeline(self): return _Pipeline()

rmod = types.ModuleType("redis")
rmod.Redis = RedisFalso
sys.modules["redis"] = rmod


# ---------- celery ----------
TAREFAS = []
class _Tarefa:
    def delay(self, *a, **k): TAREFAS.append((a, k))
class _Celery:
    def __init__(self, *a, **k): pass
    def task(self, *a, **k):
        def envolve(f): return _Tarefa()
        return envolve
    def config_from_object(self, *a, **k): pass
    conf = type("c", (), {"update": lambda self, **k: None})()

cmod = types.ModuleType("celery")
cmod.Celery = _Celery
sys.modules["celery"] = cmod
