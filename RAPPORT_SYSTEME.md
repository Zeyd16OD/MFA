# 📊 Rapport - Système de Gestion RH Sécurisé

## 1. Architecture du Système

Le système est basé sur une architecture client-serveur avec les acteurs et fonctionnalités principales :

```
                    ACTEURS
┌─────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │     Admin    │  │  RH Manager  │  │  Employé │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
           │                 │                │
           │                 │                │
           └─────────────────┴────────────────┘
                            │
                            ▼
            ┌───────────────────────────┐
            │   AUTHENTIFICATION MFA    │
            │   - Login + Mot de passe  │
            │   - Code OTP par email    │
            │   - Protection brute force│
            └───────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │      APPLICATION PRINCIPALE       │
        │    (Frontend React + Backend)     │
        └───────────────────────────────────┘
                │               │
      ┌─────────┴─────────┐     └──────────────┐
      │                   │                    │
      ▼                   ▼                    ▼
┌─────────────┐   ┌──────────────┐   ┌────────────────┐
│  Messages   │   │  Gestion des │   │  Échange de    │
│  Chiffrés   │   │   Congés     │   │  Clés DH       │
│  AES-256    │   │   (RBAC)     │   │  (Crypto)      │
└─────────────┘   └──────────────┘   └────────────────┘
      │                   │                    │
      └───────────────────┴────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Base de données      │
              │  TinyDB (JSON)        │
              └───────────────────────┘

              ┌───────────────────────┐
              │  Service Email SMTP   │
              │  (Gmail)              │
              └───────────────────────┘
```

**Technologies utilisées :**
- **Frontend** : React 18, Vite, Tailwind CSS
- **Backend** : FastAPI (Python), TinyDB
- **Sécurité** : JWT, Bcrypt, AES-256, Diffie-Hellman 1536-bit
- **Email** : FastAPI-Mail + Gmail SMTP

---

## 2. Les Acteurs du Système

### 👤 Administrateur
- Gère les comptes utilisateurs
- Visualise tous les messages du système
- Accès complet aux fonctionnalités d'administration
- **Pas d'accès** au système de gestion des congés

### 👔 Responsable RH (HR Manager)
- Visualise et déchiffre les demandes d'absence reçues
- Approuve ou rejette les demandes de congés
- Gère les demandes de tous les employés
- Peut ajouter des commentaires aux décisions

### 👨‍💼 Employé
- Crée des demandes d'absence/congés
- Visualise ses propres demandes et leur statut
- Envoie des messages chiffrés aux RH
- Supprime ses demandes en attente

---

## 3. Fonctionnalités du Système

### 🔐 Authentification Sécurisée (MFA)

**Processus d'authentification en 2 étapes :**

```
┌─────────┐         Email + Mot de passe        ┌─────────┐
│Employé  │ ────────────────────────────────────►│Serveur  │
└─────────┘                                      └─────────┘
     │                                                 │
     │                                                 │ Vérification
     │                                                 │ des credentials
     │                                                 ▼
     │                                           Génère code OTP
     │                                                 │
     │◄────────────────────────────────────────────────┤
     │        Email avec code OTP (6 chiffres)         │
     │                                                 │
     │         Soumet le code OTP                      │
     ├─────────────────────────────────────────────────►
     │                                                 │
     │                                                 │ Vérifie OTP
     │                                                 │
     │◄────────────────────────────────────────────────┤
     │           Token JWT (connexion réussie)         │
     │                                                 │
```

**Caractéristiques :**
- Code OTP à 6 chiffres envoyé par email
- Validité : 10 minutes
- Protection contre les attaques par force brute (5 tentatives max)
- Possibilité de renvoyer le code OTP
- Annulation possible pour revenir à la page de connexion

---

### 🛡️ Protection Anti-Brute Force

Le système bloque automatiquement les tentatives d'intrusion :

```
┌─────────────────────────────────────────────────────────┐
│  Tentatives de connexion                                │
│  ─────────────────────                                  │
│  Tentative 1  ❌ Échec                                   │
│  Tentative 2  ❌ Échec                                   │
│  Tentative 3  ❌ Échec                                   │
│  Tentative 4  ❌ Échec                                   │
│  Tentative 5  ❌ Échec  ──► 🔒 COMPTE BLOQUÉ 5 min     │
└─────────────────────────────────────────────────────────┘
```

