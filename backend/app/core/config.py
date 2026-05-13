"""Variables de entorno (Pydantic Settings)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://app_gantt:app_gantt@localhost:5432/app_gantt",
        description="SQLAlchemy / Alembic",
    )
    jwt_secret: str = Field(default="change_me_dev_only_not_for_prod")
    jwt_alg: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60, ge=1, le=60 * 24 * 7)
    app_timezone: str = Field(default="America/Argentina/Buenos_Aires")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        description="Lista separada por comas",
    )
    app_env: str = Field(
        default="development",
        description="Entorno: development, staging o production.",
    )
    http_max_body_bytes: int = Field(
        default=524_288,
        ge=8_192,
        le=20 * 1024 * 1024,
        description="Tamaño máximo aproximado del body (Content-Length) en bytes",
    )
    bootstrap_admin_email: str | None = Field(default=None)
    bootstrap_admin_password: str | None = Field(default=None)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
