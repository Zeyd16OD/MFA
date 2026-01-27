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


# ============================================================
# FONCTIONNALITÉ 1: PARTAGE DE DOCUMENTS (DAC - Matrice HRU)
# ============================================================

class DocumentCreate(BaseModel):
    """Création d'un document par un employé (propriétaire)"""
    title: str
    content: str
    is_confidential: bool = False


class DocumentUpdate(BaseModel):
    """Mise à jour d'un document (requiert permission 'write')"""
    title: Optional[str] = None
    content: Optional[str] = None
    is_confidential: Optional[bool] = None


class DocumentResponse(BaseModel):
    """Réponse document"""
    id: int
    owner_id: int
    owner_email: str
    title: str
    content: str
    is_confidential: bool
    created_at: str


class DocumentShareDAC(BaseModel):
    """Partage DAC pur - Faiblesse: peut être re-partagé (propagation non contrôlée)"""
    document_id: int
    target_user_id: int
    permissions: List[Literal["read", "write", "share"]]  # share = peut re-partager (FAIBLESSE!)


class DocumentShareSecure(BaseModel):
    """Partage Sécurisé - Solution: flag 'transfer_only' empêche re-partage"""
    document_id: int
    target_user_id: int
    permissions: List[Literal["read", "write"]]
    can_reshare: bool = False  # SOLUTION: Par défaut, impossible de re-partager


class DocumentACLEntry(BaseModel):
    """Entrée ACL pour un document"""
    id: int
    document_id: int
    user_id: int
    user_email: str
    permissions: List[str]
    can_reshare: bool  # False = "transfer_only" flag
    granted_by: int
    granted_by_email: str
    is_dac_mode: bool  # True = DAC pur (vulnérable), False = Sécurisé
    created_at: str


# ============================================================
# FONCTIONNALITÉ 2: DÉLÉGATION DE DROITS (DAC - Take-Grant)
# ============================================================

class DelegationCreateDAC(BaseModel):
    """Délégation DAC pur (Take-Grant) - Faiblesse: peut re-déléguer sans limite"""
    delegate_to_user_id: int
    rights: List[Literal["approve_leave", "view_requests", "delegate"]]  # delegate = peut re-déléguer (FAIBLESSE!)


class DelegationCreateSecure(BaseModel):
    """Délégation Sécurisée - Solution: profondeur limitée + expiration"""
    delegate_to_user_id: int
    rights: List[Literal["approve_leave", "view_requests"]]
    max_depth: int = 1  # SOLUTION 1: Profondeur de re-délégation (0 = ne peut pas re-déléguer)
    expires_in_hours: int = 24  # SOLUTION 2: Expiration temporelle


class DelegationResponse(BaseModel):
    """Réponse délégation"""
    id: int
    delegator_id: int
    delegator_email: str
    delegate_id: int
    delegate_email: str
    rights: List[str]
    can_redelegate: bool  # DAC mode
    max_depth: int  # Secure mode (0 = cannot redelegate)
    current_depth: int  # Current chain depth
    expires_at: Optional[str]
    is_dac_mode: bool
    is_active: bool
    created_at: str
