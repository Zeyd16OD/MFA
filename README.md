# 🔒 Secure HR Management System

A full-stack web application demonstrating secure communication using Multi-Factor Authentication (MFA), Diffie-Hellman Key Exchange, and AES Encryption.

## 🏗️ Architecture

### Backend (FastAPI + Python)
- **Authentication**: Email/Password + OTP (sent via Gmail SMTP)
- **Encryption**: Diffie-Hellman Key Exchange + AES-256-CBC
- **Database**: TinyDB (JSON-based, stored in `db.json`)
- **Security**: JWT tokens, password hashing with bcrypt

### Frontend (React + Vite)
- **UI**: Tailwind CSS for modern, responsive design
- **Crypto**: Web Crypto API for client-side encryption
- **Routing**: Role-based dashboards (Employee, HR, Admin)

## 📋 Features

### 🔐 Multi-Factor Authentication
1. User logs in with email/password
2. System sends 6-digit OTP to user's email
3. User verifies OTP to receive JWT token

### 🤝 Diffie-Hellman Key Exchange
- Trusted Third Party (TTP) generates global parameters (p, g)
- Employee and HR Manager exchange public keys
- Both parties derive shared secret independently
- Shared secret is used to generate AES encryption key

### 🔒 End-to-End Encryption
- Employee encrypts leave requests with AES-256
- Only HR Manager (with shared secret) can decrypt
- Messages transmitted securely over the network

## 🚀 Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- Gmail account with App Password

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file (copy from `.env.template`):
```bash
cp .env.template .env
```

5. **IMPORTANT**: Edit `.env` and configure:
```ini
MAIL_USERNAME=zeydody@gmail.com
MAIL_PASSWORD=your_google_app_password_here  # Generate from Google Account settings
MAIL_FROM=zeydody@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
SECRET_KEY=your_super_secret_jwt_key_change_this  # Generate a strong random key
DATABASE_PATH=db.json
```

6. Run the backend:
```bash
python main.py
```

Backend will run on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## 👥 Default Users

The system creates default users on first startup:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@company.com | admin123 |
| HR Manager | hr@company.com | hr123 |
| Employee | employee@company.com | emp123 |
| Employee | zeydody@gmail.com | password123 |

## 📧 Gmail App Password Setup

To send OTP emails, you need a Google App Password:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not enabled)
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Generate a new app password for "Mail"
5. Copy the 16-character password
6. Paste it in `.env` as `MAIL_PASSWORD`

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/verify-otp` - Verify OTP code
- `GET /auth/me` - Get current user info

### Diffie-Hellman Handshake
- `GET /handshake/params` - Get global DH parameters (p, g)
- `POST /handshake/exchange` - Exchange public keys

### Messaging
- `POST /requests/leave` - Submit encrypted leave request
- `GET /messages/received` - Get received messages
- `POST /messages/{id}/decrypt` - Decrypt message (HR only)

### Admin
- `POST /admin/users` - Create new user (Admin only)
- `GET /admin/messages` - View all messages (Admin only)

## 🎯 User Workflows

### Employee Workflow
1. Login with credentials
2. Verify OTP from email
3. Perform DH key exchange
4. Submit encrypted leave request
5. Request is securely transmitted to HR

### HR Manager Workflow
1. Login with credentials
2. Verify OTP from email
3. View encrypted messages
4. Decrypt messages to read leave requests
5. Decryption uses shared secret from DH exchange

### Admin Workflow
1. Login with credentials
2. Verify OTP from email
3. Create new user accounts
4. View system statistics
5. Monitor all encrypted messages (cannot decrypt)

## 🔐 Security Details

### Diffie-Hellman Parameters
- Prime `p`: 1536-bit safe prime
- Generator `g`: 2
- Private keys: Random 1536-bit integers
- Public keys: `g^private mod p`
- Shared secret: `other_public^private mod p`

### AES Encryption
- Algorithm: AES-256-CBC
- Key derivation: SHA-256 of shared secret
- IV: Random 16 bytes per message
- Padding: PKCS7

### JWT Tokens
- Algorithm: HS256
- Expiration: 60 minutes
- Payload: user email, role, user_id

## 📁 Project Structure

```
MFA/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── models.py            # Pydantic models
│   ├── security.py          # Crypto & security functions
│   ├── database.py          # TinyDB operations
│   ├── requirements.txt     # Python dependencies
│   ├── .env.template        # Environment template
│   └── db.json              # Database (auto-generated)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.jsx              # Login & OTP verification
    │   │   ├── EmployeeDashboard.jsx  # Employee interface
    │   │   ├── HRDashboard.jsx        # HR interface
    │   │   └── AdminDashboard.jsx     # Admin interface
    │   ├── App.jsx              # Main application
    │   ├── api.js               # API client
    │   ├── crypto.js            # Client-side crypto utilities
    │   ├── main.jsx             # Entry point
    │   └── index.css            # Tailwind styles
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

## 🧪 Testing

1. Start backend: `python backend/main.py`
2. Start frontend: `npm run dev` (in frontend directory)
3. Open browser: `http://localhost:5173`
4. Login as Employee: `employee@company.com` / `emp123`
5. Check email for OTP (use your own email if configured)
6. Complete key exchange
7. Submit encrypted leave request
8. Login as HR Manager to decrypt and view request

## 🐛 Troubleshooting

### Email not sending
- Verify Gmail App Password is correct
- Check that 2-Step Verification is enabled
- Ensure firewall allows SMTP port 587

### Frontend can't connect to backend
- Verify backend is running on port 8000
- Check CORS configuration in `main.py`
- Ensure no other service is using port 8000

### Decryption fails
- Complete DH key exchange before sending messages
- Ensure both parties use same DH parameters
- Check that shared secret is calculated correctly

## 📝 License

This project is for educational purposes to demonstrate secure communication protocols.

## 🙏 Credits

Built with:
- FastAPI (Backend framework)
- React + Vite (Frontend)
- Tailwind CSS (Styling)
- TinyDB (Database)
- Python Cryptography (Security)
- Web Crypto API (Client-side encryption)