**Messages d'erreur spécifiques :**
- "Utilisateur n'existe pas" (404)
- "Mot de passe incorrect" (401)
- "Trop de tentatives. Réessayez dans Xm Ys" (429)
- "Code OTP invalide ou expiré" (401)

**Sécurité :**
- Blocage de 5 minutes après 5 tentatives échouées
- S'applique aux connexions ET à la saisie du code OTP
- Compteurs indépendants par utilisateur

---

### 🔑 Échange de Clés Sécurisé (Diffie-Hellman)

Avant d'envoyer des messages chiffrés, un secret partagé est établi :

```
EMPLOYÉ                              RH MANAGER
   │                                      │
   │ 1. Génère clé privée a               │ 1. Génère clé privée b
   │    Calcule clé publique A            │    Calcule clé publique B
   │                                      │
   │ 2. Envoie A ──────────────────────► │
   │                                      │
   │                                      │ 3. Calcule secret = B^a
   │                                      │
   │ ◄────────────────────── Envoie B    │
   │                                      │
   │ 4. Calcule secret = A^b              │
   │                                      │
   │ ✅ Secret partagé identique         │ ✅ Secret partagé identique
   │    (jamais transmis sur le réseau)   │    (jamais transmis sur le réseau)
```

**Avantages :**
- Les clés privées ne quittent jamais le navigateur
- Le secret partagé n'est jamais transmis
- Résistant à l'interception (attaque du type "man-in-the-middle" passive)

---

### 📝 Gestion des Demandes d'Absence/Congés

**Diagramme de séquence - Création de demande :**

```
EMPLOYÉ                  SERVEUR                  RH MANAGER
   │                        │                          │
   │ 1. Remplit formulaire  │                          │
   │    (dates, raison)     │                          │
   │                        │                          │
   │ 2. POST /leave-requests│                          │
   ├────────────────────────►                          │
   │                        │                          │
   │                        │ 3. Vérifie rôle          │
   │                        │    (employee?)           │
   │                        │                          │
   │                        │ 4. Enregistre demande    │
   │                        │    (statut: pending)     │
   │                        │                          │
   │ ◄──────────────────────┤                          │
   │  Confirmation          │                          │
   │                        │                          │
   │                        │    5. Notification       │
   │                        ├─────────────────────────►│
   │                        │                          │
```

**Diagramme de séquence - Approbation/Rejet :**

```
RH MANAGER              SERVEUR                 EMPLOYÉ
   │                        │                       │
   │ 1. Consulte demandes   │                       │
   │    GET /all-requests   │                       │
   ├────────────────────────►                       │
   │                        │                       │
   │ ◄──────────────────────┤                       │
   │  Liste des demandes    │                       │
   │                        │                       │
   │ 2. Approuve/Rejette    │                       │
   │    PUT /{id}/status    │                       │
   ├────────────────────────►                       │
   │                        │                       │
   │                        │ 3. Met à jour statut  │
   │                        │    + commentaire      │
   │                        │                       │
   │ ◄──────────────────────┤                       │
   │  Confirmation          │                       │
   │                        │                       │
   │                        │    4. Employé voit    │
   │                        │       le statut       │
   │                        ├──────────────────────►│
```

**Cas d'usage typiques :**

1. **Employé demande un congé :**
   - Accède à l'onglet "Demandes d'absence"
   - Sélectionne le type (absence, congé)
   - Choisit les dates de début et fin
   - Le système calcule automatiquement le nombre de jours
   - Ajoute une justification
   - Soumet la demande (statut : "En attente")

2. **RH traite les demandes :**
   - Accède à l'onglet "Gestion des demandes"
   - Visualise les statistiques (en attente, approuvées, rejetées)
   - Filtre les demandes par statut
   - Examine chaque demande en détail
   - Approuve ou rejette avec un commentaire optionnel

3. **Employé consulte le statut :**
   - Voit toutes ses demandes avec leur statut
   - Peut supprimer les demandes encore en attente
   - Consulte les commentaires du RH sur les décisions

---

### 💬 Messages Chiffrés

Les employés peuvent envoyer des messages confidentiels aux RH :

