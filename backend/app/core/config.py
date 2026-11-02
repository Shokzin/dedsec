from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import json


class Settings(BaseSettings):
    environment: str = "development"
    secret_key: str = "change-me"
    # Guardado como texto de proposito: o pydantic-settings tenta interpretar
    # como JSON todo campo de tipo composto lido do ambiente, e falha na
    # partida se o valor nao for JSON. A conversao fica na propriedade abaixo.
    allowed_origins_texto: str = Field(
        default="http://localhost:5173",
        validation_alias="ALLOWED_ORIGINS",
    )

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    redis_url: str = "redis://redis:6379/0"

    # Limitacao de requisicoes. Criar analise e a operacao cara: clona um
    # repositorio e ocupa um processo trabalhador, por isso o limite e menor.
    rate_limit_criar_analise_min: int = 5
    rate_limit_criar_analise_hora: int = 30
    rate_limit_leitura_min: int = 120
    rate_limit_remocao_min: int = 20
    rate_limit_conta_hora: int = 3

    scan_tmp_dir: str = "/tmp/scans"
    max_repo_size_mb: int = 100
    scan_timeout_seconds: int = 300

    @property
    def allowed_origins(self) -> list[str]:
        """
        Aceita tanto "https://a.com,https://b.com" quanto um JSON. O painel da
        hospedagem oferece um campo de texto simples, e exigir JSON ali faria a
        aplicacao nao subir por causa de um colchete esquecido.
        """
        texto = (self.allowed_origins_texto or "").strip()
        if not texto:
            return []
        if texto.startswith("["):
            try:
                return [str(x) for x in json.loads(texto)]
            except json.JSONDecodeError:
                return []
        return [parte.strip() for parte in texto.split(",") if parte.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()