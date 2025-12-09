from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import Optional
from contextlib import asynccontextmanager
import json

from config import settings
from models import (
    LoginRequest, OTPVerifyRequest, Token, UserCreate, User,
    DHParams, DHExchangeRequest, DHExchangeResponse,
    EncryptedMessage, LeaveRequest, MessageInDB
)
from security import (
    verify_password, get_password_hash, create_access_token,
    decode_access_token, generate_otp,
    generate_dh_parameters, generate_dh_private_key,
    calculate_dh_public_key, calculate_dh_shared_secret,
    derive_aes_key_from_secret, aes_decrypt
)
from database import db

# Startup Event: Initialize TTP (Trusted Third Party)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the system on startup."""
    # Generate and store DH parameters if not exists
    params = db.get_dh_params()
    if not params:
        print("Generating Diffie-Hellman parameters...")
        p, g = generate_dh_parameters()
        db.store_dh_params(hex(p), hex(g))
        print(f"DH Parameters generated: p={hex(p)[:20]}..., g={g}")
    
    # Create default users if database is empty
    if not db.users.all():
        print("Creating default users...")
        
        # Create IT Admin
        admin_id = db.create_user(
            email="zeydody@gmail.com",
            password_hash=get_password_hash("admin123"),
            role="admin"
        )
        print(f"Admin created: zeydody@gmail.com / admin123 (ID: {admin_id})")
        
        # Create HR Manager
        hr_id = db.create_user(
            email="zakarialaidi6@gmail.com",
            password_hash=get_password_hash("hr123"),
            role="hr_manager"
        )
        print(f"HR Manager created: zakarialaidi6@gmail.com / hr123 (ID: {hr_id})")
        
        # Create Employee
        emp_id = db.create_user(
            email="abdoumerabet374@gmail.com",
            password_hash=get_password_hash("emp123"),
            role="employee"
        )
        print(f"Employee created: abdoumerabet374@gmail.com / emp123 (ID: {emp_id})")
    
    yield
    # Cleanup (if needed)


# Initialize FastAPI
app = FastAPI(title="Secure HR Management System", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],  # Vite ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Email Configuration
mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fast_mail = FastMail(mail_config)

# Security
security = HTTPBearer()


# Dependency: Get Current User from JWT
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Extract and verify JWT token."""
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    email = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    user = db.get_user_by_email(email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


# Background task to send email
async def send_otp_email(email: str, otp_code: str):
    """Send OTP email."""
    message = MessageSchema(
        subject="Your OTP Code - HR System",
        recipients=[email],
        body=f"""
        <h2>Authentication Required</h2>
        <p>Your OTP code is: <strong>{otp_code}</strong></p>
        <p>This code will expire in {settings.OTP_EXPIRATION_MINUTES} minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        """,
        subtype="html"
    )
    
    try:
        await fast_mail.send_message(message)
        print(f"OTP email sent to {email}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/auth/login")
async def login(request: LoginRequest, background_tasks: BackgroundTasks):
    """
    Step 1: Authenticate user with email/password.
    If valid, generate and send OTP.
    """
    user = db.get_user_by_email(request.email)
    
    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Generate OTP
    otp_code = generate_otp(settings.OTP_LENGTH)
    db.store_otp(request.email, otp_code)
    
    # Send OTP via email
    background_tasks.add_task(send_otp_email, request.email, otp_code)
    
    return {
        "message": "OTP sent to your email",
        "email": request.email
    }


@app.post("/auth/verify-otp", response_model=Token)
async def verify_otp(request: OTPVerifyRequest):
    """
    Step 2: Verify OTP and issue JWT token.
    """
    if not db.verify_otp(request.email, request.otp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP"
        )
    
    # Get user
    user = db.get_user_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user['email'],
            "role": user['role'],
            "user_id": user.doc_id
        }
    )
    
    return Token(access_token=access_token)


@app.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return User(
        id=current_user.doc_id,
        email=current_user['email'],
        role=current_user['role'],
        public_key_certificate=current_user.get('public_key_certificate')
    )


# ==================== DIFFIE-HELLMAN HANDSHAKE ====================

@app.get("/handshake/params", response_model=DHParams)
async def get_dh_params():
    """
    Get global Diffie-Hellman parameters (p, g) from TTP.
    """
    params = db.get_dh_params()
    if not params:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DH parameters not initialized"
        )
    
    return DHParams(p=params['p'], g=params['g'])


@app.post("/handshake/exchange", response_model=DHExchangeResponse)
async def dh_exchange(
    request: DHExchangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Diffie-Hellman Key Exchange.
    Employee sends their public key A, server (HR) responds with public key B.
    """
    # Get DH parameters
    params = db.get_dh_params()
    p = int(params['p'], 16)
    g = int(params['g'], 16)
    
    # Parse client's public key A
    try:
        client_public_key = int(request.public_key, 16)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid public key format"
        )
    
    # Get or create HR Manager's private key for this session
    hr_users = db.get_users_by_role("hr_manager")
    if not hr_users:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="HR Manager not found"
        )
    
    hr_user = hr_users[0]
    hr_user_id = hr_user.doc_id
    
    # Check if HR has a session
    hr_session = db.get_session(hr_user_id)
    if not hr_session:
        # Generate new private key for HR
        hr_private_key = generate_dh_private_key(p)
        db.store_session(hr_user_id, hex(hr_private_key))
    else:
        hr_private_key = int(hr_session['private_key'], 16)
    
    # Calculate HR's public key B
    hr_public_key = calculate_dh_public_key(g, hr_private_key, p)
    
    # Calculate shared secret S = A^b mod p
    shared_secret = calculate_dh_shared_secret(client_public_key, hr_private_key, p)
    
    # Store shared secret for this employee
    db.store_session(current_user.doc_id, hex(0), hex(shared_secret))  # Private key not needed for employee
    
    # Update HR's session with shared secret
    db.update_session_secret(hr_user_id, hex(shared_secret))
    
    return DHExchangeResponse(public_key=hex(hr_public_key))


