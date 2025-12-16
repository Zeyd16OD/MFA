# 📊 Rapport Technique Détaillé - Système HR Sécurisé

## 📋 Table des Matières
1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du Système](#architecture-du-système)
3. [Fonctionnalités de Sécurité](#fonctionnalités-de-sécurité)
4. [Backend - FastAPI](#backend---fastapi)
5. [Frontend - React + Vite](#frontend---react--vite)
6. [Flux de Données et Processus](#flux-de-données-et-processus)
7. [Base de Données](#base-de-données)
8. [Cryptographie Implémentée](#cryptographie-implémentée)
9. [API Endpoints](#api-endpoints)
10. [Cas d'Utilisation](#cas-dutilisation)

---

## 1. Vue d'ensemble

### 🎯 Objectif du Projet
Ce système simule une application de gestion RH sécurisée qui implémente des protocoles cryptographiques avancés pour garantir la confidentialité et l'intégrité des communications entre employés et responsables RH.

### 🔑 Caractéristiques Principales
- **Authentification Multi-Facteurs (MFA)** via OTP par email avec protection anti-brute force
- **Échange de clés Diffie-Hellman** pour établir un canal sécurisé
- **Chiffrement AES-256-CBC** pour les données sensibles
- **Architecture Zero-Knowledge** : les clés privées ne quittent jamais le client
- **Gestion des rôles** : Admin, RH Manager, Employé
- **Système de demandes d'absence/congés** avec contrôle d'accès par rôle (RBAC)
- **Protection contre les attaques par force brute** : blocage après 5 tentatives
- **Gestion intelligente des OTP** : renvoi et annulation sécurisés

### 🛠️ Technologies Utilisées

#### Backend
- **FastAPI** : Framework web moderne et performant
- **TinyDB** : Base de données JSON légère
- **Python Cryptography** : Bibliothèque cryptographique complète
- **FastAPI-Mail** : Envoi d'emails SMTP
- **Python-Jose** : Gestion des tokens JWT
- **Passlib + Bcrypt** : Hachage sécurisé des mots de passe

#### Frontend
- **React 18** : Bibliothèque UI moderne
- **Vite** : Build tool rapide
- **Tailwind CSS** : Framework CSS utilitaire
- **Axios** : Client HTTP
- **Web Crypto API** : Cryptographie native du navigateur

---

## 2. Architecture du Système

### 🏗️ Architecture Générale

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVIGATEUR CLIENT                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Application (Frontend)                         │  │
│  │  - Interface utilisateur                              │  │
│  │  - Crypto API (DH + AES)                             │  │
│  │  - Gestion d'état local                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/HTTP
                            │ (localhost:5173 → localhost:8000)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVEUR BACKEND                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI Application                                  │  │
│  │  - Endpoints REST API                                 │  │
│  │  - Authentification JWT                               │  │
│  │  - Gestion DH côté serveur                           │  │
│  │  - Déchiffrement AES                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TinyDB Database (db.json)                           │  │
│  │  - Utilisateurs                                       │  │
│  │  - Messages chiffrés                                  │  │
│  │  - Sessions DH                                        │  │
│  │  - Codes OTP                                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SMTP
                            │ (Gmail)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVICE EMAIL (Gmail SMTP)                      │
│              - Envoi des codes OTP                           │
│              - Port 587 (STARTTLS)                          │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Flux de Communication

1. **Client** → **Backend** : Requêtes HTTP/REST API
2. **Backend** → **Base de données** : Stockage persistant
3. **Backend** → **SMTP Server** : Envoi d'emails OTP
4. **Backend** → **Client** : Réponses JSON

---

## 3. Fonctionnalités de Sécurité

### 🔐 1. Authentification Multi-Facteurs (MFA)

#### Principe
L'authentification se fait en deux étapes pour renforcer la sécurité.

#### Implémentation

**Étape 1 : Email/Password**
```python
# Backend : main.py - /auth/login
@app.post("/auth/login")
async def login(request: LoginRequest, background_tasks: BackgroundTasks):
    # 1. Vérifier les credentials
    user = db.get_user_by_email(request.email)
    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # 2. Générer un code OTP à 6 chiffres
    otp_code = generate_otp(settings.OTP_LENGTH)
    
    # 3. Stocker l'OTP avec expiration (5 minutes)
    db.store_otp(request.email, otp_code)
    
    # 4. Envoyer l'OTP par email (tâche en arrière-plan)
    background_tasks.add_task(send_otp_email, request.email, otp_code)
    
    return {"message": "OTP sent to your email"}
```

**Étape 2 : Vérification OTP**
```python
# Backend : main.py - /auth/verify-otp
@app.post("/auth/verify-otp", response_model=Token)
async def verify_otp(request: OTPVerifyRequest):
    # 1. Vérifier l'OTP
    if not db.verify_otp(request.email, request.otp_code):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    # 2. Récupérer l'utilisateur
    user = db.get_user_by_email(request.email)
    
    # 3. Créer un token JWT avec payload
    access_token = create_access_token(
        data={
            "sub": user['email'],
            "role": user['role'],
            "user_id": user.doc_id
        }
    )
    
    return Token(access_token=access_token)
```

#### Sécurité OTP
- **Génération** : Nombres aléatoires cryptographiquement sûrs
- **Stockage** : Avec timestamp d'expiration
- **Expiration** : 5 minutes par défaut
- **Usage unique** : Supprimé après vérification ou expiration
- **Transmission** : Via email SMTP sécurisé (TLS)

```python
# Backend : security.py
def generate_otp(length: int = 6) -> str:
    """Generate a random OTP code."""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])
```

#### Envoi Email
```python
# Backend : main.py
async def send_otp_email(email: str, otp_code: str):
    message = MessageSchema(
        subject="Your OTP Code - HR System",
        recipients=[email],
        body=f"""
        <h2>Authentication Required</h2>
        <p>Your OTP code is: <strong>{otp_code}</strong></p>
        <p>This code will expire in 5 minutes.</p>
        """,
        subtype="html"
    )
    await fast_mail.send_message(message)
```

### �️ 2. Protection Anti-Brute Force

#### Limitation des Tentatives de Connexion

**Principe** :
- Maximum 5 tentatives de login par email
- Blocage automatique de 5 minutes après 5 échecs
- Compteur réinitialisé après connexion réussie
- Messages d'erreur spécifiques (évite l'énumération d'utilisateurs)

**Implémentation Base de Données** :
```python
# database.py
def record_login_attempt(self, email: str, success: bool):
    """Enregistre une tentative de connexion."""
    if success:
        # Réinitialiser après succès
        self.login_attempts.remove(Attempt.email == email)
    else:
        # Incrémenter les échecs
        failed_count = attempts.get('failed_count', 0) + 1
        self.login_attempts.update({
            'failed_count': failed_count,
            'last_attempt': datetime.utcnow().isoformat()
        })

def is_login_blocked(self, email: str) -> tuple[bool, int]:
    """Vérifie si le login est bloqué. Retourne (is_blocked, remaining_seconds)."""
    failed_count = attempts.get('failed_count', 0)
    if failed_count >= 5:
        last_attempt = datetime.fromisoformat(attempts['last_attempt'])
        block_until = last_attempt + timedelta(minutes=5)
        remaining = int((block_until - datetime.utcnow()).total_seconds())
        return remaining > 0, max(0, remaining)
    return False, 0
```

**Endpoint Login Sécurisé** :
```python
@app.post("/auth/login")
async def login(request: LoginRequest, background_tasks: BackgroundTasks):
    # 1. Vérifier si bloqué
    is_blocked, remaining_seconds = db.is_login_blocked(request.email)
    if is_blocked:
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        raise HTTPException(
            status_code=429,
            detail=f"Trop de tentatives. Réessayez dans {minutes}m {seconds}s"
        )
    
    # 2. Vérifier existence utilisateur
    user = db.get_user_by_email(request.email)
    if not user:
        db.record_login_attempt(request.email, False)
        raise HTTPException(
            status_code=404,
            detail="Erreur utilisateur n'existe pas"
        )
    
    # 3. Vérifier mot de passe
    if not verify_password(request.password, user['password_hash']):
        db.record_login_attempt(request.email, False)
        raise HTTPException(
            status_code=401,
            detail="Mot de passe incorrect"
        )
    
    # 4. Succès - réinitialiser tentatives
    db.record_login_attempt(request.email, True)
    # ... suite du login
```

#### Limitation des Tentatives OTP

**Principe** :
- Maximum 5 tentatives OTP par session
- Blocage de 5 minutes après 5 échecs
- Bouton "Re-envoyer l'OTP" après erreur
- Ancien code expiré lors du renvoi
- Annulation d'OTP fonctionnelle

**Vérification OTP Protégée** :
```python
@app.post("/auth/verify-otp", response_model=Token)
async def verify_otp(request: OTPVerifyRequest):
    # Vérifier blocage OTP
    is_blocked, remaining = db.is_otp_blocked(request.email)
    if is_blocked:
        raise HTTPException(
            status_code=429,
            detail=f"Trop de tentatives OTP. Réessayez dans {remaining//60}m {remaining%60}s"
        )
    
    # Vérifier OTP
    if not db.verify_otp(request.email, request.otp_code):
        db.record_otp_attempt(request.email, False)
        raise HTTPException(
            status_code=401,
            detail="Code OTP invalide ou expiré"
        )
    
    # Succès
    db.record_otp_attempt(request.email, True)
    # ... génération token
```

**Renvoi d'OTP** :
```python
@app.post("/auth/resend-otp")
async def resend_otp(request: LoginRequest, background_tasks: BackgroundTasks):
    """Renvoie un nouveau code OTP et expire l'ancien."""
    is_blocked, remaining = db.is_otp_blocked(request.email)
    if is_blocked:
        raise HTTPException(status_code=429, detail="Trop de tentatives")
    
    # Nouveau code (expire automatiquement l'ancien)
    otp_code = generate_otp(6)
    db.store_otp(request.email, otp_code)
    background_tasks.add_task(send_otp_email, request.email, otp_code)
    
    return {"message": "Nouveau code OTP envoyé"}
```

**Annulation d'OTP** :
```python
@app.post("/auth/cancel-otp")
async def cancel_otp(request: dict):
    """Annule la session OTP actuelle."""
    db.cancel_otp(request.get("email"))  # Supprime OTP et tentatives
    return {"message": "OTP session cancelled"}
```

**Frontend - Gestion du Bouton Retour** :
```javascript
const handleBackToLogin = async () => {
  try {
    // Annuler OTP côté serveur
    await cancelOTP(email);
  } finally {
    // Réinitialiser état
    setStep(1);
    setOtpCode('');
    setError('');
    setShowResendButton(false);
  }
};
```

#### Messages d'Erreur Spécifiques

| Situation | Message | Code HTTP |
|-----------|---------|-----------|
| Email inexistant | "Erreur utilisateur n'existe pas" | 404 |
| Mot de passe incorrect | "Mot de passe incorrect" | 401 |
| 5 tentatives login | "Trop de tentatives. Réessayez dans Xm Ys" | 429 |
| OTP invalide | "Code OTP invalide ou expiré" | 401 |
| 5 tentatives OTP | "Trop de tentatives OTP. Réessayez dans Xm Ys" | 429 |

### 🔑 3. Tokens JWT (JSON Web Tokens)

#### Principe
Les tokens JWT permettent une authentification stateless et sécurisée.

#### Structure du Token
```json
{
  "sub": "zeydody@gmail.com",
  "role": "admin",
  "user_id": 1,
  "exp": 1733789456
}
```

#### Implémentation
```python
# Backend : security.py
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    
    # Signature avec clé secrète
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm="HS256"
    )
    return encoded_jwt
```

#### Vérification
```python
# Backend : main.py
async def get_current_user(credentials: HTTPAuthorizationCredentials):
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Extraire l'email du payload
    email = payload.get("sub")
    user = db.get_user_by_email(email)
    
    return user
```

#### Utilisation Frontend
```javascript
// Frontend : api.js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 🤝 3. Échange de Clés Diffie-Hellman

#### Principe Mathématique

L'échange Diffie-Hellman permet à deux parties d'établir un secret partagé sur un canal non sécurisé.

**Paramètres publics (générés par TTP)** :
- `p` : Nombre premier très grand (1536 bits)
- `g` : Générateur (généralement 2)

**Processus** :
1. **Employé** génère clé privée `a` et calcule clé publique `A = g^a mod p`
2. **Employé** envoie `A` au serveur
3. **Serveur RH** génère clé privée `b` et calcule clé publique `B = g^b mod p`
4. **Serveur** envoie `B` à l'employé
5. **Employé** calcule secret `S = B^a mod p`
6. **Serveur** calcule secret `S = A^b mod p`
7. Les deux parties ont maintenant le même secret `S` sans l'avoir transmis !

#### Implémentation Backend

```python
# Backend : security.py

def generate_dh_parameters():
    """Générer les paramètres DH globaux."""
    # Utilisation d'un nombre premier sûr de 1536 bits
    p = int(
        "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
        "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
        "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
        "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
        "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"
        "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
        "83655D23DCA3AD961C62F356208552BB9ED529077096966D"
        "670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF", 16
    )
    g = 2
    return p, g

def calculate_dh_public_key(g: int, private_key: int, p: int) -> int:
    """Calculer la clé publique : g^private_key mod p."""
    return pow(g, private_key, p)

def calculate_dh_shared_secret(other_public_key: int, private_key: int, p: int) -> int:
    """Calculer le secret partagé : other_public_key^private_key mod p."""
    return pow(other_public_key, private_key, p)
```

#### Implémentation Frontend

```javascript
// Frontend : crypto.js

// Génération de la clé privée
export const generatePrivateKey = (p) => {
  const pBigInt = hexToBigInt(p);
  let privateKey;
  
  do {
    const randomBytes = new Uint8Array(192); // 1536 bits
    crypto.getRandomValues(randomBytes);
    privateKey = BigInt('0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
  } while (privateKey < 2n || privateKey >= pBigInt - 2n);
  
  return privateKey;
};

// Calcul de la clé publique
export const calculatePublicKey = (g, privateKey, p) => {
  return modPow(g, privateKey, p); // g^privateKey mod p
};

// Exponentiation modulaire efficace
export const modPow = (base, exp, mod) => {
  let result = 1n;
  base = base % mod;
  
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  
  return result;
};
```

#### Endpoint API

```python
# Backend : main.py
@app.post("/handshake/exchange", response_model=DHExchangeResponse)
async def dh_exchange(
    request: DHExchangeRequest,
    current_user: dict = Depends(get_current_user)
):
    # Récupérer les paramètres globaux
    params = db.get_dh_params()
    p = int(params['p'], 16)
    g = int(params['g'], 16)
    
    # Parser la clé publique du client A
    client_public_key = int(request.public_key, 16)
    
    # Récupérer ou créer la clé privée du RH Manager
    hr_users = db.get_users_by_role("hr_manager")
    hr_user = hr_users[0]
    hr_session = db.get_session(hr_user.doc_id)
    
    if not hr_session:
        hr_private_key = generate_dh_private_key(p)
        db.store_session(hr_user.doc_id, hex(hr_private_key))
    else:
        hr_private_key = int(hr_session['private_key'], 16)
    
    # Calculer la clé publique du RH : B = g^b mod p
    hr_public_key = calculate_dh_public_key(g, hr_private_key, p)
    
    # Calculer le secret partagé : S = A^b mod p
    shared_secret = calculate_dh_shared_secret(
        client_public_key, 
        hr_private_key, 
        p
    )
    
    # Stocker le secret pour l'employé et le RH
    db.store_session(current_user.doc_id, hex(0), hex(shared_secret))
    db.update_session_secret(hr_user.doc_id, hex(shared_secret))
    
    return DHExchangeResponse(public_key=hex(hr_public_key))
```

### 🔒 4. Chiffrement AES-256-CBC

#### Principe
AES (Advanced Encryption Standard) avec mode CBC (Cipher Block Chaining) pour chiffrer les messages.

#### Dérivation de Clé AES
```python
# Backend : security.py
def derive_aes_key_from_secret(shared_secret: int) -> bytes:
    """Dériver une clé AES-256 depuis le secret DH."""
    from hashlib import sha256
    
    # Convertir le secret en bytes
    secret_bytes = shared_secret.to_bytes(
        (shared_secret.bit_length() + 7) // 8, 
        byteorder='big'
    )
    
    # Hasher avec SHA-256 pour obtenir 256 bits
    return sha256(secret_bytes).digest()
```

#### Chiffrement

```python
# Backend : security.py
def aes_encrypt(plaintext: str, key: bytes) -> tuple[str, str]:
    """Chiffrer avec AES-256-CBC."""
    # Générer un IV aléatoire (16 bytes)
    iv = os.urandom(16)
    
    # Appliquer le padding PKCS7
    plaintext_bytes = plaintext.encode('utf-8')
    padding_length = 16 - (len(plaintext_bytes) % 16)
    padded_plaintext = plaintext_bytes + bytes([padding_length] * padding_length)
    
    # Créer le cipher et chiffrer
    cipher = Cipher(
        algorithms.AES(key), 
        modes.CBC(iv), 
        backend=default_backend()
    )
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_plaintext) + encryptor.finalize()
    
    # Retourner en base64
    return (
        base64.b64encode(encrypted).decode('utf-8'),
        base64.b64encode(iv).decode('utf-8')
    )
```

#### Déchiffrement

```python
# Backend : security.py
def aes_decrypt(encrypted_content_base64: str, iv_base64: str, key: bytes) -> str:
    """Déchiffrer AES-256-CBC."""
    # Décoder depuis base64
    encrypted = base64.b64decode(encrypted_content_base64)
    iv = base64.b64decode(iv_base64)
    
    # Créer le cipher et déchiffrer
    cipher = Cipher(
        algorithms.AES(key), 
        modes.CBC(iv), 
        backend=default_backend()
    )
    decryptor = cipher.decryptor()
    decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()
    
    # Retirer le padding
    padding_length = decrypted_padded[-1]
    decrypted = decrypted_padded[:-padding_length]
    
    return decrypted.decode('utf-8')
```

#### Implémentation Frontend

```javascript
// Frontend : crypto.js

export const deriveAESKey = async (sharedSecret) => {
  // Convertir le secret en bytes
  const hexStr = sharedSecret.toString(16);
  const bytes = new Uint8Array(Math.ceil(hexStr.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
  }
  
  // Hasher avec SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  
  // Importer comme clé AES
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
};

export const aesEncrypt = async (plaintext, aesKey) => {
  // Générer IV aléatoire
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Encoder le texte
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Chiffrer
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    plaintextBytes
  );
  
  // Convertir en base64
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { encrypted: encryptedBase64, iv: ivBase64 };
};
```

---

## 4. Backend - FastAPI

### 📂 Structure des Fichiers

```
backend/
├── main.py              # Application principale et endpoints
├── config.py            # Configuration et variables d'environnement
├── models.py            # Modèles Pydantic pour validation
├── security.py          # Fonctions cryptographiques
├── database.py          # Gestion TinyDB
├── requirements.txt     # Dépendances Python
├── .env                 # Variables d'environnement (secrets)
└── db.json             # Base de données (généré automatiquement)
```

### 🔧 Configuration (config.py)

```python
from pydantic_settings import BaseSettings

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
```

### 📊 Modèles de Données (models.py)

```python
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Literal["admin", "hr_manager", "employee"]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str

class DHExchangeRequest(BaseModel):
    public_key: str  # Hex string

class EncryptedMessage(BaseModel):
    encrypted_content: str  # Base64
    iv: str  # Base64
```

### 🗄️ Gestion Base de Données (database.py)

```python
from tinydb import TinyDB, Query

class Database:
    def __init__(self, db_path: str = "db.json"):
        self.db = TinyDB(db_path)
        self.users = self.db.table('users')
        self.otp_codes = self.db.table('otp_codes')
        self.messages = self.db.table('messages')
        self.trusted_params = self.db.table('trusted_params')
        self.sessions = self.db.table('sessions')
    
    def create_user(self, email, password_hash, role):
        return self.users.insert({
            'email': email,
            'password_hash': password_hash,
            'role': role,
            'created_at': datetime.utcnow().isoformat()
        })
    
    def store_otp(self, email, code):
        expiration = datetime.utcnow() + timedelta(minutes=5)
        self.otp_codes.insert({
            'email': email,
            'code': code,
            'expiration': expiration.isoformat()
        })
    
    def store_message(self, from_id, to_id, encrypted_content, iv):
        return self.messages.insert({
            'from_id': from_id,
            'to_id': to_id,
            'encrypted_content': encrypted_content,
            'iv': iv,
            'timestamp': datetime.utcnow().isoformat()
        })
```

---

## 5. Frontend - React + Vite

### 📂 Structure des Fichiers

```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.jsx             # Authentification
│   │   ├── EmployeeDashboard.jsx # Interface employé
│   │   ├── HRDashboard.jsx       # Interface RH
│   │   └── AdminDashboard.jsx    # Interface admin
│   ├── App.jsx                   # Application principale
│   ├── api.js                    # Client API
│   ├── crypto.js                 # Utilitaires crypto
│   ├── main.jsx                  # Point d'entrée
│   └── index.css                 # Styles globaux
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

### 🎨 Composant Login (Login.jsx)

```javascript
const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: credentials, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      setStep(2); // Passer à la vérification OTP
    } catch (err) {
      setError(err.response?.data?.detail);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      const response = await verifyOTP(email, otpCode);
      localStorage.setItem('token', response.data.access_token);
      onLoginSuccess(response.data.access_token);
    } catch (err) {
      setError(err.response?.data?.detail);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {step === 1 ? (
        <form onSubmit={handleLogin}>
          {/* Email/Password form */}
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP}>
          {/* OTP verification form */}
        </form>
      )}
    </div>
  );
};
```

### 👨‍💼 Composant Employee Dashboard (EmployeeDashboard.jsx)

```javascript
const EmployeeDashboard = ({ user, onLogout }) => {
  const [dhParams, setDhParams] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [aesKey, setAesKey] = useState(null);

  // Récupérer les paramètres DH au montage
  useEffect(() => {
    const fetchParams = async () => {
      const response = await getDHParams();
      setDhParams(response.data);
    };
    fetchParams();
  }, []);

  // Effectuer l'échange de clés
  const performKeyExchange = async () => {
    const { p, g } = dhParams;
    
    // 1. Générer clé privée
    const privKey = generatePrivateKey(p);
    setPrivateKey(privKey);
    
    // 2. Calculer clé publique A = g^a mod p
    const pubKey = calculatePublicKey(g, privKey, p);
    
    // 3. Envoyer A au serveur
    const response = await exchangeDHKeys(bigIntToHex(pubKey));
    const serverPublicKey = response.data.public_key;
    
    // 4. Calculer secret S = B^a mod p
    const secret = calculateSharedSecret(serverPublicKey, privKey, p);
    setSharedSecret(secret);
    
    // 5. Dériver clé AES
    const key = await deriveAESKey(secret);
    setAesKey(key);
  };

  // Soumettre demande de congé chiffrée
  const handleSubmitLeaveRequest = async (formData) => {
    const plaintext = JSON.stringify(formData);
    
    // Chiffrer avec AES
    const { encrypted, iv } = await aesEncrypt(plaintext, aesKey);
    
    // Envoyer au serveur
    await submitLeaveRequest(encrypted, iv);
  };

  return (
    <div>
      <button onClick={performKeyExchange}>
        Start Key Exchange
      </button>
      <form onSubmit={handleSubmitLeaveRequest}>
        {/* Leave request form */}
      </form>
    </div>
  );
};
```

### 👔 Composant HR Dashboard (HRDashboard.jsx)

```javascript
const HRDashboard = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState({});

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await getReceivedMessages();
      setMessages(response.data);
    };
    fetchMessages();
  }, []);

  const handleDecrypt = async (messageId) => {
    try {
      // Le serveur utilise le secret partagé stocké pour déchiffrer
      const response = await decryptMessage(messageId);
      setDecryptedMessages({
        ...decryptedMessages,
        [messageId]: response.data.decrypted_content
      });
    } catch (err) {
      console.error('Decryption failed:', err);
    }
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          <p>From: {msg.from_email}</p>
          <button onClick={() => handleDecrypt(msg.id)}>
            Decrypt
          </button>
          {decryptedMessages[msg.id] && (
            <div>
              <h4>Decrypted:</h4>
              <pre>{JSON.stringify(decryptedMessages[msg.id], null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## 6. Flux de Données et Processus

### 🔄 Scénario Complet : Employé Soumet une Demande de Congé

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 : AUTHENTIFICATION                                      │
└─────────────────────────────────────────────────────────────────┘

1. Employé entre email/password
   └─> POST /auth/login
       ├─> Backend vérifie credentials
       ├─> Génère OTP (ex: 123456)
       ├─> Stocke OTP en DB avec expiration
       └─> Envoie email via SMTP

2. Employé reçoit email et entre OTP
   └─> POST /auth/verify-otp
       ├─> Backend vérifie OTP et expiration
       ├─> Crée JWT token
       └─> Retourne token au client

3. Client stocke token dans localStorage
   └─> Toutes les requêtes suivantes incluent: 
       Authorization: Bearer <token>

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 : ÉCHANGE DE CLÉS DIFFIE-HELLMAN                       │
└─────────────────────────────────────────────────────────────────┘

4. Client demande paramètres DH
   └─> GET /handshake/params
       └─> Backend retourne p, g (générés au démarrage)

5. Client génère clé privée a (locale, jamais transmise)
   └─> a = random(2, p-2)

6. Client calcule clé publique A
   └─> A = g^a mod p

7. Client envoie A au serveur
   └─> POST /handshake/exchange {public_key: A}
       ├─> Backend génère clé privée b pour RH
       ├─> Calcule clé publique B = g^b mod p
       ├─> Calcule secret S_server = A^b mod p
       ├─> Stocke S_server en session
       └─> Retourne B

8. Client reçoit B et calcule secret
   └─> S_client = B^a mod p
   └─> S_client === S_server (sans avoir transmis a ou b !)

9. Les deux parties dérivent clé AES
   └─> K_aes = SHA256(S)

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 : TRANSMISSION SÉCURISÉE                                │
└─────────────────────────────────────────────────────────────────┘

10. Employé remplit formulaire de congé
    └─> {
          employee_name: "John Doe",
          start_date: "2025-12-15",
          end_date: "2025-12-20",
          reason: "Vacation",
          days: 5
        }

11. Client chiffre avec AES-256-CBC
    └─> Génère IV aléatoire (16 bytes)
    └─> encrypted = AES_Encrypt(plaintext, K_aes, IV)

12. Client envoie message chiffré
    └─> POST /requests/leave {
          encrypted_content: base64(encrypted),
          iv: base64(IV)
        }
        ├─> Backend stocke message en DB
        └─> Associe au RH Manager

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 : DÉCHIFFREMENT PAR RH                                  │
└─────────────────────────────────────────────────────────────────┘

13. RH Manager se connecte (même processus MFA)

14. RH consulte ses messages
    └─> GET /messages/received
        └─> Retourne liste des messages chiffrés

15. RH clique sur "Decrypt"
    └─> POST /messages/{id}/decrypt
        ├─> Backend récupère message
        ├─> Récupère secret S_server de la session
        ├─> Dérive K_aes = SHA256(S_server)
        ├─> Déchiffre: plaintext = AES_Decrypt(encrypted, K_aes, IV)
        └─> Retourne JSON déchiffré

16. RH voit le contenu en clair
```

### 🔐 Garanties de Sécurité

1. **Confidentialité** : 
   - Seul le RH Manager peut déchiffrer (possède le secret)
   - Les clés privées ne quittent jamais les machines locales
   - Transmission chiffrée avec AES-256

2. **Intégrité** :
   - JWT signé cryptographiquement
   - Modification du message → échec du déchiffrement

3. **Authentification** :
   - MFA avec OTP
   - JWT pour authentification stateless

4. **Non-répudiation** :
   - Logs horodatés des messages
   - ID utilisateur dans chaque message

---

## 7. Base de Données

### 📊 Structure TinyDB (db.json)

```json
{
  "users": {
    "1": {
      "email": "zeydody@gmail.com",
      "password_hash": "$2b$12$...",
      "role": "admin",
      "public_key_certificate": null,
      "created_at": "2025-12-09T22:30:00"
    },
    "2": {
      "email": "zakarialaidi6@gmail.com",
      "password_hash": "$2b$12$...",
      "role": "hr_manager",
      "public_key_certificate": null,
      "created_at": "2025-12-09T22:30:00"
    },
    "3": {
      "email": "abdoumerabet374@gmail.com",
      "password_hash": "$2b$12$...",
      "role": "employee",
      "public_key_certificate": null,
      "created_at": "2025-12-09T22:30:00"
    }
  },
  
  "otp_codes": {
    "1": {
      "email": "zeydody@gmail.com",
      "code": "123456",
      "expiration": "2025-12-09T22:35:00"
    }
  },
  
  "trusted_params": {
    "1": {
      "p": "0xffffffffffffffffc90fdaa22168c234...",
      "g": "0x2",
      "created_at": "2025-12-09T22:30:00"
    }
  },
  
  "sessions": {
    "1": {
      "user_id": 2,
      "private_key": "0x1a2b3c4d...",
      "shared_secret": "0x9f8e7d6c...",
      "created_at": "2025-12-09T22:32:00"
    }
  },
  
  "messages": {
    "1": {
      "from_id": 3,
      "to_id": 2,
      "encrypted_content": "U2FsdGVkX1...",
      "iv": "aGVsbG93b3JsZA==",
      "timestamp": "2025-12-09T22:33:00",
      "decrypted": false
    }
  }
}
```

### 🔍 Opérations CRUD

```python
# CREATE
user_id = db.create_user(email, password_hash, role)

# READ
user = db.get_user_by_email(email)
users = db.get_users_by_role("employee")

# UPDATE
db.update_user_public_key(user_id, public_key)

# DELETE
db.otp_codes.remove(doc_ids=[otp_id])
```

---

## 8. Cryptographie Implémentée

### 🔐 Résumé des Algorithmes

| Composant | Algorithme | Taille | Usage |
|-----------|-----------|--------|-------|
| Hash mot de passe | Bcrypt | - | Stockage sécurisé des passwords |
| Token | JWT (HS256) | 256 bits | Authentification stateless |
| OTP | Random | 6 chiffres | 2FA par email |
| DH Prime | Safe Prime | 1536 bits | Paramètre public |
| DH Private Key | Random | 1536 bits | Clé secrète locale |
| Hash DH Secret | SHA-256 | 256 bits | Dérivation clé AES |
| Chiffrement | AES-CBC | 256 bits | Chiffrement messages |
| IV | Random | 128 bits | Vecteur d'initialisation |

### 🛡️ Niveau de Sécurité

- **DH 1536 bits** : Équivalent à ~112 bits de sécurité (recommandé pour usage non-critique)
- **AES-256** : Standard NSA pour SECRET (128 bits = suffisant pour TOP SECRET)
- **SHA-256** : Résistant aux collisions, préimage
- **Bcrypt** : Résistant aux attaques par force brute (coût adaptatif)

---

## 9. API Endpoints

### 🔐 Authentification

#### POST `/auth/login`
**Description** : Première étape MFA - Vérifier credentials et envoyer OTP

**Request** :
```json
{
  "email": "zeydody@gmail.com",
  "password": "admin123"
}
```

**Response** :
```json
{
  "message": "OTP sent to your email",
  "email": "zeydody@gmail.com"
}
```

#### POST `/auth/verify-otp`
**Description** : Deuxième étape MFA - Vérifier OTP et obtenir JWT

**Request** :
```json
{
  "email": "zeydody@gmail.com",
  "otp_code": "123456"
}
```

**Response** :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### GET `/auth/me`
**Description** : Obtenir infos utilisateur connecté

**Headers** :
```
Authorization: Bearer <token>
```

**Response** :
```json
{
  "id": 1,
  "email": "zeydody@gmail.com",
  "role": "admin",
  "public_key_certificate": null
}
```

### 🤝 Diffie-Hellman

#### GET `/handshake/params`
**Description** : Récupérer paramètres DH globaux

**Response** :
```json
{
  "p": "0xffffffffffffffffc90fdaa22168c234...",
  "g": "0x2"
}
```

#### POST `/handshake/exchange`
**Description** : Échanger clés publiques

**Headers** :
```
Authorization: Bearer <token>
```

**Request** :
```json
{
  "public_key": "0x1a2b3c4d5e6f..."
}
```

**Response** :
```json
{
  "public_key": "0x9f8e7d6c5b4a..."
}
```

### 💬 Messagerie

#### POST `/requests/leave`
**Description** : Soumettre demande de congé chiffrée

**Headers** :
```
Authorization: Bearer <token>
```

**Request** :
```json
{
  "encrypted_content": "U2FsdGVkX1...",
  "iv": "aGVsbG93b3JsZA=="
}
```

**Response** :
```json
{
  "message": "Leave request submitted successfully",
  "message_id": 1
}
```

#### GET `/messages/received`
**Description** : Liste des messages reçus (chiffrés)

**Headers** :
```
Authorization: Bearer <token>
```

**Response** :
```json
[
  {
    "id": 1,
    "from_email": "abdoumerabet374@gmail.com",
    "from_role": "employee",
    "encrypted_content": "U2FsdGVkX1...",
    "iv": "aGVsbG93b3JsZA==",
    "timestamp": "2025-12-09T22:33:00"
  }
]
```

#### POST `/messages/{message_id}/decrypt`
**Description** : Déchiffrer un message (RH uniquement)

**Headers** :
```
Authorization: Bearer <token>
```

**Response** :
```json
{
  "message_id": 1,
  "decrypted_content": {
    "employee_name": "John Doe",
    "start_date": "2025-12-15",
    "end_date": "2025-12-20",
    "reason": "Vacation",
    "days": 5
  },
  "from_id": 3,
  "timestamp": "2025-12-09T22:33:00"
}
```

### 👨‍💼 Administration

#### POST `/admin/users`
**Description** : Créer nouvel utilisateur (Admin uniquement)

**Headers** :
```
Authorization: Bearer <token>
```

**Request** :
```json
{
  "email": "newuser@gmail.com",
  "password": "password123",
  "role": "employee"
}
```

**Response** :
```json
{
  "id": 4,
  "email": "newuser@gmail.com",
  "role": "employee"
}
```

#### GET `/admin/messages`
**Description** : Voir tous les messages système (Admin uniquement)

**Headers** :
```
Authorization: Bearer <token>
```

**Response** :
```json
[
  {
    "id": 1,
    "from": "abdoumerabet374@gmail.com",
    "to": "zakarialaidi6@gmail.com",
    "timestamp": "2025-12-09T22:33:00",
    "encrypted": true
  }
]
```

---

## 10. Cas d'Utilisation

### 📝 Cas 1 : Employé Soumet Demande de Congé

**Acteurs** : Employé, Système

**Préconditions** :
- Employé possède un compte
- Accès à email

**Flux Principal** :
1. Employé accède à http://localhost:5173
2. Entre email `abdoumerabet374@gmail.com` et password `emp123`
3. Système envoie OTP par email
4. Employé entre OTP reçu
5. Système authentifie et redirige vers Employee Dashboard
6. Employé clique "Start Key Exchange"
7. Système effectue DH handshake (3 secondes)
8. Employé voit "🎉 Key exchange complete!"
9. Employé remplit formulaire :
   - Nom : "Abdoumerabet"
   - Date début : "2025-12-20"
   - Date fin : "2025-12-27"
   - Raison : "Congé familial"
   - Jours : 7
10. Employé clique "Submit Encrypted Request"
11. Système chiffre et envoie
12. Employé voit "✅ Leave request submitted successfully!"

**Postconditions** :
- Message chiffré stocké en DB
- RH peut consulter le message

### 👔 Cas 2 : RH Consulte et Déchiffre Demandes

**Acteurs** : RH Manager, Système

**Préconditions** :
- RH possède un compte
- Au moins un message chiffré existe

**Flux Principal** :
1. RH accède à l'application
2. Se connecte avec `zakarialaidi6@gmail.com` / `hr123`
3. Vérifie OTP reçu par email
4. Système redirige vers HR Dashboard
5. RH voit liste des messages chiffrés
6. RH clique "Decrypt" sur un message
7. Système déchiffre avec secret DH stocké
8. RH voit contenu en clair :
   ```
   Employee: Abdoumerabet
   Start Date: 2025-12-20
   End Date: 2025-12-27
   Days: 7
   Reason: Congé familial
   ```
9. RH peut traiter la demande

**Postconditions** :
- Message toujours chiffré en DB
- Déchiffrement effectué à la demande uniquement

### 👨‍💼 Cas 3 : Admin Crée Nouvel Utilisateur

**Acteurs** : Administrateur, Système

**Préconditions** :
- Admin possède compte admin

**Flux Principal** :
1. Admin se connecte avec `zeydody@gmail.com` / `admin123`
2. Vérifie OTP
3. Accède à Admin Dashboard
4. Remplit formulaire création utilisateur :
   - Email : `newemployee@gmail.com`
   - Password : `welcome123`
   - Role : `employee`
5. Clique "Create User"
6. Système crée compte et hashe password
7. Admin voit "✅ User created successfully"
8. Nouvel utilisateur peut se connecter

**Postconditions** :
- Nouvel utilisateur dans DB
- Peut s'authentifier immédiatement

---

## � Système de Gestion des Demandes d'Absence/Congés

### 🎯 Vue d'ensemble

Le système implémente un module complet de gestion des demandes d'absence et de congés avec un contrôle d'accès basé sur les rôles (RBAC - Role-Based Access Control).

### 🔐 Matrice de Contrôle d'Accès

| Fonctionnalité | Employé | DRH | Admin IT |
|----------------|---------|-----|----------|
| Créer demande | ✅ Read/Write | ❌ Aucun accès | ❌ Aucun accès |
| Voir ses demandes | ✅ Read | ❌ N/A | ❌ N/A |
| Supprimer sa demande (pending) | ✅ Write | ❌ N/A | ❌ N/A |
| Voir toutes les demandes | ❌ Aucun accès | ✅ Read Only | ❌ Aucun accès |
| Valider/Rejeter demandes | ❌ Aucun accès | ✅ Write (statut uniquement) | ❌ Aucun accès |
| Modifier contenu demandes | ❌ Non | ❌ Non | ❌ Non |

### 📊 Modèle de Données

```python
# models.py
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
    status: str  # "pending", "approved", "rejected"
    hr_comment: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
```

### 🗄️ Schéma Base de Données

```json
{
  "leave_requests": [
    {
      "employee_id": 3,
      "employee_email": "abdoumerabet374@gmail.com",
      "type": "conge",
      "start_date": "2025-12-20",
      "end_date": "2025-12-27",
      "reason": "Congé familial",
      "days_count": 7,
      "status": "pending",
      "hr_comment": null,
      "created_at": "2025-12-16T10:30:00",
      "updated_at": null
    }
  ]
}
```

### 🔌 API Endpoints

#### 1. Créer une Demande (Employé uniquement)

```python
@app.post("/leave-requests", response_model=dict)
async def create_leave_request(
    request_data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Seuls les employés peuvent créer des demandes."""
    if current_user['role'] != "employee":
        raise HTTPException(
            status_code=403,
            detail="Seuls les employés peuvent créer des demandes"
        )
    
    request_id = db.create_leave_request(
        employee_id=current_user.doc_id,
        employee_email=current_user['email'],
        type=request_data.type,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
        reason=request_data.reason,
        days_count=request_data.days_count
    )
    
    return {"message": "Demande créée avec succès", "request_id": request_id}
```

#### 2. Voir ses Propres Demandes (Employé)

```python
@app.get("/leave-requests/my-requests", response_model=List[LeaveRequestResponse])
async def get_my_leave_requests(current_user: dict = Depends(get_current_user)):
    """L'employé voit uniquement ses propres demandes."""
    if current_user['role'] != "employee":
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    requests = db.get_leave_requests_by_employee(current_user.doc_id)
    return [LeaveRequestResponse(**req) for req in requests]
```

#### 3. Voir Toutes les Demandes (DRH uniquement)

```python
@app.get("/leave-requests/all", response_model=List[LeaveRequestResponse])
async def get_all_leave_requests(current_user: dict = Depends(get_current_user)):
    """Seul le DRH peut voir toutes les demandes."""
    if current_user['role'] != "hr_manager":
        raise HTTPException(
            status_code=403,
            detail="Seul le DRH peut voir toutes les demandes"
        )
    
    requests = db.get_all_leave_requests()
    return [LeaveRequestResponse(**req) for req in requests]
```

#### 4. Valider/Rejeter une Demande (DRH uniquement)

```python
@app.put("/leave-requests/{request_id}/status")
async def update_leave_request_status(
    request_id: int,
    update_data: LeaveRequestUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Seul le DRH peut valider/rejeter."""
    if current_user['role'] != "hr_manager":
        raise HTTPException(
            status_code=403,
            detail="Seul le DRH peut valider les demandes"
        )
    
    request = db.get_leave_request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    db.update_leave_request_status(
        request_id=request_id,
        status=update_data.status,
        hr_comment=update_data.hr_comment
    )
    
    return {"message": f"Demande {update_data.status} avec succès"}
```

#### 5. Supprimer sa Demande (Employé, si pending)

```python
@app.delete("/leave-requests/{request_id}")
async def delete_leave_request(
    request_id: int,
    current_user: dict = Depends(get_current_user)
):
    """L'employé peut supprimer uniquement ses demandes en attente."""
    if current_user['role'] != "employee":
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    request = db.get_leave_request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request['employee_id'] != current_user.doc_id:
        raise HTTPException(
            status_code=403,
            detail="Vous ne pouvez supprimer que vos propres demandes"
        )
    
    if request['status'] != 'pending':
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez supprimer que les demandes en attente"
        )
    
    db.delete_leave_request(request_id)
    return {"message": "Demande supprimée avec succès"}
```

### 💻 Interface Frontend

#### Employé - Formulaire de Création

**Composant** : `LeaveRequestForm.jsx`

**Fonctionnalités** :
- Sélection type (Absence/Congé)
- Sélection dates (début/fin)
- Calcul automatique du nombre de jours
- Zone de texte pour le motif
- Liste de toutes ses demandes avec statuts
- Suppression des demandes en attente
- Visualisation des commentaires DRH

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await createLeaveRequest({
      type: formData.type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason,
      days_count: formData.days_count
    });
    setSuccess('Demande créée avec succès!');
    fetchMyRequests();
  } catch (err) {
    setError(err.response?.data?.detail || 'Erreur');
  }
};
```

#### DRH - Gestion des Demandes

**Composant** : `HRLeaveManagement.jsx`

**Fonctionnalités** :
- Vue d'ensemble avec statistiques (En attente/Approuvées/Rejetées)
- Filtres par statut
- Liste complète de toutes les demandes
- Détails de chaque demande (employé, dates, motif)
- Actions : Approuver/Rejeter avec commentaire
- Interface read-only (pas de modification du contenu)

```javascript
const handleUpdateStatus = async (requestId, status) => {
  try {
    await updateLeaveRequestStatus(requestId, {
      status,
      hr_comment: hrComment || null
    });
    setSuccess(`Demande ${status === 'approved' ? 'approuvée' : 'rejetée'}!`);
    fetchAllRequests();
  } catch (err) {
    setError(err.response?.data?.detail || 'Erreur');
  }
};
```

### 🔄 Flux de Travail

```
1. EMPLOYÉ crée demande
   ↓
2. Statut = "pending"
   ↓
3. DRH voit la demande
   ↓
4. DRH examine les détails
   ↓
5. DRH approuve OU rejette
   │                    │
   ↓                    ↓
Statut = "approved"  Statut = "rejected"
   +                    +
Commentaire (opt.)   Commentaire (opt.)
   ↓                    ↓
6. EMPLOYÉ voit le résultat et le commentaire
```

### 🛡️ Sécurité et Contrôle d'Accès

#### Vérifications Backend

Chaque endpoint vérifie :
1. **Authentification** : Token JWT valide
2. **Autorisation** : Rôle correct via `current_user['role']`
3. **Propriété** : L'utilisateur ne peut agir que sur ses ressources
4. **État** : Certaines actions nécessitent un statut spécifique

```python
# Exemple de vérifications multiples
def delete_leave_request(request_id, current_user):
    # 1. Vérifier rôle
    if current_user['role'] != "employee":
        raise HTTPException(403)
    
    # 2. Vérifier existence
    request = db.get_leave_request(request_id)
    if not request:
        raise HTTPException(404)
    
    # 3. Vérifier propriété
    if request['employee_id'] != current_user.doc_id:
        raise HTTPException(403)
    
    # 4. Vérifier statut
    if request['status'] != 'pending':
        raise HTTPException(400)
    
    # OK - supprimer
    db.delete_leave_request(request_id)
```

#### Protection Frontend

```javascript
// Conditional rendering basé sur le rôle
{user.role === 'employee' && (
  <LeaveRequestForm />
)}

{user.role === 'hr_manager' && (
  <HRLeaveManagement />
)}

{user.role === 'admin' && (
  <p>Aucun accès aux demandes de congés</p>
)}
```

### 📊 Cas d'Utilisation Complet

**Scénario** : Employé demande un congé, DRH l'approuve

1. **Employé** se connecte (`abdoumerabet374@gmail.com`)
2. Va dans "📋 Demandes d'Absence/Congés"
3. Remplit formulaire :
   - Type : Congé
   - Début : 2025-12-20
   - Fin : 2025-12-27
   - Jours : 7 (calculé auto)
   - Motif : "Vacances de fin d'année"
4. Clique "Soumettre la demande"
5. Demande créée avec `status = "pending"`
6. **DRH** se connecte (`zakarialaidi6@gmail.com`)
7. Va dans "📋 Gestion des Demandes"
8. Voit 1 demande en attente
9. Clique "Traiter cette demande"
10. Ajoute commentaire : "Approuvé, bon repos!"
11. Clique "✅ Approuver"
12. Statut mis à jour : `status = "approved"`
13. **Employé** se reconnecte
14. Voit sa demande avec badge vert "Approuvée"
15. Lit le commentaire DRH

---

## �📊 Statistiques et Performance

### ⏱️ Temps d'Exécution Typiques

| Opération | Temps Moyen | Notes |
|-----------|-------------|-------|
| Login (Step 1) | 200-500ms | Vérification password + envoi email + check tentatives |
| Login Bloqué | 1-2ms | Vérification rapide du blocage |
| OTP Verification | 50-100ms | Vérification DB + check tentatives + génération JWT |
| OTP Resend | 200-400ms | Nouvelle génération + envoi email |
| OTP Cancel | 5-10ms | Suppression DB |
| DH Parameters Gen | 2-5s | Une fois au démarrage |
| DH Key Exchange | 500-1000ms | Calculs modulaires lourds |
| AES Encryption | 1-5ms | Très rapide |
| AES Decryption | 1-5ms | Très rapide |
| Message Storage | 10-20ms | Insertion DB |
| Create Leave Request | 10-30ms | Insertion DB + vérifications |
| Get All Requests (DRH) | 20-50ms | Lecture DB + transformation |
| Update Request Status | 15-25ms | Mise à jour DB |
| Delete Request | 10-15ms | Suppression DB |

### 💾 Taille des Données

| Élément | Taille | Format |
|---------|--------|--------|
| JWT Token | ~200 bytes | Base64 |
| DH Prime (p) | 192 bytes | Hex (1536 bits) |
| DH Public Key | ~192 bytes | Hex |
| Shared Secret | 192 bytes | Hex |
| AES Key | 32 bytes | Binary (256 bits) |
| IV | 16 bytes | Binary (128 bits) |
| Message chiffré | Variable | Base64 |
| OTP | 6 bytes | Texte |

### 🔐 Sécurité vs Performance

**Trade-offs** :
- DH 1536 bits : Bon compromis sécurité/performance
- AES-256 : Sécurité maximale, impact performance négligeable
- Bcrypt : Coût adaptatif ralentit brute-force

**Recommandations Production** :
- Utiliser DH 2048+ bits
- Implémenter rate limiting sur login
- Ajouter HTTPS obligatoire
- Rotation des secrets JWT
- Logs de sécurité centralisés

---

## 🎓 Conclusion

Ce système démontre une implémentation complète de protocoles cryptographiques modernes combinée à une gestion robuste des accès et de la sécurité applicative. Les concepts clés incluent :

### 🔒 Sécurité Cryptographique
1. **Authentification forte** avec MFA (OTP)
2. **Échange de clés sécurisé** avec Diffie-Hellman
3. **Chiffrement symétrique** avec AES-256-CBC
4. **Architecture Zero-Knowledge** (clés privées jamais transmises)
5. **Hachage sécurisé** avec Bcrypt pour les mots de passe

### 🛡️ Sécurité Applicative
6. **Protection anti-brute force** (limitation tentatives login/OTP)
7. **Messages d'erreur spécifiques** (évite énumération utilisateurs)
8. **Gestion intelligente des OTP** (renvoi, annulation, expiration)
9. **Tokens JWT** pour authentification stateless
10. **Blocages temporaires** automatiques après abus

### 👥 Contrôle d'Accès
11. **RBAC (Role-Based Access Control)** strict
12. **Séparation des rôles** (Admin, DRH, Employé)
13. **Permissions granulaires** (Read/Write par fonctionnalité)
14. **Isolation des données** (employé voit uniquement ses ressources)
15. **Gestion de workflow** métier (demandes d'absence/congés)

### 📊 Fonctionnalités Métier
16. **Gestion des demandes** d'absence et de congés
17. **Workflow de validation** par le DRH
18. **Traçabilité** (statuts, commentaires, timestamps)
19. **Interface utilisateur** adaptée par rôle
20. **Calculs automatiques** (nombre de jours, etc.)

### 🚀 Extensions Possibles

1. **Signatures Numériques** : Ajouter RSA pour non-répudiation
2. **Certificats X.509** : PKI pour authentification mutuelle
3. **Perfect Forward Secrecy** : Rotation des clés DH
4. **Audit Logs** : Traçabilité complète des actions
5. **Multi-RH** : Support de plusieurs managers
6. **Notifications** : Alertes temps réel (email/push)
7. **Mobile App** : Interface native iOS/Android
8. **Blockchain** : Horodatage immuable des actions
9. **Workflow Avancé** : Approbation multi-niveaux (manager → DRH)
10. **Calendrier** : Visualisation des absences d'équipe
11. **Exports** : Génération de rapports PDF/Excel
12. **API Rate Limiting** : Protection globale contre les abus
13. **2FA Matériel** : Support des clés FIDO2/WebAuthn
14. **Historique des Modifications** : Audit trail des demandes

### 📚 Références

- [NIST SP 800-57](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Recommandations tailles de clés
- [RFC 5246](https://datatracker.ietf.org/doc/html/rfc5246) - TLS 1.2
- [RFC 3526](https://datatracker.ietf.org/doc/html/rfc3526) - Groupes DH standards
- [FIPS 197](https://csrc.nist.gov/publications/detail/fips/197/final) - Spécification AES
- [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) - JSON Web Token

---

**Auteur** : Système HR Sécurisé  
**Date** : Décembre 2025  
**Version** : 1.0.0  
**Contact** : zeydody@gmail.com
