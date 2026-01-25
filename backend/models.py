from pydantic import BaseModel, EmailStr
from typing import Optional, Literal, List
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


# Leave/Absence Request Models
class LeaveRequestCreate(BaseModel):
    type: Literal["absence", "conge"]  # Type de demande
    start_date: str  # Format: YYYY-MM-DD
    end_date: str
    reason: str
    days_count: int


class LeaveRequestUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected"]
    hr_comment: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: int
    employee_email: str
    type: str
    start_date: str
    end_date: str
    reason: str
    days_count: int
    status: str
    hr_comment: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


# OTP Models
class OTPInDB(BaseModel):
    email: str
    code: str
    expiration: str


# Communication Authorization Models (Admin approves before key exchange)
class CommunicationAuthRequest(BaseModel):
    leave_request_id: int


class CommunicationAuthResponse(BaseModel):
    id: int
    leave_request_id: int
    employee_id: int
    employee_email: str
    status: str  # pending_admin, approved, rejected, key_exchanged, message_sent
    created_at: str
    approved_at: Optional[str] = None
    rejected_at: Optional[str] = None


class CommunicationAuthUpdate(BaseModel):
    action: Literal["approve", "reject"]


# ==================== DAC (Discretionary Access Control) Models ====================

class DACPermission(BaseModel):
    """Permission types for DAC"""
    read: bool = False
    write: bool = False
    delete: bool = False
    share: bool = False  # Can share with others (DAC weakness: propagation)


class DACDocumentCreate(BaseModel):
    """Create a new document with DAC"""
    title: str
    content: str
    is_confidential: bool = False


class DACDocumentUpdate(BaseModel):
    """Update document content"""
    title: Optional[str] = None
    content: Optional[str] = None


class DACShareRequest(BaseModel):
    """Share document with another user"""
    target_user_id: int
    permissions: DACPermission


class DACDocumentResponse(BaseModel):
    """Document response with permissions"""
    id: int
    title: str
    content: str
    owner_id: int
    owner_email: str
    is_confidential: bool
    created_at: str
    updated_at: Optional[str] = None
    my_permissions: DACPermission
    shared_with: Optional[List[dict]] = None  # List of users with their permissions


class DACDocumentCopy(BaseModel):
    """Copy document to create a new one (DAC weakness: data duplication)"""
    new_title: str


class DACAuditLog(BaseModel):
    """Audit log for DAC operations - shows security issues"""
    id: int
    action: str  # created, shared, copied, accessed, modified, deleted
    document_id: int
    document_title: str
    actor_id: int
    actor_email: str
    target_user_id: Optional[int] = None
    target_user_email: Optional[str] = None
    details: str
    timestamp: str
    security_warning: Optional[str] = None  # Highlights DAC weaknesses
