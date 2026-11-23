from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./secure_id.db"
    signing_key: str = ""  # base64url Ed25519 private seed (32 bytes)
    jwt_secret: str = "dev-only-secret-change-me-in-production-please"
    jwt_expire_minutes: int = 60 * 12
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    institution_name: str = "SVNIT Surat"
    cors_origins: str = "http://localhost:5173"
    seed_demo: bool = False
    default_validity_days: int = 365

    @property
    def cors_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        # Neon / Render hand out postgres:// URLs; SQLAlchemy needs the driver name.
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
