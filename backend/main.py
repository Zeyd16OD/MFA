from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import Optional
from contextlib import asynccontextmanager
import json
from datetime import datetime, timedelta

from config import settings
from models import (
    LoginRequest, OTPVerifyRequest, Token, UserCreate, User,
    DHParams, DHExchangeRequest, DHExchangeResponse,
    EncryptedMessage, LeaveRequest, MessageInDB,
    LeaveRequestCreate, LeaveRequestUpdate, LeaveRequestResponse,
    CommunicationAuthResponse, CommunicationAuthUpdate,
    # DAC Models
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentShareDAC, DocumentShareSecure, DocumentACLEntry,
    DelegationCreateDAC, DelegationCreateSecure, DelegationResponse
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
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5175"],  # Vite ports
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
    
    # Include the document ID in the returned dict for easy access
    user_dict = dict(user)
    user_dict['id'] = user.doc_id
    return user_dict


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
        id=current_user['id'],
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
    HR Managers OR users with delegated 'view_requests' right can access.
    """
    is_hr = current_user['role'] == "hr_manager"
    has_delegation = db.user_has_delegated_right(current_user['id'], 'view_requests')
    
    if not is_hr and not has_delegation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le DRH ou un délégué autorisé peut voir toutes les demandes"
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
    HR Managers OR users with delegated 'approve_leave' right can update.
    """
    is_hr = current_user['role'] == "hr_manager"
    has_delegation = db.user_has_delegated_right(current_user['id'], 'approve_leave')
    
    if not is_hr and not has_delegation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le DRH ou un délégué autorisé peut valider les demandes"
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
        "version": "2.0.0 - DAC Features"
    }


# ================================================================
# FONCTIONNALITÉ 1: PARTAGE DE DOCUMENTS (DAC - Matrice HRU)
# ================================================================
# 
# Implémentation de la matrice de contrôle d'accès selon le modèle HRU:
# - Sujets (S): Utilisateurs du système
# - Objets (O): Documents
# - Actions (A): read, write, share
# 
# FAIBLESSE DAC: L'opérateur "share" permet la propagation non contrôlée des privilèges
# SOLUTION: Flag "transfer_only" (can_reshare=False) empêche la re-propagation
# ================================================================