# ==================== ENCRYPTED MESSAGING ====================

@app.post("/requests/leave")
async def submit_leave_request(
    message: EncryptedMessage,
    current_user: dict = Depends(get_current_user)
):
    """
    Employee submits encrypted leave request.
    """
    # Get HR Manager
    hr_users = db.get_users_by_role("hr_manager")
    if not hr_users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HR Manager not found"
        )
    
    hr_user = hr_users[0]
    
    # Store encrypted message
    msg_id = db.store_message(
        from_id=current_user.doc_id,
        to_id=hr_user.doc_id,
        encrypted_content=message.encrypted_content,
        iv=message.iv
    )
    
    return {
        "message": "Leave request submitted successfully",
        "message_id": msg_id
    }


@app.get("/messages/received")
async def get_received_messages(current_user: dict = Depends(get_current_user)):
    """
    Get all encrypted messages received by current user.
    """
    messages = db.get_messages_for_user(current_user.doc_id)
    
    result = []
    for msg in messages:
        sender = db.get_user_by_id(msg['from_id'])
        result.append({
            "id": msg.doc_id,
            "from_email": sender['email'] if sender else "Unknown",
            "from_role": sender['role'] if sender else "Unknown",
            "encrypted_content": msg['encrypted_content'],
            "iv": msg['iv'],
            "timestamp": msg['timestamp']
        })
    
    return result


@app.post("/messages/{message_id}/decrypt")
async def decrypt_message(
    message_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Decrypt a specific message (HR Manager only).
    """
    # Only HR Manager can decrypt
    if current_user['role'] != "hr_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR Manager can decrypt messages"
        )
    
    # Get message
    message = db.messages.get(doc_id=message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Get HR's session to retrieve shared secret
    hr_session = db.get_session(current_user.doc_id)
    if not hr_session or not hr_session.get('shared_secret'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shared secret not established. Complete handshake first."
        )
    
    # Derive AES key from shared secret
    shared_secret = int(hr_session['shared_secret'], 16)
    aes_key = derive_aes_key_from_secret(shared_secret)
    
    # Decrypt message
    try:
        decrypted_content = aes_decrypt(
            message['encrypted_content'],
            message['iv'],
            aes_key
        )
        
        # Parse JSON
        leave_request = json.loads(decrypted_content)
        
        return {
            "message_id": message_id,
            "decrypted_content": leave_request,
            "from_id": message['from_id'],
            "timestamp": message['timestamp']
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decryption failed: {str(e)}"
        )


# ==================== ADMIN ENDPOINTS ====================

@app.post("/admin/users", response_model=User)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Admin creates a new user account.
    """
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create users"
        )
    
    # Check if user already exists
    existing_user = db.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )
    
    # Create user
    user_id = db.create_user(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role
    )
    
    created_user = db.get_user_by_id(user_id)
    
    return User(
        id=created_user.doc_id,
        email=created_user['email'],
        role=created_user['role']
    )


@app.get("/admin/messages")
async def get_all_messages_admin(current_user: dict = Depends(get_current_user)):
    """
    Admin view: Get all messages in the system.
    """
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can view all messages"
        )
    
    messages = db.get_all_messages()
    
    result = []
    for msg in messages:
        sender = db.get_user_by_id(msg['from_id'])
        receiver = db.get_user_by_id(msg['to_id'])
        
        result.append({
            "id": msg.doc_id,
            "from": sender['email'] if sender else "Unknown",
            "to": receiver['email'] if receiver else "Unknown",
            "timestamp": msg['timestamp'],
            "encrypted": True
        })
    
    return result


# ==================== HEALTH CHECK ====================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "Secure HR Management System",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
