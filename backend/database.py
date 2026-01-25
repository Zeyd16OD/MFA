from tinydb import TinyDB, Query
from typing import Optional, List
from datetime import datetime, timedelta
from config import settings
import os


class Database:
    def __init__(self, db_path: str = None):
        """Initialize TinyDB database."""
        if db_path is None:
            db_path = settings.DATABASE_PATH
        
        self.db = TinyDB(db_path)
        self.users = self.db.table('users')
        self.otp_codes = self.db.table('otp_codes')
        self.messages = self.db.table('messages')
        self.trusted_params = self.db.table('trusted_params')
        self.sessions = self.db.table('sessions')  # Store DH sessions
        self.login_attempts = self.db.table('login_attempts')  # Track login attempts
        self.otp_attempts = self.db.table('otp_attempts')  # Track OTP attempts
        self.leave_requests = self.db.table('leave_requests')  # Leave/Absence requests
        self.communication_auth = self.db.table('communication_auth')  # Communication authorization requests
        
        # ============ DAC FEATURES ============
        self.documents = self.db.table('documents')  # Documents (Fonctionnalité 1)
        self.document_acls = self.db.table('document_acls')  # ACL pour documents
        self.delegations = self.db.table('delegations')  # Délégations (Fonctionnalité 2)
    
    # User Operations
    def create_user(self, email: str, password_hash: str, role: str, public_key_cert: str = None) -> int:
        """Create a new user."""
        user_id = self.users.insert({
            'email': email,
            'password_hash': password_hash,
            'role': role,
            'public_key_certificate': public_key_cert,
            'created_at': datetime.utcnow().isoformat()
        })
        return user_id
    
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email."""
        User = Query()
        result = self.users.search(User.email == email)
        return result[0] if result else None
    
    def get_user_by_id(self, user_id: int) -> Optional[dict]:
        """Get user by ID."""
        result = self.users.get(doc_id=user_id)
        return result
    
    def get_users_by_role(self, role: str) -> List[dict]:
        """Get all users with a specific role."""
        User = Query()
        return self.users.search(User.role == role)
    
    def update_user_public_key(self, user_id: int, public_key: str):
        """Update user's public key certificate."""
        self.users.update({'public_key_certificate': public_key}, doc_ids=[user_id])
    
    # OTP Operations
    def store_otp(self, email: str, code: str):
        """Store OTP code with expiration."""
        OTP = Query()
        # Remove existing OTP for this email
        self.otp_codes.remove(OTP.email == email)
        
        expiration = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRATION_MINUTES)
        self.otp_codes.insert({
            'email': email,
            'code': code,
            'expiration': expiration.isoformat()
        })
    
    def verify_otp(self, email: str, code: str) -> bool:
        """Verify OTP code."""
        OTP = Query()
        result = self.otp_codes.search(
            (OTP.email == email) & (OTP.code == code)
        )
        
        if not result:
            return False
        
        otp_data = result[0]
        expiration = datetime.fromisoformat(otp_data['expiration'])
        
        if datetime.utcnow() > expiration:
            # OTP expired, remove it
            self.otp_codes.remove(doc_ids=[otp_data.doc_id])
            return False
        
        # Valid OTP, remove it (one-time use)
        self.otp_codes.remove(doc_ids=[otp_data.doc_id])
        return True
    
    # Trusted Parameters (DH)
    def store_dh_params(self, p: str, g: str):
        """Store global DH parameters."""
        # Clear existing params
        self.trusted_params.truncate()
        
        self.trusted_params.insert({
            'p': p,
            'g': g,
            'created_at': datetime.utcnow().isoformat()
        })
    
    def get_dh_params(self) -> Optional[dict]:
        """Get global DH parameters."""
        all_params = self.trusted_params.all()
        return all_params[0] if all_params else None
    
    # Session Management (for DH)
    def store_session(self, user_id: int, private_key: str, shared_secret: str = None):
        """Store DH session data."""
        Session = Query()
        # Remove existing session
        self.sessions.remove(Session.user_id == user_id)
        
        self.sessions.insert({
            'user_id': user_id,
            'private_key': private_key,
            'shared_secret': shared_secret,
            'created_at': datetime.utcnow().isoformat()
        })
    
    def get_session(self, user_id: int) -> Optional[dict]:
        """Get DH session data."""
        Session = Query()
        result = self.sessions.search(Session.user_id == user_id)
        return result[0] if result else None
    
    def update_session_secret(self, user_id: int, shared_secret: str):
        """Update shared secret in session."""
        Session = Query()
        self.sessions.update({'shared_secret': shared_secret}, Session.user_id == user_id)
    
    # Message Operations
    def store_message(self, from_id: int, to_id: int, encrypted_content: str, iv: str) -> int:
        """Store encrypted message."""
        msg_id = self.messages.insert({
            'from_id': from_id,
            'to_id': to_id,
            'encrypted_content': encrypted_content,
            'iv': iv,
            'timestamp': datetime.utcnow().isoformat(),
            'decrypted': False
        })
        return msg_id
    
    def get_messages_for_user(self, user_id: int) -> List[dict]:
        """Get all messages sent to a user."""
        Message = Query()
        return self.messages.search(Message.to_id == user_id)
    
    def get_all_messages(self) -> List[dict]:
        """Get all messages (for admin/HR view)."""
        return self.messages.all()
    
    # Login Attempts Management
    def record_login_attempt(self, email: str, success: bool):
        """Record a login attempt."""
        Attempt = Query()
        attempts = self.login_attempts.search(Attempt.email == email)
        
        if attempts:
            attempt_data = attempts[0]
            if success:
                # Reset attempts on success
                self.login_attempts.remove(doc_ids=[attempt_data.doc_id])
            else:
                # Increment failed attempts
                failed_count = attempt_data.get('failed_count', 0) + 1
                last_attempt = datetime.utcnow().isoformat()
                self.login_attempts.update({
                    'failed_count': failed_count,
                    'last_attempt': last_attempt
                }, doc_ids=[attempt_data.doc_id])
        else:
            # First attempt
            if not success:
                self.login_attempts.insert({
                    'email': email,
                    'failed_count': 1,
                    'last_attempt': datetime.utcnow().isoformat()
                })
    
    def is_login_blocked(self, email: str) -> tuple[bool, int]:
        """Check if login is blocked for this email. Returns (is_blocked, remaining_seconds)."""
        Attempt = Query()
        attempts = self.login_attempts.search(Attempt.email == email)
        
        if not attempts:
            return False, 0
        
        attempt_data = attempts[0]
        failed_count = attempt_data.get('failed_count', 0)
        
        if failed_count >= 5:
            last_attempt = datetime.fromisoformat(attempt_data['last_attempt'])
            block_until = last_attempt + timedelta(minutes=5)
            now = datetime.utcnow()
            
            if now < block_until:
                remaining = int((block_until - now).total_seconds())
                return True, remaining
            else:
                # Block period expired, reset
                self.login_attempts.remove(doc_ids=[attempt_data.doc_id])
                return False, 0
        
        return False, 0
    
    # OTP Attempts Management
    def record_otp_attempt(self, email: str, success: bool):
        """Record an OTP verification attempt."""
        Attempt = Query()
        attempts = self.otp_attempts.search(Attempt.email == email)
        
        if attempts:
            attempt_data = attempts[0]
            if success:
                # Reset attempts on success
                self.otp_attempts.remove(doc_ids=[attempt_data.doc_id])
            else:
                # Increment failed attempts
                failed_count = attempt_data.get('failed_count', 0) + 1
                last_attempt = datetime.utcnow().isoformat()
                self.otp_attempts.update({
                    'failed_count': failed_count,
                    'last_attempt': last_attempt
                }, doc_ids=[attempt_data.doc_id])
        else:
            # First attempt
            if not success:
                self.otp_attempts.insert({
                    'email': email,
                    'failed_count': 1,
                    'last_attempt': datetime.utcnow().isoformat()
                })
    
    def is_otp_blocked(self, email: str) -> tuple[bool, int]:
        """Check if OTP verification is blocked for this email. Returns (is_blocked, remaining_seconds)."""
        Attempt = Query()
        attempts = self.otp_attempts.search(Attempt.email == email)
        
        if not attempts:
            return False, 0
        
        attempt_data = attempts[0]
        failed_count = attempt_data.get('failed_count', 0)
        
        if failed_count >= 5:
            last_attempt = datetime.fromisoformat(attempt_data['last_attempt'])
            block_until = last_attempt + timedelta(minutes=5)
            now = datetime.utcnow()
            
            if now < block_until:
                remaining = int((block_until - now).total_seconds())
                return True, remaining
            else:
                # Block period expired, reset
                self.otp_attempts.remove(doc_ids=[attempt_data.doc_id])
                return False, 0
        
        return False, 0
    
    def reset_otp_attempts(self, email: str):
        """Reset OTP attempts for an email."""
        Attempt = Query()
        self.otp_attempts.remove(Attempt.email == email)
    
    def cancel_otp(self, email: str):
        """Cancel current OTP and reset attempts."""
        OTP = Query()
        self.otp_codes.remove(OTP.email == email)
        self.reset_otp_attempts(email)
    
    # Leave Request Operations
    def create_leave_request(self, employee_id: int, employee_email: str, 
                            type: str, start_date: str, end_date: str, 
                            reason: str, days_count: int) -> int:
        """Create a new leave/absence request."""
        request_id = self.leave_requests.insert({
            'employee_id': employee_id,
            'employee_email': employee_email,
            'type': type,
            'start_date': start_date,
            'end_date': end_date,
            'reason': reason,
            'days_count': days_count,
            'status': 'pending',
            'hr_comment': None,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': None
        })
        return request_id
    
    def get_leave_request(self, request_id: int) -> Optional[dict]:
        """Get a specific leave request by ID."""
        return self.leave_requests.get(doc_id=request_id)
    
    def get_leave_requests_by_employee(self, employee_id: int) -> List[dict]:
        """Get all leave requests for a specific employee."""
        Request = Query()
        return self.leave_requests.search(Request.employee_id == employee_id)
    
    def get_all_leave_requests(self) -> List[dict]:
        """Get all leave requests (for HR Manager)."""
        return self.leave_requests.all()
    
    def update_leave_request_status(self, request_id: int, status: str, hr_comment: str = None):
        """Update the status of a leave request (HR Manager only)."""
        self.leave_requests.update({
            'status': status,
            'hr_comment': hr_comment,
            'updated_at': datetime.utcnow().isoformat()
        }, doc_ids=[request_id])
    
    def delete_leave_request(self, request_id: int):
        """Delete a leave request (employee can delete their own pending requests)."""
        self.leave_requests.remove(doc_ids=[request_id])
    
    # Communication Authorization Operations
    def create_communication_auth(self, leave_request_id: int, employee_id: int, employee_email: str) -> int:
        """Create a new communication authorization request for admin approval."""
        auth_id = self.communication_auth.insert({
            'leave_request_id': leave_request_id,
            'employee_id': employee_id,
            'employee_email': employee_email,
            'status': 'pending_admin',  # pending_admin, approved, rejected, key_exchanged, message_sent
            'created_at': datetime.utcnow().isoformat(),
            'approved_at': None,
            'rejected_at': None
        })
        return auth_id
    
    def get_communication_auth(self, auth_id: int) -> Optional[dict]:
        """Get a specific communication authorization by ID."""
        return self.communication_auth.get(doc_id=auth_id)
    
    def get_communication_auth_by_leave_request(self, leave_request_id: int) -> Optional[dict]:
        """Get communication authorization by leave request ID."""
        Auth = Query()
        result = self.communication_auth.search(Auth.leave_request_id == leave_request_id)
        return result[0] if result else None
    
    def get_pending_communication_auths(self) -> List[dict]:
        """Get all pending communication authorizations (for Admin)."""
        Auth = Query()
        return self.communication_auth.search(Auth.status == 'pending_admin')
    
    def get_all_communication_auths(self) -> List[dict]:
        """Get all communication authorizations (for Admin)."""
        return self.communication_auth.all()
    
    def update_communication_auth_status(self, auth_id: int, status: str):
        """Update communication authorization status."""
        update_data = {'status': status}
        if status == 'approved':
            update_data['approved_at'] = datetime.utcnow().isoformat()
        elif status == 'rejected':
            update_data['rejected_at'] = datetime.utcnow().isoformat()
        self.communication_auth.update(update_data, doc_ids=[auth_id])
    
    def get_communication_auth_by_employee(self, employee_id: int) -> List[dict]:
        """Get all communication authorizations for an employee."""
        Auth = Query()
        return self.communication_auth.search(Auth.employee_id == employee_id)
    
    # ================================================================
    # FONCTIONNALITÉ 1: GESTION DES DOCUMENTS (DAC - Matrice HRU)
    # ================================================================
    
    def create_document(self, owner_id: int, owner_email: str, title: str, 
                       content: str, is_confidential: bool = False) -> int:
        """Créer un nouveau document. Le créateur devient propriétaire (own)."""
        doc_id = self.documents.insert({
            'owner_id': owner_id,
            'owner_email': owner_email,
            'title': title,
            'content': content,
            'is_confidential': is_confidential,
            'created_at': datetime.utcnow().isoformat()
        })
        return doc_id
    
    def get_document(self, doc_id: int) -> Optional[dict]:
        """Récupérer un document par ID."""
        return self.documents.get(doc_id=doc_id)
    
    def get_documents_by_owner(self, owner_id: int) -> List[dict]:
        """Récupérer tous les documents d'un propriétaire."""
        Doc = Query()
        return self.documents.search(Doc.owner_id == owner_id)
    
    def get_all_documents(self) -> List[dict]:
        """Récupérer tous les documents."""
        return self.documents.all()
    
    def delete_document(self, doc_id: int):
        """Supprimer un document et ses ACLs."""
        self.documents.remove(doc_ids=[doc_id])
        ACL = Query()
        self.document_acls.remove(ACL.document_id == doc_id)
    
    # ACL Operations (Matrice d'accès)
    def create_document_acl(self, document_id: int, user_id: int, user_email: str,
                           permissions: List[str], can_reshare: bool, 
                           granted_by: int, granted_by_email: str, is_dac_mode: bool) -> int:
        """Créer une entrée ACL pour un document (CONFER operation dans HRU)."""
        acl_id = self.document_acls.insert({
            'document_id': document_id,
            'user_id': user_id,
            'user_email': user_email,
            'permissions': permissions,
            'can_reshare': can_reshare,  # DAC: True, Sécurisé: False (transfer_only)
            'granted_by': granted_by,
            'granted_by_email': granted_by_email,
            'is_dac_mode': is_dac_mode,
            'created_at': datetime.utcnow().isoformat()
        })
        return acl_id
    
    def get_document_acl(self, acl_id: int) -> Optional[dict]:
        """Récupérer une ACL par ID."""
        return self.document_acls.get(doc_id=acl_id)
    
    def get_acls_for_document(self, document_id: int) -> List[dict]:
        """Récupérer toutes les ACLs d'un document."""
        ACL = Query()
        return self.document_acls.search(ACL.document_id == document_id)
    
    def get_acls_for_user(self, user_id: int) -> List[dict]:
        """Récupérer toutes les ACLs d'un utilisateur."""
        ACL = Query()
        return self.document_acls.search(ACL.user_id == user_id)
    
    def get_user_document_acl(self, document_id: int, user_id: int) -> Optional[dict]:
        """Vérifier si un utilisateur a des droits sur un document."""
        ACL = Query()
        result = self.document_acls.search((ACL.document_id == document_id) & (ACL.user_id == user_id))
        return result[0] if result else None
    
    def delete_document_acl(self, acl_id: int):
        """Révoquer une ACL (REVOKE operation dans HRU)."""
        self.document_acls.remove(doc_ids=[acl_id])
    
    def get_all_document_acls(self) -> List[dict]:
        """Récupérer toutes les ACLs (pour visualisation de la matrice)."""
        return self.document_acls.all()
    
    # ================================================================
    # FONCTIONNALITÉ 2: DÉLÉGATION DE DROITS (DAC - Take-Grant)
    # ================================================================
    
    def create_delegation(self, delegator_id: int, delegator_email: str,
                         delegate_id: int, delegate_email: str,
                         rights: List[str], can_redelegate: bool,
                         max_depth: int, current_depth: int,
                         expires_at: str, is_dac_mode: bool) -> int:
        """Créer une délégation (GRANT operation dans Take-Grant)."""
        delegation_id = self.delegations.insert({
            'delegator_id': delegator_id,
            'delegator_email': delegator_email,
            'delegate_id': delegate_id,
            'delegate_email': delegate_email,
            'rights': rights,
            'can_redelegate': can_redelegate,  # DAC: True si 'delegate' dans rights
            'max_depth': max_depth,  # Sécurisé: limite de profondeur
            'current_depth': current_depth,  # Profondeur actuelle dans la chaîne
            'expires_at': expires_at,  # Sécurisé: expiration
            'is_dac_mode': is_dac_mode,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat()
        })
        return delegation_id
    
    def get_delegation(self, delegation_id: int) -> Optional[dict]:
        """Récupérer une délégation par ID."""
        return self.delegations.get(doc_id=delegation_id)
    
    def get_delegations_by_delegator(self, delegator_id: int) -> List[dict]:
        """Récupérer toutes les délégations créées par un utilisateur."""
        Delegation = Query()
        return self.delegations.search(Delegation.delegator_id == delegator_id)
    
    def get_delegations_for_delegate(self, delegate_id: int) -> List[dict]:
        """Récupérer toutes les délégations reçues par un utilisateur."""
        Delegation = Query()
        return self.delegations.search(Delegation.delegate_id == delegate_id)
    
    def get_active_delegations_for_delegate(self, delegate_id: int) -> List[dict]:
        """Récupérer les délégations actives et non expirées."""
        Delegation = Query()
        all_delegations = self.delegations.search(
            (Delegation.delegate_id == delegate_id) & (Delegation.is_active == True)
        )
        # Filtrer les expirées
        now = datetime.utcnow()
        active = []
        for d in all_delegations:
            if d.get('expires_at'):
                expires = datetime.fromisoformat(d['expires_at'])
                if now < expires:
                    active.append(d)
            else:
                active.append(d)  # DAC mode sans expiration
        return active
    
    def revoke_delegation(self, delegation_id: int):
        """Révoquer une délégation."""
        self.delegations.update({'is_active': False}, doc_ids=[delegation_id])
    
    def get_all_delegations(self) -> List[dict]:
        """Récupérer toutes les délégations (pour visualisation)."""
        return self.delegations.all()
    
    def get_delegation_chain(self, user_id: int) -> List[dict]:
        """Récupérer la chaîne de délégation pour un utilisateur."""
        chain = []
        Delegation = Query()
        current = self.delegations.search(Delegation.delegate_id == user_id)
        for d in current:
            chain.append(d)
            if d['delegator_id'] != user_id:
                parent_chain = self.get_delegation_chain(d['delegator_id'])
                chain.extend(parent_chain)
        return chain
    
    def close(self):
        """Close database connection."""
        self.db.close()


# Global database instance
db = Database()
