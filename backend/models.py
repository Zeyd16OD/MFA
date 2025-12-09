from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime


# User Models
class UserBase(BaseModel):
    email: EmailStr
    role: Literal["admin", "hr_manager", "employee"]


class UserCreate(UserBase):
    password: str


class UserInDB(UserBase):
    id: int
    password_hash: str
    public_key_certificate: Optional[str] = None


class User(UserBase):
    id: int
    public_key_certificate: Optional[str] = None


# Authentication Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


# Diffie-Hellman Models
class DHParams(BaseModel):
    p: str  # Prime number as string (hex)
    g: str  # Generator as string (hex)


class DHExchangeRequest(BaseModel):
    public_key: str  # Client's public key A (hex string)


class DHExchangeResponse(BaseModel):
    public_key: str  # Server's public key B (hex string)


# Encrypted Message Models
class EncryptedMessage(BaseModel):
    encrypted_content: str  # Base64 encoded
    iv: str  # Initialization Vector (Base64)


class LeaveRequest(BaseModel):
    employee_name: str
    start_date: str
    end_date: str
    reason: str
    days: int


class MessageInDB(BaseModel):
    id: int
    from_id: int
    to_id: int
    encrypted_content: str
    iv: str
    timestamp: str


# OTP Models
class OTPInDB(BaseModel):
    email: str
    code: str
    expiration: str
