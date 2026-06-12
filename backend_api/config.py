import os
import secrets
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


class Settings:
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'pl_calculator.db'}")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-this-secret-before-production")
    jwt_expire_hours: int = int(os.getenv("JWT_EXPIRE_HOURS", "24"))
    admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "admin123456")
    cors_origins: list[str] = [
        item.strip()
        for item in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if item.strip()
    ]
    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:5173")
    default_public_access_code: str = os.getenv("DEFAULT_PUBLIC_ACCESS_CODE", "xhk2026")

    def ensure_production_safe(self) -> None:
        if os.getenv("ENV", "development") == "production":
            if self.jwt_secret == "dev-only-change-this-secret-before-production":
                raise RuntimeError("JWT_SECRET must be configured in production")
            if self.admin_password == "admin123456":
                raise RuntimeError("ADMIN_PASSWORD must be changed in production")


settings = Settings()


def make_token() -> str:
    return secrets.token_urlsafe(32)
