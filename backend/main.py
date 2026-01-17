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
    EncryptedMessage, LeaveRequest, MessageInDB,
    LeaveRequestCreate, LeaveRequestUpdate, LeaveRequestResponse,
    CommunicationAuthResponse, CommunicationAuthUpdate
)
from typing import List
from security import (
    verify_password, get_password_hash, create_access_token,
    decode_access_token, generate_otp,
    generate_dh_parameters, generate_dh_private_key,
    calculate_dh_public_key, calculate_dh_shared_secret,
    derive_aes_key_from_secret, aes_decrypt, aes_encrypt
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
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173"],  # Vite ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
    # Check if login is blocked
    is_blocked, remaining_seconds = db.is_login_blocked(request.email)
    if is_blocked:
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives. Réessayez dans {minutes}m {seconds}s"
        )
    
    # Check if user exists
    user = db.get_user_by_email(request.email)
    if not user:
        db.record_login_attempt(request.email, False)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Erreur utilisateur n'existe pas"
        )
    
    # Verify password
    if not verify_password(request.password, user['password_hash']):
        db.record_login_attempt(request.email, False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect"
        )
    
    # Success - reset login attempts
    db.record_login_attempt(request.email, True)
    
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
    # Check if OTP verification is blocked
    is_blocked, remaining_seconds = db.is_otp_blocked(request.email)
    if is_blocked:
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives OTP. Réessayez dans {minutes}m {seconds}s"
        )
    
    # Verify OTP
    if not db.verify_otp(request.email, request.otp_code):
        db.record_otp_attempt(request.email, False)
        # Invalider l'OTP existant pour forcer l'utilisateur à recommencer
        db.cancel_otp(request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Code OTP invalide. Veuillez vous reconnecter."
        )
    
    # Success - reset OTP attempts
    db.record_otp_attempt(request.email, True)
    
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


@app.post("/auth/resend-otp")
async def resend_otp(request: LoginRequest, background_tasks: BackgroundTasks):
    """
    Resend OTP code. Expires the old one and generates a new one.
    """
    # Check if OTP verification is blocked
    is_blocked, remaining_seconds = db.is_otp_blocked(request.email)
    if is_blocked:
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives OTP. Réessayez dans {minutes}m {seconds}s"
        )
    
    # Verify user exists and password is correct
    user = db.get_user_by_email(request.email)
    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Generate new OTP (this will automatically remove the old one)
    otp_code = generate_otp(settings.OTP_LENGTH)
    db.store_otp(request.email, otp_code)
    
    # Send OTP via email
    background_tasks.add_task(send_otp_email, request.email, otp_code)
    
    return {
        "message": "Nouveau code OTP envoyé à votre email",
        "email": request.email
    }


@app.post("/auth/cancel-otp")
async def cancel_otp(request: dict):
    """
    Cancel current OTP session and reset attempts.
    """
    email = request.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    # Cancel OTP and reset attempts
    db.cancel_otp(email)
    
    return {"message": "OTP session cancelled"}


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
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Échec du déchiffrement: Ce message a été chiffré avec une clé différente. "
                   "Il s'agit probablement d'un ancien message incompatible. "
                   "Veuillez effectuer un nouvel échange de clés DH ou supprimer ce message."
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Échec du déchiffrement: Le contenu déchiffré n'est pas un JSON valide. "
                   "Message corrompu ou clé incorrecte."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Échec du déchiffrement: {str(e)}"
        )


@app.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Supprimer un message. HR Manager et Admin peuvent supprimer.
    """
    if current_user['role'] not in ["hr_manager", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls le DRH et l'Admin peuvent supprimer des messages"
        )
    
    message = db.messages.get(doc_id=message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message non trouvé"
        )
    
    db.messages.remove(doc_ids=[message_id])
    
    return {"message": "Message supprimé avec succès"}


@app.post("/messages/cleanup-incompatible")
async def cleanup_incompatible_messages(current_user: dict = Depends(get_current_user)):
    """
    Tester et nettoyer les messages incompatibles (ne peuvent pas être déchiffrés).
    """
    if current_user['role'] not in ["hr_manager", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    # Get HR's session
    hr_session = db.get_session(current_user.doc_id)
    if not hr_session or not hr_session.get('shared_secret'):
        return {
            "message": "Aucun secret partagé. Impossible de tester les messages.",
            "deleted_count": 0
        }
    
    # Derive AES key
    shared_secret = int(hr_session['shared_secret'], 16)
    aes_key = derive_aes_key_from_secret(shared_secret)
    
    # Test all messages
    all_messages = db.messages.all()
    incompatible_ids = []
    
    for msg in all_messages:
        try:
            decrypted = aes_decrypt(msg['encrypted_content'], msg['iv'], aes_key)
            json.loads(decrypted)  # Verify it's valid JSON
        except:
            incompatible_ids.append(msg.doc_id)
    
    # Delete incompatible messages
    if incompatible_ids:
        db.messages.remove(doc_ids=incompatible_ids)
    
    return {
        "message": f"{len(incompatible_ids)} message(s) incompatible(s) supprimé(s)",
        "deleted_count": len(incompatible_ids),
        "deleted_ids": incompatible_ids
    }


# ==================== LEAVE/ABSENCE REQUEST ENDPOINTS ====================

@app.post("/leave-requests", response_model=dict)
async def create_leave_request(
    request_data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Employee creates a new leave/absence request.
    Only employees can create requests.
    This also creates a communication authorization request for admin approval.
    """
    if current_user['role'] != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les employés peuvent créer des demandes"
        )
    
    # Create the leave request
    request_id = db.create_leave_request(
        employee_id=current_user.doc_id,
        employee_email=current_user['email'],
        type=request_data.type,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
        reason=request_data.reason,
        days_count=request_data.days_count
    )
    
    # Create a communication authorization request for admin approval
    auth_id = db.create_communication_auth(
        leave_request_id=request_id,
        employee_id=current_user.doc_id,
        employee_email=current_user['email']
    )
    
    return {
        "message": "Demande créée avec succès. En attente d'autorisation de l'admin pour l'envoi sécurisé.",
        "request_id": request_id,
        "auth_id": auth_id,
        "status": "pending_admin"
    }


