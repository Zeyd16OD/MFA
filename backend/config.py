from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Email Configuration
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Database
    DATABASE_PATH: str = "db.json"
    
    # OTP Configuration
    OTP_EXPIRATION_MINUTES: int = 5
    OTP_LENGTH: int = 6
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
