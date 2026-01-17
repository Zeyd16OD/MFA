# 📊 Rapport Système HR Sécurisé

## 🎯 Vue d'Ensemble

Système de gestion RH qui implémente une communication sécurisée end-to-end entre employés et responsables RH utilisant :
- **Authentification Multi-Facteurs (MFA)** via OTP email avec protection brute-force
- **Autorisation Admin** pour valider les demandes avant établissement du canal sécurisé
- **Échange de clés Diffie-Hellman** généré côté serveur après approbation Admin
- **Chiffrement AES-256-CBC** pour les données sensibles

### Technologies
- **Backend** : FastAPI, TinyDB, Python Cryptography
- **Frontend** : React + Vite, Tailwind CSS, Web Crypto API
- **Email** : Gmail SMTP (FastAPI-Mail)

---

## 🏗️ Architecture du Système

### Diagramme d'Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT (Navigateur)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  React Application                                  │  │
│  │  • Interfaces utilisateur (Login, Dashboards)      │  │
│  │  • Crypto API (DH + AES côté client)              │  │
│  │  • Gestion JWT token (localStorage)                │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                         │
                         │ HTTP/REST API
                         │ (localhost:5173 → localhost:8000)
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 SERVEUR BACKEND (FastAPI)                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Couche API                                         │  │
│  │  • Endpoints REST                                   │  │
│  │  • Authentification JWT                             │  │
│  │  • Validation Pydantic                              │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Couche Sécurité                                    │  │
│  │  • Gestion DH (génération paramètres, exchange)    │  │
│  │  • Chiffrement/Déchiffrement AES                   │  │
│  │  • Hachage passwords (Bcrypt)                      │  │
│  │  • Génération OTP                                   │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Base de Données (TinyDB - db.json)                │  │
│  │  • users (comptes utilisateurs)                    │  │
│  │  • otp_codes (codes temporaires)                   │  │
│  │  • messages (données chiffrées)                    │  │
│  │  • sessions (secrets DH)                           │  │
│  │  • trusted_params (paramètres DH globaux)          │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                         │
                         │ SMTP (TLS)
                         ▼
┌──────────────────────────────────────────────────────────┐
│           Service Email (Gmail - smtp.gmail.com:587)      │
│           • Envoi codes OTP                               │
│           • Configuration : zeydody@gmail.com             │
└──────────────────────────────────────────────────────────┘
```

### Acteurs du Système

| Rôle | Email | Permissions |
|------|-------|-------------|
| **Admin** | zeydody@gmail.com | Créer utilisateurs, autoriser/refuser les communications, voir statistiques |
| **HR Manager** | zakarialaidi6@gmail.com | Déchiffrer messages, consulter demandes approuvées |
| **Employee** | abdoumerabet374@gmail.com | Soumettre demandes de congé (requiert autorisation Admin) |

---

## 📊 Diagrammes de Séquence

### 1. Authentification MFA (Login + OTP)

```
Employé              Frontend            Backend              SMTP              Base de Données
   │                    │                   │                   │                      │
   │─ Enter email/pwd ─>│                   │                   │                      │
   │                    │─ POST /auth/login ┤                   │                      │
   │                    │                   │─ Verify password ─┤                      │
   │                    │                   │<─ User found ─────┤                      │
   │                    │                   │─ Generate OTP ────┤                      │
   │                    │                   │─ Store OTP + exp ─┤                      │
   │                    │                   │<─ Stored ─────────┤                      │
   │                    │                   │─ Send email ──────>│                      │
   │                    │<─ "OTP sent" ─────│                   │                      │
   │<─ Show OTP input ──│                   │                   │                      │
   │                    │                   │                   │                      │
   │─ Receive email ────┴───────────────────┴───────────────────┤                      │
   │<─ OTP: 123456 ─────────────────────────────────────────────┤                      │
   │                    │                   │                   │                      │
   │─ Enter OTP ───────>│                   │                   │                      │
   │                    │─ POST /auth/verify│                   │                      │
   │                    │                   │─ Verify OTP ──────┤                      │
   │                    │                   │<─ Valid + Delete ─┤                      │
   │                    │                   │─ Create JWT token │                      │
   │                    │<─ JWT token ──────│                   │                      │
   │<─ Redirect Dashboard│                   │                   │                      │
   │                    │─ Store token ─────┤                   │                      │
   │                    │  (localStorage)   │                   │                      │