@app.get("/leave-requests/my-requests", response_model=List[LeaveRequestResponse])
async def get_my_leave_requests(current_user: dict = Depends(get_current_user)):
    """
    Employee views their own leave requests.
    Only employees can access this endpoint.
    """
    if current_user['role'] != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    requests = db.get_leave_requests_by_employee(current_user.doc_id)
    
    result = []
    for req in requests:
        result.append(LeaveRequestResponse(
            id=req.doc_id,
            employee_id=req['employee_id'],
            employee_email=req['employee_email'],
            type=req['type'],
            start_date=req['start_date'],
            end_date=req['end_date'],
            reason=req['reason'],
            days_count=req['days_count'],
            status=req['status'],
            hr_comment=req.get('hr_comment'),
            created_at=req['created_at'],
            updated_at=req.get('updated_at')
        ))
    
    return result


@app.get("/leave-requests/all", response_model=List[LeaveRequestResponse])
async def get_all_leave_requests(current_user: dict = Depends(get_current_user)):
    """
    HR Manager views all leave requests.
    Only HR Managers can access this endpoint.
    Admin cannot access this.
    """
    if current_user['role'] != "hr_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le DRH peut voir toutes les demandes"
        )
    
    requests = db.get_all_leave_requests()
    
    result = []
    for req in requests:
        # Vérifier si cette demande a été autorisée par l'admin
        # Ne pas afficher les demandes dont l'autorisation a été refusée
        comm_auth = db.get_communication_auth_by_leave_request(req.doc_id)
        if comm_auth and comm_auth['status'] == 'rejected':
            # Demande refusée par l'admin, ne pas l'afficher au RH
            continue
        
        result.append(LeaveRequestResponse(
            id=req.doc_id,
            employee_id=req['employee_id'],
            employee_email=req['employee_email'],
            type=req['type'],
            start_date=req['start_date'],
            end_date=req['end_date'],
            reason=req['reason'],
            days_count=req['days_count'],
            status=req['status'],
            hr_comment=req.get('hr_comment'),
            created_at=req['created_at'],
            updated_at=req.get('updated_at')
        ))
    
    return result


@app.put("/leave-requests/{request_id}/status")
async def update_leave_request_status(
    request_id: int,
    update_data: LeaveRequestUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    HR Manager updates the status of a leave request (approve/reject).
    Only HR Managers can update status.
    """
    if current_user['role'] != "hr_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le DRH peut valider les demandes"
        )
    
    # Check if request exists
    request = db.get_leave_request(request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demande non trouvée"
        )
    
    # Update status
    db.update_leave_request_status(
        request_id=request_id,
        status=update_data.status,
        hr_comment=update_data.hr_comment
    )
    
    return {"message": f"Demande {update_data.status} avec succès"}


@app.delete("/leave-requests/{request_id}")
async def delete_leave_request(
    request_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Employee deletes their own pending leave request.
    Only the owner can delete, and only if status is pending.
    """
    if current_user['role'] != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    # Check if request exists and belongs to the user
    request = db.get_leave_request(request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demande non trouvée"
        )
    
    if request['employee_id'] != current_user.doc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez supprimer que vos propres demandes"
        )
    
    if request['status'] != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez supprimer que les demandes en attente"
        )
    
    db.delete_leave_request(request_id)
    
    return {"message": "Demande supprimée avec succès"}


# ==================== COMMUNICATION AUTHORIZATION ENDPOINTS ====================