```
EMPLOYÉ                                    RH MANAGER
   │                                           │
   │ 1. Rédige message                         │
   │                                           │
   │ 2. Chiffre avec AES-256                   │
   │    (clé = secret DH)                      │
   │                                           │
   │ 3. POST /messages                         │
   ├───────────────────────────────────────────►
   │                                           │
   │                                           │ 4. Stocke message
   │                                           │    chiffré
   │                                           │
   │                                           │ 5. Consulte messages
   │                                           │
   │                                           │ 6. POST /{id}/decrypt
   │                                           │
   │                                           │ 7. Déchiffre avec
   │                                           │    secret DH
   │                                           │
   │                                           │ ✅ Message en clair
```

**Sécurité :**
- Chiffrement AES-256-CBC avec IV aléatoire
- Les messages sont illisibles sur le serveur
- Seul le destinataire possédant le secret DH peut déchiffrer

---

## 4. Contrôles d'Accès (RBAC)

Le système implémente un contrôle d'accès basé sur les rôles :

### Matrice des Permissions

| Fonctionnalité                      | Admin | RH Manager | Employé |
|------------------------------------|-------|------------|---------|
| **Authentification**               |       |            |         |
| Se connecter avec MFA              | ✅    | ✅         | ✅      |
| Recevoir code OTP                  | ✅    | ✅         | ✅      |
| **Messages chiffrés**              |       |            |         |
| Envoyer message chiffré            | ❌    | ✅         | ✅      |
| Recevoir message chiffré           | ❌    | ✅         | ✅      |
| Déchiffrer message                 | ❌    | ✅         | ✅      |
| Supprimer message                  | ❌    | ✅         | ❌      |
| Nettoyer messages incompatibles    | ❌    | ✅         | ❌      |
| **Demandes d'absence**             |       |            |         |
| Créer demande                      | ❌    | ❌         | ✅      |
| Voir ses propres demandes          | ❌    | ❌         | ✅      |
| Voir toutes les demandes           | ❌    | ✅         | ❌      |
| Approuver/Rejeter demande          | ❌    | ✅         | ❌      |
| Supprimer sa demande (si pending)  | ❌    | ❌         | ✅      |
| **Administration**                 |       |            |         |
| Gérer utilisateurs                 | ✅    | ❌         | ❌      |
| Voir tous les messages système     | ✅    | ❌         | ❌      |

### Mécanisme de Contrôle

**Au niveau Backend :**
- Chaque endpoint vérifie le JWT token
- Le rôle est extrait du token (`current_user.role`)
- Une exception `HTTPException(403)` est levée si le rôle est incorrect

**Au niveau Frontend :**
- Les composants sont conditionnellement affichés selon le rôle
- Navigation restreinte selon les permissions
- Les menus s'adaptent au profil utilisateur

**Exemple de vérification :**
```python
# Backend - Vérification de rôle
if current_user.role != "employee":
    raise HTTPException(403, "Accès refusé")

# Frontend - Affichage conditionnel
{user.role === 'hr_manager' && <HRLeaveManagement />}
```

---

## 5. Résumé des Fonctionnalités

### ✅ Sécurité
- Authentification multi-facteurs (OTP par email)
- Protection anti-brute force (5 tentatives)
- Chiffrement de bout en bout (DH + AES-256)
- Contrôle d'accès par rôle (RBAC)
- Tokens JWT avec expiration

### ✅ Gestion RH
- Système de demandes d'absence/congés
- Workflow d'approbation pour les RH
- Calcul automatique des jours
- Historique des demandes avec statuts
- Commentaires sur les décisions

### ✅ Communication
- Messages chiffrés entre utilisateurs
- Échange de clés Diffie-Hellman
- Déchiffrement sécurisé côté serveur
- Nettoyage des messages incompatibles

### ✅ Expérience Utilisateur
- Interface moderne avec Material Design
- Notifications en temps réel
- Messages d'erreur clairs et en français
- Formulaires intuitifs avec validation
- Statistiques et tableaux de bord

---

## 6. Comptes de Test

| Email                        | Mot de passe | Rôle        |
|------------------------------|--------------|-------------|
| zeydody@gmail.com            | admin123     | Admin       |
| zakarialaidi6@gmail.com      | hr123        | RH Manager  |
| abdoumerabet374@gmail.com    | emp123       | Employé     |

---

**Fin du rapport**