@app.post("/documents", tags=["DAC - Documents"])
async def create_document(
    doc: DocumentCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Créer un nouveau document. Le créateur devient PROPRIÉTAIRE (own).
    Equivalent à l'opération CREATE dans HRU: create object + enter Own
    """
    user = await get_current_user(credentials)
    
    doc_id = db.create_document(
        owner_id=user['id'],
        owner_email=user['email'],
        title=doc.title,
        content=doc.content,
        is_confidential=doc.is_confidential
    )
    
    return {
        "message": "Document créé avec succès",
        "document_id": doc_id,
        "owner": user['email'],
        "acl_entry": f"A[{user['email']}, doc_{doc_id}] = {{own, read, write, share}}"
    }


@app.put("/documents/{doc_id}", tags=["DAC - Documents"])
async def update_document(
    doc_id: int,
    update_data: DocumentUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Modifier un document (requiert permission 'write').
    Le propriétaire ou tout utilisateur avec 'write' peut modifier.
    """
    user = await get_current_user(credentials)
    
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Vérifier les droits de modification
    is_owner = doc['owner_id'] == user['id']
    user_acl = db.get_user_document_acl(doc_id, user['id'])
    
    if not is_owner:
        if not user_acl:
            raise HTTPException(status_code=403, detail="Vous n'avez pas accès à ce document")
        if 'write' not in user_acl.get('permissions', []):
            raise HTTPException(status_code=403, detail="Permission 'write' requise pour modifier ce document")
    
    # Effectuer la mise à jour
    db.update_document(
        doc_id=doc_id,
        title=update_data.title,
        content=update_data.content,
        is_confidential=update_data.is_confidential
    )
    
    # Récupérer le document mis à jour
    updated_doc = db.get_document(doc_id)
    
    return {
        "message": "Document modifié avec succès",
        "document": {
            "id": updated_doc.doc_id,
            "title": updated_doc['title'],
            "content": updated_doc['content'],
            "is_confidential": updated_doc['is_confidential'],
            "owner_email": updated_doc['owner_email'],
            "updated_at": updated_doc.get('updated_at')
        },
        "modified_by": user['email'],
        "hru_operation": f"WRITE: {user['email']} modified doc_{doc_id}"
    }


@app.get("/documents", tags=["DAC - Documents"])
async def get_my_documents(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Récupérer mes documents (propriétaire) et ceux partagés avec moi."""
    user = await get_current_user(credentials)
    
    # Documents dont je suis propriétaire
    owned = db.get_documents_by_owner(user['id'])
    owned_docs = []
    for doc in owned:
        owned_docs.append({
            "id": doc.doc_id,
            "title": doc['title'],
            "content": doc['content'],
            "is_confidential": doc['is_confidential'],
            "owner_email": doc['owner_email'],
            "is_owner": True,
            "permissions": ["own", "read", "write", "share"],
            "created_at": doc['created_at']
        })
    
    # Documents partagés avec moi
    acls = db.get_acls_for_user(user['id'])
    shared_docs = []
    for acl in acls:
        doc = db.get_document(acl['document_id'])
        if doc:
            shared_docs.append({
                "id": doc.doc_id,
                "title": doc['title'],
                "content": doc['content'] if 'read' in acl['permissions'] else "[ACCÈS REFUSÉ]",
                "is_confidential": doc['is_confidential'],
                "owner_email": doc['owner_email'],
                "is_owner": False,
                "permissions": acl['permissions'],
                "can_reshare": acl['can_reshare'],
                "is_dac_mode": acl['is_dac_mode'],
                "granted_by": acl['granted_by_email'],
                "created_at": acl['created_at']
            })
    
    return {
        "owned_documents": owned_docs,
        "shared_documents": shared_docs
    }


@app.post("/documents/share/dac", tags=["DAC - Documents"])
async def share_document_dac(
    share: DocumentShareDAC,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    🔴 MODE DAC (VULNÉRABLE) - Partage avec propagation possible
    
    Implémente l'opération CONFER avec marque de copie (*):
    - Si 'share' est dans permissions, le destinataire peut RE-PARTAGER
    - FAIBLESSE: Propagation non contrôlée des privilèges (problème de sûreté HRU)
    """
    user = await get_current_user(credentials)
    
    # Vérifier que le document existe
    doc = db.get_document(share.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Vérifier les droits de partage
    is_owner = doc['owner_id'] == user['id']
    user_acl = db.get_user_document_acl(share.document_id, user['id'])
    
    if not is_owner:
        if not user_acl:
            raise HTTPException(status_code=403, detail="Vous n'avez pas accès à ce document")
        if not user_acl.get('can_reshare', False):
            raise HTTPException(
                status_code=403, 
                detail="🔒 MODE SÉCURISÉ: Vous ne pouvez pas re-partager ce document (flag transfer_only)"
            )
    
    # Vérifier que le destinataire existe
    target = db.get_user_by_id(share.target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur destinataire non trouvé")
    
    # Vérifier si déjà partagé
    existing = db.get_user_document_acl(share.document_id, share.target_user_id)
    if existing:
        raise HTTPException(status_code=400, detail="Document déjà partagé avec cet utilisateur")
    
    # Créer l'ACL avec can_reshare=True si 'share' dans permissions (FAIBLESSE DAC!)
    can_reshare = 'share' in share.permissions
    
    acl_id = db.create_document_acl(
        document_id=share.document_id,
        user_id=share.target_user_id,
        user_email=target['email'],
        permissions=share.permissions,
        can_reshare=can_reshare,  # ⚠️ FAIBLESSE: permet re-partage
        granted_by=user['id'],
        granted_by_email=user['email'],
        is_dac_mode=True
    )
    
    return {
        "message": "🔴 Document partagé (MODE DAC - VULNÉRABLE)",
        "warning": "⚠️ FAIBLESSE DAC: Le destinataire peut RE-PARTAGER ce document à d'autres!",
        "acl_id": acl_id,
        "document_id": share.document_id,
        "shared_with": target['email'],
        "permissions": share.permissions,
        "can_reshare": can_reshare,
        "hru_operation": f"CONFER: enter {share.permissions}{'*' if can_reshare else ''} into A[{target['email']}, doc_{share.document_id}]"
    }


@app.post("/documents/share/secure", tags=["DAC - Documents"])
async def share_document_secure(
    share: DocumentShareSecure,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    🟢 MODE SÉCURISÉ - Partage avec flag 'transfer_only'
    
    SOLUTION au problème de sûreté HRU:
    - Par défaut can_reshare=False (flag transfer_only)
    - Le destinataire NE PEUT PAS re-partager le document
    - Contrôle strict de la propagation des privilèges
    """
    user = await get_current_user(credentials)
    
    # Vérifier que le document existe
    doc = db.get_document(share.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Seul le propriétaire peut partager en mode sécurisé (ou ceux avec can_reshare ET share.can_reshare=True)
    is_owner = doc['owner_id'] == user['id']
    user_acl = db.get_user_document_acl(share.document_id, user['id'])
    
    if not is_owner:
        if not user_acl:
            raise HTTPException(status_code=403, detail="Vous n'avez pas accès à ce document")
        if not user_acl.get('can_reshare', False):
            raise HTTPException(status_code=403, detail="Vous ne pouvez pas partager ce document")
    
    # Vérifier que le destinataire existe
    target = db.get_user_by_id(share.target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur destinataire non trouvé")
    
    # Vérifier si déjà partagé
    existing = db.get_user_document_acl(share.document_id, share.target_user_id)
    if existing:
        raise HTTPException(status_code=400, detail="Document déjà partagé avec cet utilisateur")
    
    acl_id = db.create_document_acl(
        document_id=share.document_id,
        user_id=share.target_user_id,
        user_email=target['email'],
        permissions=share.permissions,
        can_reshare=share.can_reshare,  # ✅ Par défaut False (transfer_only)
        granted_by=user['id'],
        granted_by_email=user['email'],
        is_dac_mode=False
    )
    
    return {
        "message": "🟢 Document partagé (MODE SÉCURISÉ)",
        "solution": "✅ Flag 'transfer_only': Le destinataire NE PEUT PAS re-partager ce document",
        "acl_id": acl_id,
        "document_id": share.document_id,
        "shared_with": target['email'],
        "permissions": share.permissions,
        "can_reshare": share.can_reshare,
        "hru_operation": f"CONFER: enter {share.permissions} (transfer_only) into A[{target['email']}, doc_{share.document_id}]"
    }


@app.get("/documents/acl-matrix", tags=["DAC - Documents"])
async def get_acl_matrix(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Visualiser la MATRICE DE CONTRÔLE D'ACCÈS complète (Admin only).
    Représentation de A[sujet, objet] = {actions}
    """
    user = await get_current_user(credentials)
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    documents = db.get_all_documents()
    acls = db.get_all_document_acls()
    
    # Construire la matrice
    matrix = {}
    
    # Ajouter les propriétaires
    for doc in documents:
        owner_email = doc['owner_email']
        doc_name = f"doc_{doc.doc_id}:{doc['title'][:20]}"
        
        if owner_email not in matrix:
            matrix[owner_email] = {}
        matrix[owner_email][doc_name] = ["own", "read", "write", "share"]
    
    # Ajouter les ACLs
    for acl in acls:
        user_email = acl['user_email']
        doc = db.get_document(acl['document_id'])
        if doc:
            doc_name = f"doc_{acl['document_id']}:{doc['title'][:20]}"
            
            if user_email not in matrix:
                matrix[user_email] = {}
            
            perms = acl['permissions'].copy()
            if acl['can_reshare']:
                perms = [f"{p}*" for p in perms]  # Marque de copie
            matrix[user_email][doc_name] = {
                "permissions": perms,
                "mode": "DAC" if acl['is_dac_mode'] else "SECURE",
                "granted_by": acl['granted_by_email']
            }
    
    return {
        "title": "Matrice de Contrôle d'Accès (HRU)",
        "legend": {
            "*": "Marque de copie - peut transférer ce privilège (FAIBLESSE DAC)",
            "own": "Propriétaire du document",
            "DAC": "Mode vulnérable - re-partage possible",
            "SECURE": "Mode sécurisé - transfer_only"
        },
        "matrix": matrix,
        "total_documents": len(documents),
        "total_acls": len(acls)
    }


@app.delete("/documents/{doc_id}/acl/{user_id}", tags=["DAC - Documents"])
async def revoke_document_access(
    doc_id: int,
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    RÉVOQUER l'accès d'un utilisateur à un document (REVOKE dans HRU).
    Seul le propriétaire peut révoquer.
    """
    user = await get_current_user(credentials)
    
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    if doc['owner_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut révoquer les accès")
    
    acl = db.get_user_document_acl(doc_id, user_id)
    if not acl:
        raise HTTPException(status_code=404, detail="Cet utilisateur n'a pas accès au document")
    
    db.delete_document_acl(acl.doc_id)
    
    target = db.get_user_by_id(user_id)
    
    return {
        "message": "Accès révoqué avec succès",
        "hru_operation": f"REVOKE: delete * from A[{target['email'] if target else user_id}, doc_{doc_id}]"
    }


# ================================================================
# FONCTIONNALITÉ 2: DÉLÉGATION DE DROITS (DAC - Take-Grant)
# ================================================================
#
# Implémentation du modèle Take-Grant:
# - Nœuds: Utilisateurs (sujets)
# - Arcs: Délégations avec droits (t=take, g=grant)
#
# FAIBLESSE DAC: Chaîne de délégation non contrôlée (prédicat 'can' toujours vrai via chemin tg)
# SOLUTION: Profondeur limitée + Expiration temporelle
# ================================================================

@app.post("/delegations/dac", tags=["DAC - Délégations"])
async def create_delegation_dac(
    delegation: DelegationCreateDAC,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    🔴 MODE DAC (VULNÉRABLE) - Délégation avec re-délégation possible
    
    Implémente l'opération GRANT du modèle Take-Grant:
    - Si 'delegate' est dans rights, le délégué peut RE-DÉLÉGUER
    - FAIBLESSE: Chaîne de délégation non contrôlée
    - Théorème Take-Grant: "can" est vrai s'il existe un chemin tg entre les sujets
    """
    user = await get_current_user(credentials)
    
    # HR/Admin peuvent toujours déléguer, OU un utilisateur avec droit 'delegate' délégué
    is_hr_or_admin = user['role'] in ['hr_manager', 'admin']
    has_delegate_right = db.user_has_delegated_right(user['id'], 'delegate')
    
    if not is_hr_or_admin and not has_delegate_right:
        raise HTTPException(status_code=403, detail="Vous n'avez pas le droit de déléguer")
    
    # Si c'est un utilisateur délégué, il ne peut déléguer que les droits qu'il a reçus
    if not is_hr_or_admin:
        user_rights = db.get_user_delegated_rights(user['id'])
        for right in delegation.rights:
            if right not in user_rights:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Vous ne pouvez pas déléguer le droit '{right}' car vous ne l'avez pas"
                )
    
    # Vérifier que le délégué existe
    delegate = db.get_user_by_id(delegation.delegate_to_user_id)
    if not delegate:
        raise HTTPException(status_code=404, detail="Utilisateur délégué non trouvé")
    
    # Vérifier qu'on ne délègue pas à soi-même
    if delegate.doc_id == user['id']:
        raise HTTPException(status_code=400, detail="Impossible de déléguer à soi-même")
    
    can_redelegate = 'delegate' in delegation.rights
    
    delegation_id = db.create_delegation(
        delegator_id=user['id'],
        delegator_email=user['email'],
        delegate_id=delegation.delegate_to_user_id,
        delegate_email=delegate['email'],
        rights=delegation.rights,
        can_redelegate=can_redelegate,  # ⚠️ FAIBLESSE
        max_depth=-1,  # Illimité en mode DAC
        current_depth=0,
        expires_at=None,  # Pas d'expiration en mode DAC
        is_dac_mode=True
    )
    
    return {
        "message": "🔴 Délégation créée (MODE DAC - VULNÉRABLE)",
        "warning": "⚠️ FAIBLESSE Take-Grant: Le délégué peut RE-DÉLÉGUER sans limite!",
        "delegation_id": delegation_id,
        "delegator": user['email'],
        "delegate": delegate['email'],
        "rights": delegation.rights,
        "can_redelegate": can_redelegate,
        "expires_at": None,
        "take_grant_operation": f"GRANT: Arc g de {user['email']} vers {delegate['email']} avec droits {delegation.rights}"
    }


@app.post("/delegations/secure", tags=["DAC - Délégations"])
async def create_delegation_secure(
    delegation: DelegationCreateSecure,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    🟢 MODE SÉCURISÉ - Délégation avec limites
    
    SOLUTIONS aux faiblesses Take-Grant:
    1. max_depth: Limite la profondeur de re-délégation (0 = ne peut pas)
    2. expires_in_hours: Expiration temporelle de la délégation
    
    Ces restrictions cassent le théorème "can" de Take-Grant.
    """
    user = await get_current_user(credentials)
    
    # HR/Admin peuvent toujours déléguer
    is_hr_or_admin = user['role'] in ['hr_manager', 'admin']
    
    # Pour les utilisateurs délégués, vérifier s'ils ont le droit de re-déléguer
    # En mode sécurisé, can_redelegate = True signifie qu'on peut re-déléguer
    # En mode DAC, le droit 'delegate' dans rights permet de re-déléguer
    user_delegations = db.get_active_delegations_for_delegate(user['id'])
    can_redelegate_secure = any(d.get('can_redelegate', False) for d in user_delegations)
    has_delegate_right = db.user_has_delegated_right(user['id'], 'delegate')
    
    if not is_hr_or_admin and not has_delegate_right and not can_redelegate_secure:
        raise HTTPException(status_code=403, detail="Vous n'avez pas le droit de déléguer")
    
    # Si c'est un utilisateur délégué, il ne peut déléguer que les droits qu'il a reçus
    if not is_hr_or_admin:
        user_rights = db.get_user_delegated_rights(user['id'])
        for right in delegation.rights:
            if right not in user_rights:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Vous ne pouvez pas déléguer le droit '{right}' car vous ne l'avez pas"
                )
    
    # Vérifier que le délégué existe
    delegate = db.get_user_by_id(delegation.delegate_to_user_id)
    if not delegate:
        raise HTTPException(status_code=404, detail="Utilisateur délégué non trouvé")
    
    if delegate.doc_id == user['id']:
        raise HTTPException(status_code=400, detail="Impossible de déléguer à soi-même")
    
    # Trouver la délégation parente (mode sécurisé) pour calculer les limites
    parent_delegation = None
    parent_expires_at = None
    for d in user_delegations:
        if not d['is_dac_mode']:
            parent_delegation = d
            parent_expires_at = d.get('expires_at')
            break
    
    # Calculer la nouvelle profondeur (current_depth de la délégation enfant)
    if parent_delegation:
        new_current_depth = parent_delegation['current_depth'] + 1
        parent_max_depth = parent_delegation['max_depth']
        
        # Vérifier si on peut encore déléguer (profondeur non atteinte)
        if parent_max_depth <= new_current_depth:
            raise HTTPException(
                status_code=403,
                detail=f"🔒 Profondeur maximale atteinte. Vous êtes au niveau {new_current_depth}, max autorisé: {parent_max_depth}"
            )
        
        # La nouvelle max_depth ne peut pas dépasser ce qui reste
        remaining_depth = parent_max_depth - new_current_depth
        if delegation.max_depth > remaining_depth:
            delegation.max_depth = remaining_depth  # Limiter automatiquement
    else:
        new_current_depth = 0
    
    # Calculer l'expiration - ne peut pas dépasser celle du parent
    requested_expires_at = datetime.utcnow() + timedelta(hours=delegation.expires_in_hours)
    
    if parent_expires_at:
        parent_expiry = datetime.fromisoformat(parent_expires_at)
        if requested_expires_at > parent_expiry:
            # Limiter à l'expiration du parent
            expires_at = parent_expires_at
        else:
            expires_at = requested_expires_at.isoformat()
    else:
        expires_at = requested_expires_at.isoformat()
    
    delegation_id = db.create_delegation(
        delegator_id=user['id'],
        delegator_email=user['email'],
        delegate_id=delegation.delegate_to_user_id,
        delegate_email=delegate['email'],
        rights=delegation.rights,
        can_redelegate=delegation.max_depth > 0,  # Peut re-déléguer si depth > 0
        max_depth=delegation.max_depth,
        current_depth=new_current_depth,
        expires_at=expires_at,
        is_dac_mode=False
    )
    
    return {
        "message": "🟢 Délégation créée (MODE SÉCURISÉ)",
        "solutions": {
            "profondeur": f"Niveau actuel: {new_current_depth}, Max autorisé: {delegation.max_depth} niveaux de re-délégation",
            "expiration": f"Expire le {expires_at}"
        },
        "delegation_id": delegation_id,
        "delegator": user['email'],
        "delegate": delegate['email'],
        "rights": delegation.rights,
        "max_depth": delegation.max_depth,
        "current_depth": new_current_depth,
        "can_redelegate": delegation.max_depth > 0,
        "expires_at": expires_at
    }


@app.get("/delegations/my", tags=["DAC - Délégations"])
async def get_my_delegations(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Récupérer mes délégations (données et reçues) - uniquement les actives."""
    user = await get_current_user(credentials)
    
    given = db.get_active_delegations_by_delegator(user['id'])
    received = db.get_active_delegations_for_delegate(user['id'])
    
    return {
        "delegations_given": [{
            "id": d.doc_id,
            "delegate": d['delegate_email'],
            "rights": d['rights'],
            "mode": "DAC" if d['is_dac_mode'] else "SECURE",
            "is_active": d['is_active'],
            "expires_at": d.get('expires_at'),
            "created_at": d['created_at']
        } for d in given],
        "delegations_received": [{
            "id": d.doc_id,
            "delegator": d['delegator_email'],
            "rights": d['rights'],
            "mode": "DAC" if d['is_dac_mode'] else "SECURE",
            "can_redelegate": d['can_redelegate'],
            "max_depth": d['max_depth'],
            "current_depth": d['current_depth'],
            "expires_at": d.get('expires_at'),
            "created_at": d['created_at']
        } for d in received]
    }


@app.get("/delegations/my-rights", tags=["DAC - Délégations"])
async def get_my_delegated_rights(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Récupérer les droits délégués actifs de l'utilisateur."""
    user = await get_current_user(credentials)
    rights = db.get_user_delegated_rights(user['id'])
    delegations = db.get_active_delegations_for_delegate(user['id'])
    
    return {
        "delegated_rights": rights,
        "has_view_requests": "view_requests" in rights,
        "has_approve_leave": "approve_leave" in rights,
        "has_delegate": "delegate" in rights,
        "delegations_count": len(delegations)
    }


@app.get("/delegations/graph", tags=["DAC - Délégations"])
async def get_delegation_graph(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Visualiser le GRAPHE DE DÉLÉGATION Take-Grant (Admin only).
    Les nœuds sont les utilisateurs, les arcs sont les délégations.
    """
    user = await get_current_user(credentials)
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    all_delegations = db.get_all_delegations()
    
    nodes = set()
    edges = []
    
    for d in all_delegations:
        nodes.add(d['delegator_email'])
        nodes.add(d['delegate_email'])
        
        edge_label = f"{d['rights']}"
        if d['is_dac_mode']:
            edge_label += " [DAC:∞]"
        else:
            edge_label += f" [depth:{d['max_depth']}]"
        
        edges.append({
            "from": d['delegator_email'],
            "to": d['delegate_email'],
            "rights": d['rights'],
            "label": edge_label,
            "mode": "DAC" if d['is_dac_mode'] else "SECURE",
            "is_active": d['is_active'],
            "expires_at": d.get('expires_at')
        })
    
    # Analyser les chemins tg (Take-Grant vulnerability)
    tg_paths = []
    for node in nodes:
        # Chercher les chemins depuis ce nœud
        visited = set()
        queue = [(node, [node])]
        while queue:
            current, path = queue.pop(0)
            for e in edges:
                if e['from'] == current and e['to'] not in visited and e['is_active']:
                    new_path = path + [e['to']]
                    if len(new_path) > 2:
                        tg_paths.append({
                            "path": " → ".join(new_path),
                            "vulnerability": "DAC" in [ed['mode'] for ed in edges if ed['from'] in new_path[:-1] and ed['to'] in new_path[1:]]
                        })
                    visited.add(e['to'])
                    queue.append((e['to'], new_path))
    
    return {
        "title": "Graphe de Délégation (Take-Grant)",
        "legend": {
            "DAC:∞": "Mode DAC - re-délégation illimitée (VULNÉRABLE)",
            "depth:N": "Mode sécurisé - max N niveaux de re-délégation"
        },
        "nodes": list(nodes),
        "edges": edges,
        "tg_paths": tg_paths[:10],  # Limiter à 10 chemins
        "vulnerability_analysis": {
            "dac_edges": len([e for e in edges if e['mode'] == 'DAC' and e['is_active']]),
            "secure_edges": len([e for e in edges if e['mode'] == 'SECURE' and e['is_active']]),
            "warning": "Les arcs DAC permettent une propagation non contrôlée des droits!"
        }
    }


@app.delete("/delegations/{delegation_id}", tags=["DAC - Délégations"])
async def revoke_delegation(
    delegation_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Révoquer une délégation."""
    user = await get_current_user(credentials)
    
    delegation = db.get_delegation(delegation_id)
    if not delegation:
        raise HTTPException(status_code=404, detail="Délégation non trouvée")
    
    if delegation['delegator_id'] != user['id'] and user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas révoquer cette délégation")
    
    db.revoke_delegation(delegation_id)
    
    return {
        "message": "Délégation révoquée",
        "delegation_id": delegation_id
    }


@app.get("/users/list", tags=["Users"])
async def list_users(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Lister tous les utilisateurs (pour partage/délégation)."""
    user = await get_current_user(credentials)
    
    all_users = []
    for role in ['admin', 'hr_manager', 'employee']:
        users = db.get_users_by_role(role)
        for u in users:
            if u.doc_id != user['id']:  # Exclure l'utilisateur courant
                all_users.append({
                    "id": u.doc_id,
                    "email": u['email'],
                    "role": u['role']
                })
    
    return all_users


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