@app.get("/communication-auth/pending", response_model=List[CommunicationAuthResponse])
async def get_pending_communication_auths(current_user: dict = Depends(get_current_user)):
    """
    Admin gets all pending communication authorization requests.
    """
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'admin peut voir les demandes d'autorisation"
        )
    
    auths = db.get_pending_communication_auths()
    result = []
    for auth in auths:
        result.append(CommunicationAuthResponse(
            id=auth.doc_id,
            leave_request_id=auth['leave_request_id'],
            employee_id=auth['employee_id'],
            employee_email=auth['employee_email'],
            status=auth['status'],
            created_at=auth['created_at'],
            approved_at=auth.get('approved_at'),
            rejected_at=auth.get('rejected_at')
        ))
    return result


@app.get("/communication-auth/all", response_model=List[CommunicationAuthResponse])
async def get_all_communication_auths(current_user: dict = Depends(get_current_user)):
    """
    Admin gets all communication authorization requests.
    """
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'admin peut voir les demandes d'autorisation"
        )
    
    auths = db.get_all_communication_auths()
    result = []
    for auth in auths:
        result.append(CommunicationAuthResponse(
            id=auth.doc_id,
            leave_request_id=auth['leave_request_id'],
            employee_id=auth['employee_id'],
            employee_email=auth['employee_email'],
            status=auth['status'],
            created_at=auth['created_at'],
            approved_at=auth.get('approved_at'),
            rejected_at=auth.get('rejected_at')
        ))
    return result


@app.put("/communication-auth/{auth_id}")
async def update_communication_auth(
    auth_id: int,
    update_data: CommunicationAuthUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Admin approves or rejects a communication authorization request.
    If approved, key exchange is performed and message is sent to HR.
    """
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'admin peut gérer les autorisations"
        )
    
    # Get the communication auth
    auth = db.get_communication_auth(auth_id)
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Autorisation non trouvée"
        )
    
    if auth['status'] != 'pending_admin':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette demande a déjà été traitée"
        )
    
    if update_data.action == "reject":
        # Reject the authorization
        db.update_communication_auth_status(auth_id, 'rejected')
        
        # Also update the leave request status - commentaire pour l'employé
        db.update_leave_request_status(
            auth['leave_request_id'], 
            'rejected', 
            "Demande d'envoi de requête non autorisée par l'admin"
        )
        
        return {"message": "Autorisation de communication refusée"}
    
    elif update_data.action == "approve":
        # Update status to approved
        db.update_communication_auth_status(auth_id, 'approved')
        
        # Get the leave request data
        leave_request = db.get_leave_request(auth['leave_request_id'])
        if not leave_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Demande de congé non trouvée"
            )
        
        # Get DH params
        params = db.get_dh_params()
        if not params:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="DH parameters not available"
            )
        
        p = int(params['p'], 16)
        g = int(params['g'], 16)
        
        # Generate server-side keys for this communication
        server_private_key = generate_dh_private_key(p)
        server_public_key = calculate_dh_public_key(g, server_private_key, p)
        
        # Store session with private key
        db.store_session(auth['employee_id'], hex(server_private_key))
        
        # For now, we simulate the key exchange and encrypt the message
        # In a real scenario, we would use the client's public key
        # Here we use a simplified approach where the server handles the encryption
        
        # Create a shared secret (simplified - server creates and stores both keys)
        shared_secret = calculate_dh_shared_secret(server_public_key, server_private_key, p)
        aes_key = derive_aes_key_from_secret(shared_secret)
        
        # Update session with shared secret
        db.update_session_secret(auth['employee_id'], hex(shared_secret))
        
        # Prepare the leave request content
        leave_content = json.dumps({
            "employee_name": leave_request['employee_email'],
            "start_date": leave_request['start_date'],
            "end_date": leave_request['end_date'],
            "days": leave_request['days_count'],
            "reason": leave_request['reason'],
            "type": leave_request['type']
        })
        
        # Encrypt the content using aes_encrypt from security.py
        encrypted_content, iv = aes_encrypt(leave_content, aes_key)
        
        # Get HR manager
        hr_users = db.get_users_by_role("hr_manager")
        if not hr_users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No HR manager found"
            )
        hr_manager = hr_users[0]
        
        # Store the encrypted message
        msg_id = db.store_message(
            from_id=auth['employee_id'],
            to_id=hr_manager.doc_id,
            encrypted_content=encrypted_content,
            iv=iv
        )
        
        # Update authorization status
        db.update_communication_auth_status(auth_id, 'message_sent')
        
        return {
            "message": "Communication autorisée. Clés générées et message chiffré envoyé au RH.",
            "status": "message_sent"
        }


@app.get("/communication-auth/my-requests")
async def get_my_communication_auths(current_user: dict = Depends(get_current_user)):
    """
    Employee gets their own communication authorization status.
    """
    if current_user['role'] != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    auths = db.get_communication_auth_by_employee(current_user.doc_id)
    result = []
    for auth in auths:
        result.append({
            "id": auth.doc_id,
            "leave_request_id": auth['leave_request_id'],
            "status": auth['status'],
            "created_at": auth['created_at'],
            "approved_at": auth.get('approved_at'),
            "rejected_at": auth.get('rejected_at')
        })
    return result


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