```

### 2. Autorisation Admin et Échange de Clés DH (Côté Serveur)

```
Employé              Admin                   Backend                    HR Manager           Base de Données
   │                    │                       │                           │                      │
   │─ Submit leave ────>│                       │                           │                      │
   │                    │                       │─ Store request ───────────┤                      │
   │                    │                       │─ Create auth pending ─────┤                      │
   │                    │                       │                           │                      │
   │                    │<─ View pending ───────│                           │                      │
   │                    │                       │                           │                      │
   │                    │─ Approve request ────>│                           │                      │
   │                    │                       │─ Fetch DH params (p, g) ──┤                      │
   │                    │                       │─ Generate private key 'a' │                      │
   │                    │                       │─ Generate private key 'b' │                      │
   │                    │                       │─ Calculate A = g^a mod p  │                      │
   │                    │                       │─ Calculate B = g^b mod p  │                      │
   │                    │                       │─ Calculate S = A^b mod p  │                      │
   │                    │                       │─ Derive AES key = SHA256(S)                      │
   │                    │                       │─ Encrypt message with AES │                      │
   │                    │                       │─ Store encrypted message ─┤                      │
   │                    │                       │─ Update status: approved ─┤                      │
   │                    │                       │                           │                      │
   │                    │                       │                          <│─ GET /leave-requests │
   │                    │                       │──────────────────────────>│  (approved only)     │
   │                    │                       │                           │                      │
   
Note: Les clés DH sont générées côté serveur après approbation Admin.
L'employé n'effectue plus d'échange de clés - tout est automatisé après autorisation.
```

### 3. Flux Complet : Soumission → Autorisation → Chiffrement → Consultation

```
Employé              Admin                   Backend                    HR Manager           Base de Données
   │                    │                       │                           │                      │
   │─ Fill leave form ─>│                       │                           │                      │
   │  (plaintext)       │                       │                           │                      │
   │─ POST /leave-requests ────────────────────>│                           │                      │
   │                    │                       │─ Store leave request ─────┤                      │
   │                    │                       │─ Create comm auth (pending)──────────────────────┤
   │<─ "Demande soumise"│                       │                           │                      │
   │                    │                       │                           │                      │
   │                    │<─ GET /comm-auth/pending                          │                      │
   │                    │                       │<─ List pending ───────────┤                      │
   │                    │                       │                           │                      │
   │                    │─ PUT /comm-auth/{id} ─>│                           │                      │
   │                    │  {status: "approved"} │                           │                      │
   │                    │                       │─ Generate DH keys (a, b)  │                      │
   │                    │                       │─ Compute shared secret S  │                      │
   │                    │                       │─ Derive AES key from S    │                      │
   │                    │                       │─ Encrypt leave request    │                      │
   │                    │                       │─ Create encrypted message ┤                      │
   │                    │                       │─ Update status + store ───┤                      │
   │                    │<─ "Approved" ─────────│                           │                      │
   │                    │                       │                           │                      │
   │                    │                       │<─ GET /leave-requests/all │                      │
   │                    │                       │  (filter: approved only)  │                      │
   │                    │                       │──────────────────────────>│                      │
   │                    │                       │                           │<─ View requests ─────│
