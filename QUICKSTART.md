# 🚀 Quick Start Guide

## Step 1: Backend Setup

```powershell
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
copy .env.template .env

# Edit .env file with your Gmail App Password
# IMPORTANT: Set MAIL_PASSWORD to your Google App Password
notepad .env
```

## Step 2: Configure Gmail App Password

1. Visit: https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Visit: https://myaccount.google.com/apppasswords
4. Generate new app password for "Mail"
5. Copy the 16-character password
6. Paste in `.env` file as `MAIL_PASSWORD`

Your `.env` should look like:
```ini
MAIL_USERNAME=zeydody@gmail.com
MAIL_PASSWORD=abcd efgh ijkl mnop  # Your 16-char app password
MAIL_FROM=zeydody@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
SECRET_KEY=change_this_to_a_long_random_string
```

## Step 3: Run Backend

```powershell
# Still in backend directory with venv activated
python main.py
```

You should see:
```
Generating Diffie-Hellman parameters...
DH Parameters generated: p=0xfffffffffffff...
Admin created: admin@company.com / admin123
HR Manager created: hr@company.com / hr123
Employee created: employee@company.com / emp123
Employee created: zeydody@gmail.com / password123
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 4: Frontend Setup (New Terminal)

```powershell
# Open new terminal/PowerShell window
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

You should see:
```
  VITE v5.0.11  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Step 5: Test the Application

1. Open browser: http://localhost:5173
2. Login with: `zeydody@gmail.com` / `password123`
3. Check your email for OTP code
4. Enter OTP code
5. You're now in the Employee Dashboard!

## Default Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Employee | zeydody@gmail.com | password123 |
| Employee | employee@company.com | emp123 |
| HR Manager | hr@company.com | hr123 |
| Admin | admin@company.com | admin123 |

## 🎯 Testing Complete Workflow

### As Employee:
1. Login → Verify OTP
2. Click "Start Key Exchange"
3. Wait for key exchange to complete
4. Fill leave request form
5. Click "Submit Encrypted Request"

### As HR Manager:
1. Login → Verify OTP (in new browser/incognito)
2. View encrypted messages
3. Click "Decrypt" on any message
4. See decrypted leave request details

## Troubleshooting

**Problem**: Email not received
- Check spam folder
- Verify App Password is correct (no spaces)
- Try logging the OTP in terminal (check backend console)

**Problem**: Port already in use
```powershell
# Backend (port 8000)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Frontend (port 5173)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Problem**: Module not found
```powershell
# Backend
pip install -r requirements.txt --force-reinstall

# Frontend
rm -rf node_modules
npm install
```

## 📝 Architecture Flow

```
1. User Login
   ↓
2. System sends OTP email (via zeydody@gmail.com)
   ↓
3. User verifies OTP
   ↓
4. System issues JWT token
   ↓
5. Employee performs DH key exchange
   ↓
6. Employee encrypts leave request with AES
   ↓
7. HR Manager receives encrypted message
   ↓
8. HR Manager decrypts with shared secret
```

## 🔐 Security Notes

- All passwords are hashed with bcrypt
- OTP expires in 5 minutes
- JWT tokens expire in 60 minutes
- DH uses 1536-bit prime
- AES uses 256-bit keys
- Each message has unique IV

## Need Help?

Check the full README.md for detailed documentation!
