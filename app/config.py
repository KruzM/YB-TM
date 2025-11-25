from datetime import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Yecny Bookkeeping Platform"
    secret_key: str = "change-this-secret"
    access_token_expire_minutes: int = 60
    sqlalchemy_database_uri: str = "sqlite:///./data.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def token_expire_timedelta(self) -> timedelta:
        return timedelta(minutes=self.access_token_expire_minutes)


def get_settings() -> Settings:
    return Settings()