```

---

## 🔐 Fonctionnalités Principales

### 1. Authentification Multi-Facteurs (MFA)

**Description** : Processus d'authentification en 2 étapes pour renforcer la sécurité.

**Flux** :
1. Utilisateur entre email + mot de passe
2. Backend vérifie les credentials (password haché avec Bcrypt)
3. Génération d'un code OTP à 6 chiffres
4. Envoi du code par email via SMTP Gmail
5. Utilisateur entre le code reçu
6. Backend vérifie l'OTP (validité 5 minutes)
7. Émission d'un token JWT (valide 60 minutes)

**Sécurité** :
- Passwords hachés avec Bcrypt (résistant à brute-force)
- OTP usage unique et temporaire
- JWT signé cryptographiquement (HS256)

### 2. Autorisation Admin + Génération DH Côté Serveur

**Description** : L'Admin contrôle l'établissement des communications sécurisées. Les clés DH sont générées côté serveur après approbation.

**Processus** :
1. Employé soumet une demande de congé (texte clair)
2. Système crée une demande d'autorisation en attente
3. Admin consulte les demandes en attente
4. Admin approuve ou refuse la demande
5. Si approuvé :
   - Serveur récupère paramètres DH `p` et `g`
   - Serveur génère clés privées `a` et `b`
   - Serveur calcule `A = g^a mod p` et `B = g^b mod p`
   - Serveur calcule secret partagé `S = A^b mod p`
   - Serveur dérive clé AES et chiffre le message
   - Message chiffré stocké et visible par RH
6. Si refusé : aucune communication établie

**Mathématiques** (côté serveur) :
```
S = A^b mod p = (g^a)^b mod p = g^(ab) mod p
AES_key = SHA-256(S)
ciphertext = AES-256-CBC(plaintext, AES_key, IV)
```

### 3. Chiffrement AES-256-CBC

**Description** : Chiffrement symétrique des messages avec AES.

**Implémentation** :
1. Dérivation clé AES : `K = SHA-256(secret_DH)`
2. Génération IV aléatoire (16 bytes)
3. Chiffrement : `C = AES-256-CBC(plaintext, K, IV)`
4. Transmission de `C` (base64) et `IV` (base64)
5. Déchiffrement : `plaintext = AES-256-CBC-Decrypt(C, K, IV)`

**Sécurité** :
- AES-256 : Standard NSA pour données SECRET
- Mode CBC : Chaque bloc dépend du précédent
- IV unique : Empêche pattern recognition

### 4. Gestion des Rôles

**Description** : Contrôle d'accès basé sur les rôles (RBAC) avec workflow d'autorisation.

| Rôle | Permissions |
|------|-------------|
| **Employee** | • Soumettre demandes de congé<br>• Consulter statut de ses demandes<br>• Voir historique des autorisations |
| **HR Manager** | • Consulter demandes approuvées<br>• Déchiffrer les messages<br>• Gérer les demandes de congé |
| **Admin** | • Créer de nouveaux utilisateurs<br>• **Approuver/Refuser les demandes de communication**<br>• Voir statistiques système<br>• Déclencher la génération DH et le chiffrement |

**Implémentation** :
- JWT contient le rôle de l'utilisateur
- Backend vérifie le rôle avant chaque action
- Frontend adapte l'interface selon le rôle

### 5. Communication Sécurisée avec Autorisation Admin

**Description** : Communication sécurisée contrôlée par l'Admin avant établissement du canal chiffré.

**Garanties** :
- **Contrôle d'accès** : Admin valide chaque communication avant chiffrement
- **Confidentialité** : Seul le RH peut lire (après déchiffrement)
- **Intégrité** : Modification détectée (échec déchiffrement)
- **Authentification** : JWT vérifie l'identité à chaque étape
- **Traçabilité** : Historique des autorisations conservé

**Flux complet** :
```
Employee → [Plaintext] → Backend (stockage temporaire)
    → Admin Review → Approve/Reject
    → If Approved: DH Key Gen → AES Encrypt → [Ciphertext + IV]
    → Database (stockage chiffré) → HR Request → AES Decrypt → HR Manager
```

---

## 📡 API Endpoints

### Authentification
- `POST /auth/login` - Envoyer OTP (avec protection brute-force)
- `POST /auth/verify-otp` - Vérifier OTP et obtenir JWT (invalidation si échec)
- `GET /auth/me` - Informations utilisateur connecté

### Autorisations Communication (Admin)
- `GET /communication-auth/pending` - Liste des autorisations en attente
- `GET /communication-auth/all` - Historique complet des autorisations
- `PUT /communication-auth/{id}` - Approuver/Refuser une demande

### Demandes de Congé
- `POST /leave-requests` - Soumettre demande (crée autorisation en attente)
- `GET /leave-requests/all` - Liste demandes (filtre: approuvées seulement pour RH)
- `GET /leave-requests/my` - Mes demandes (employé)

### Messagerie
- `GET /messages/received` - Liste messages reçus (RH)
- `POST /messages/{id}/decrypt` - Déchiffrer un message (RH)

### Administration
- `POST /admin/users` - Créer utilisateur (Admin)
- `GET /admin/stats` - Statistiques système (Admin)

---

## 🔒 Sécurité Implémentée

### Algorithmes Utilisés

| Composant | Algorithme | Taille | Usage |
|-----------|-----------|--------|-------|
| Hash password | Bcrypt | - | Stockage sécurisé |
| Token | JWT (HS256) | 256 bits | Authentification |
| OTP | Random | 6 chiffres | 2FA |
| DH Prime | Safe Prime | 1536 bits | Échange clés |
| Hash DH Secret | SHA-256 | 256 bits | Dérivation AES |
| Chiffrement | AES-CBC | 256 bits | Confidentialité |
| IV | Random | 128 bits | Vecteur init |

### Principes Appliqués

1. **Defense in Depth** : Multiples couches de sécurité (MFA + Autorisation Admin + DH + AES)
2. **Contrôle Centralisé** : Admin valide toute communication avant chiffrement
3. **Perfect Forward Secrecy** : Clés DH générées à chaque approbation
4. **Least Privilege** : Utilisateurs ont seulement les permissions nécessaires
5. **Separation of Concerns** : Couches distinctes (API, sécurité, données)
6. **Brute-Force Protection** : OTP invalidé après échec de vérification

---

## �🚀 Technologies

**Backend**
```
FastAPI 0.109.0
TinyDB 4.8.0
Cryptography 42.0.0
Python-Jose 3.3.0
Passlib + Bcrypt 4.0.1
FastAPI-Mail 1.4.1
```

**Frontend**
```
React 18.2.0
Vite 5.4.21
Tailwind CSS 3.4.1
Axios 1.6.5
Web Crypto API (native)
```

