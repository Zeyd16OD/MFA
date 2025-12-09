from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from config import settings
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import secrets
import os
import base64
import random


# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


# JWT Token Management
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# OTP Generation
def generate_otp(length: int = 6) -> str:
    """Generate a random OTP code."""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


# Diffie-Hellman Key Exchange
def generate_dh_parameters():
    """
    Generate Diffie-Hellman parameters (p, g).
    Using a safe prime for security.
    For production, use larger primes (2048+ bits).
    """
    # Using a known safe prime (1536-bit) for demo purposes
    # In production, generate larger primes or use standardized groups
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


def generate_dh_private_key(p: int) -> int:
    """Generate a random private key for DH."""
    # Private key should be in range [2, p-2]
    bit_length = p.bit_length()
    return secrets.randbelow(p - 3) + 2


def calculate_dh_public_key(g: int, private_key: int, p: int) -> int:
    """Calculate public key: g^private_key mod p."""
    return pow(g, private_key, p)


def calculate_dh_shared_secret(other_public_key: int, private_key: int, p: int) -> int:
    """Calculate shared secret: other_public_key^private_key mod p."""
    return pow(other_public_key, private_key, p)


def derive_aes_key_from_secret(shared_secret: int) -> bytes:
    """
    Derive a 256-bit AES key from the DH shared secret.
    Using SHA-256 hash of the shared secret.
    """
    from hashlib import sha256
    secret_bytes = shared_secret.to_bytes((shared_secret.bit_length() + 7) // 8, byteorder='big')
    return sha256(secret_bytes).digest()


# AES Encryption/Decryption
def aes_encrypt(plaintext: str, key: bytes) -> tuple[str, str]:
    """
    Encrypt plaintext using AES-256-CBC.
    Returns (encrypted_content_base64, iv_base64).
    """
    # Generate random IV
    iv = os.urandom(16)
    
    # Pad plaintext to be multiple of 16 bytes
    plaintext_bytes = plaintext.encode('utf-8')
    padding_length = 16 - (len(plaintext_bytes) % 16)
    padded_plaintext = plaintext_bytes + bytes([padding_length] * padding_length)
    
    # Encrypt
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_plaintext) + encryptor.finalize()
    
    # Return base64 encoded
    return base64.b64encode(encrypted).decode('utf-8'), base64.b64encode(iv).decode('utf-8')


def aes_decrypt(encrypted_content_base64: str, iv_base64: str, key: bytes) -> str:
    """
    Decrypt AES-256-CBC encrypted content.
    """
    # Decode from base64
    encrypted = base64.b64decode(encrypted_content_base64)
    iv = base64.b64decode(iv_base64)
    
    # Decrypt
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()
    
    # Remove padding
    padding_length = decrypted_padded[-1]
    decrypted = decrypted_padded[:-padding_length]
    
    return decrypted.decode('utf-8')
