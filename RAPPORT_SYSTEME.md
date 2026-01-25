# 📊 Rapport - Système de Gestion RH Sécurisé

## 1. Architecture du Système

Le système est basé sur une architecture client-serveur avec les acteurs et fonctionnalités principales :

```
                    ACTEURS
┌─────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │     Admin    │  │  RH Manager  │  │  Employé │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
           │                 │                │
           │                 │                │
           └─────────────────┴────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │   AUTHENTIFICATION MFA        │
            │   - Login + Mot de passe      │
            │   - Code OTP par email        │
            │   - Protection brute force    │
            └───────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │      APPLICATION PRINCIPALE       │
        │    (Frontend React + Backend)     │
        └───────────────────────────────────┘
          │           │           │           │
    ┌─────┘           │           │           └─────┐
    │                 │           │                 │
    ▼                 ▼           ▼                 ▼
┌─────────┐   ┌────────────┐   ┌─────────┐   ┌───────────────┐
│ Gestion │   │ Communi-   │   │ Autori- │   │  Module DAC   │
│ Congés  │   │ cation     │   │ sations │   │  (Démonstra-  │
│ (RBAC)  │   │ Sécurisée  │   │ Admin   │   │  tion faib-   │
│         │   │ (DH+AES)   │   │         │   │  lesses)      │
└─────────┘   └────────────┘   └─────────┘   └───────────────┘
      │              │              │               │
      └──────────────┴──────────────┴───────────────┘
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
- **Frontend** : React 18, Vite, Tailwind CSS, Material Design 3
- **Backend** : FastAPI (Python), TinyDB
- **Sécurité** : JWT, Bcrypt, AES-256, Diffie-Hellman 1536-bit
- **Email** : FastAPI-Mail + Gmail SMTP

---

## 2. Les Acteurs du Système

### 👤 Administrateur (Admin)
- Gère les comptes utilisateurs (création)
- Visualise tous les messages chiffrés du système
- **Autorise les communications** entre employés et RH (rôle de TTP)
- Accès au **Module DAC** pour démonstration des faiblesses
- Consulte les logs d'audit DAC complets

### 👔 Responsable RH (HR Manager)
- Visualise toutes les demandes d'absence/congés
- Approuve ou rejette les demandes avec commentaires
- Reçoit les demandes via canal sécurisé (après autorisation admin)
- Accès au **Module DAC** pour partage de documents
- Peut créer et gérer des documents

### 👨‍💼 Employé (Employee)
- Crée des demandes d'absence/congés
- Visualise ses propres demandes et leur statut
- Supprime ses demandes en attente
- Accès au **Module DAC** pour :
  - Créer des documents
  - Partager des documents avec d'autres utilisateurs
  - Copier des documents (démonstration faiblesse DAC)

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
│  Tentative 1  ❌ Échec                                  │
│  Tentative 2  ❌ Échec                                  │
│  Tentative 3  ❌ Échec                                  │
│  Tentative 4  ❌ Échec                                  │
│  Tentative 5  ❌ Échec  ──► 🔒 COMPTE BLOQUÉ 5 min      │
└─────────────────────────────────────────────────────────┘
```

**Messages d'erreur spécifiques :**
- "Utilisateur n'existe pas" (404)
- "Mot de passe incorrect" (401)
- "Trop de tentatives. Réessayez dans Xm Ys" (429)
- "Code OTP invalide. Veuillez vous reconnecter." (401)

**Sécurité :**
- Blocage de 5 minutes après 5 tentatives échouées
- S'applique aux connexions ET à la saisie du code OTP
- Compteurs indépendants par utilisateur
- OTP invalidé après une tentative échouée (protection renforcée)

---

### 🔑 Workflow de Communication Sécurisée

Le système implémente un workflow complet avec autorisation de l'administrateur :

```
EMPLOYÉ                 ADMIN (TTP)              RH MANAGER
   │                        │                        │
   │ 1. Crée demande congé  │                        │
   ├────────────────────────►                        │
   │                        │                        │
   │                        │ 2. Voit demande        │
   │                        │    d'autorisation      │
   │                        │                        │
   │                        │ 3. Approuve/Rejette    │
   │                        │                        │
   │ ◄──────────────────────┤                        │
   │ Notification           │                        │
   │                        │                        │
   │ 4. Si approuvé:        │                        │
   │    Échange DH          │                        │
   │    ─────────────────────────────────────────────►
   │                        │                        │
   │ 5. Message chiffré     │                        │
   │    AES-256             │                        │
   │    ─────────────────────────────────────────────►
   │                        │                        │
   │                        │                        │ 6. Déchiffre
   │                        │                        │    et traite
```

**Caractéristiques :**
- L'Admin agit comme **Trusted Third Party (TTP)**
- Aucune communication directe sans autorisation préalable
- Échange de clés Diffie-Hellman 1536-bit
- Chiffrement AES-256-CBC avec IV aléatoire

---

### 📝 Gestion des Demandes d'Absence/Congés

**Cas d'usage typiques :**

1. **Employé demande un congé :**
   - Accède à l'onglet "Demandes de congés"
   - Sélectionne le type (absence, congé)
   - Choisit les dates de début et fin
   - Le système calcule automatiquement le nombre de jours
   - Ajoute une justification
   - Soumet la demande (statut : "En attente")

2. **Admin autorise la communication :**
   - Voit les demandes d'autorisation pendantes
   - Approuve ou rejette la transmission au RH
   - Déclenche l'échange de clés si approuvé

3. **RH traite les demandes :**
   - Accède à l'onglet "Gestion des congés"
   - Visualise les statistiques (en attente, approuvées, rejetées)
   - Filtre les demandes par statut
   - Examine chaque demande en détail
   - Approuve ou rejette avec un commentaire optionnel

4. **Employé consulte le statut :**
   - Voit toutes ses demandes avec leur statut
   - Peut supprimer les demandes encore en attente
   - Consulte les commentaires du RH sur les décisions

---

## 4. Module DAC (Discretionary Access Control)

### 🔓 Objectif Pédagogique

Ce module démontre les **faiblesses du modèle DAC** dans un contexte réel :

```
┌─────────────────────────────────────────────────────────────┐
│                    MODÈLE DAC                               │
│                                                             │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │ Propriétaire│ ──── Décide ────►  │   Accès     │        │
│  │ du document │      librement     │   Autres    │        │
│  └─────────────┘                    └─────────────┘        │
│                                                             │
│  ⚠️ FAIBLESSES:                                            │
│  • Pas de contrôle centralisé                              │
│  • Propagation non contrôlée des droits                    │
│  • Copie = perte des restrictions                          │
│  • Vulnérable aux chevaux de Troie                         │
└─────────────────────────────────────────────────────────────┘
```

### 📄 Fonctionnalités du Module DAC

| Fonctionnalité | Description | Faiblesse démontrée |
|----------------|-------------|---------------------|
| **Création de document** | L'utilisateur crée un document dont il devient propriétaire | Le propriétaire a un contrôle total |
| **Marquage confidentiel** | Option pour marquer un document comme "confidentiel" | ⚠️ N'empêche pas le partage ni la copie |
| **Partage avec permissions** | Lecture, Écriture, Suppression, Partage | ⚠️ Permission "Partage" = propagation incontrôlée |
| **Copie de document** | Copier le contenu vers un nouveau document | ⚠️ **Toutes les restrictions sont perdues!** |
| **Révocation d'accès** | Le propriétaire peut retirer les accès | ⚠️ N'affecte pas les copies déjà faites |
| **Logs d'audit** | Traçabilité de toutes les actions | Montre les failles en temps réel |

### 🔴 Scénarios de Démonstration des Faiblesses

#### Scénario 1 : Propagation Non Contrôlée
```
Employé A crée document CONFIDENTIEL
        │
        ▼ partage avec permission "Share"
Employé B reçoit le document
        │
        ▼ re-partage (autorisé!)
Employé C, D, E... ont accès
        │
        ▼
⚠️ Aucun contrôle centralisé n'a pu empêcher cela
```

#### Scénario 2 : Copie = Perte des Restrictions
```
┌──────────────────────────────────────────────────────────┐
│  Document Original                                       │
│  ├── Propriétaire: Employé A                            │
│  ├── Confidentiel: ✅ OUI                                │
│  ├── Permissions: Lecture seule pour Employé B          │
│  └── Restrictions: Pas de suppression, pas de partage   │
└──────────────────────────────────────────────────────────┘
                           │
                           │ Employé B fait une COPIE
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Document Copié                                          │
│  ├── Propriétaire: Employé B (NOUVEAU!)                 │
│  ├── Confidentiel: ❌ NON                                │
│  ├── Permissions: TOUTES (propriétaire)                 │
│  └── Restrictions: AUCUNE                               │
│                                                          │
│  ⚠️ LES DONNÉES SONT LES MÊMES, LES PROTECTIONS SONT    │
│     COMPLÈTEMENT PERDUES!                                │
└──────────────────────────────────────────────────────────┘
```

### 📊 Interface du Module DAC

Le module est accessible via l'onglet **"🔓 Module DAC"** dans chaque dashboard :

- **Documents** : Liste des documents avec permissions visuelles
- **Audit Logs** : Historique avec warnings de sécurité en rouge
- **Modals** : Création, Partage, Copie, Édition

**Indicateurs visuels :**
- 🔒 Document confidentiel
- ⚠️ Warnings de sécurité DAC
- Badges de permissions (R/W/D/S)

---

## 5. Contrôles d'Accès

### RBAC (Role-Based Access Control) - Système Principal

| Fonctionnalité                      | Admin | RH Manager | Employé |
|------------------------------------|-------|------------|---------|
| **Authentification**               |       |            |         |
| Se connecter avec MFA              | ✅    | ✅         | ✅      |
| Recevoir code OTP                  | ✅    | ✅         | ✅      |
| **Gestion des utilisateurs**       |       |            |         |
| Créer un utilisateur               | ✅    | ❌         | ❌      |
| **Autorisations communication**    |       |            |         |
| Voir demandes d'autorisation       | ✅    | ❌         | ❌      |
| Approuver/Rejeter autorisation     | ✅    | ❌         | ❌      |
| **Demandes d'absence**             |       |            |         |
| Créer demande                      | ❌    | ❌         | ✅      |
| Voir ses propres demandes          | ❌    | ❌         | ✅      |
| Voir toutes les demandes           | ❌    | ✅         | ❌      |
| Approuver/Rejeter demande          | ❌    | ✅         | ❌      |
| Supprimer sa demande (si pending)  | ❌    | ❌         | ✅      |
| **Messages système**               |       |            |         |
| Voir tous les messages chiffrés    | ✅    | ❌         | ❌      |

### DAC (Discretionary Access Control) - Module Démonstration

| Fonctionnalité                      | Propriétaire | Avec Read | Avec Write | Avec Delete | Avec Share |
|------------------------------------|--------------|-----------|------------|-------------|------------|
| Lire le document                   | ✅           | ✅        | ✅         | ✅          | ✅         |
| Modifier le document               | ✅           | ❌        | ✅         | ❌          | ❌         |
| Supprimer le document              | ✅           | ❌        | ❌         | ✅          | ❌         |
| Partager le document               | ✅           | ❌        | ❌         | ❌          | ✅         |
| Copier le document                 | ✅           | ✅        | ✅         | ✅          | ✅         |
| Révoquer accès                     | ✅           | ❌        | ❌         | ❌          | ❌         |

**⚠️ Note importante :** Tout utilisateur avec accès en lecture peut **copier** le document et devenir propriétaire de la copie avec **tous les droits**. C'est la principale faiblesse du DAC.

---

## 6. Résumé des Fonctionnalités

### ✅ Sécurité (RBAC)
- Authentification multi-facteurs (OTP par email)
- Protection anti-brute force (5 tentatives, blocage 5 min)
- Workflow d'autorisation par l'Admin (TTP)
- Chiffrement de bout en bout (DH + AES-256)
- Contrôle d'accès par rôle strict
- Tokens JWT avec expiration

### ✅ Gestion RH
- Système de demandes d'absence/congés
- Workflow d'approbation pour les RH
- Calcul automatique des jours
- Historique des demandes avec statuts
- Commentaires sur les décisions

### ✅ Module DAC (Pédagogique)
- Création et gestion de documents
- Système de permissions granulaires
- Partage avec ACL (Access Control List)
- Copie de documents (démonstration faiblesse)
- Logs d'audit avec warnings de sécurité
- Visualisation des failles DAC en temps réel

### ✅ Expérience Utilisateur
- Interface moderne avec Material Design 3
- Thème sombre/clair
- Messages d'erreur clairs et en français
- Formulaires intuitifs avec validation
- Statistiques et tableaux de bord
- Navigation par onglets

---

## 7. Comptes de Test

| Email                        | Mot de passe | Rôle        |
|------------------------------|--------------|-------------|
| zeydody@gmail.com            | admin123     | Admin       |
| zakarialaidi6@gmail.com      | hr123        | RH Manager  |
| abdoumerabet374@gmail.com    | emp123       | Employé     |

---

## 8. Comparaison RBAC vs DAC

| Critère | RBAC (Système principal) | DAC (Module démo) |
|---------|--------------------------|-------------------|
| **Contrôle** | Centralisé (Admin) | Décentralisé (Propriétaire) |
| **Flexibilité** | Faible (rôles fixes) | Haute (permissions individuelles) |
| **Sécurité** | ✅ Forte | ⚠️ Faible |
| **Propagation** | Contrôlée | Non contrôlée |
| **Copie de données** | N/A | Perte des restrictions |
| **Audit** | Simple | Complexe |
| **Cas d'usage** | Entreprise, conformité | Partage collaboratif |

---

## 9. Conclusion

Ce système démontre deux approches de contrôle d'accès :

1. **RBAC** pour les fonctionnalités critiques (authentification, gestion RH, communications sécurisées) - offrant une sécurité forte avec un contrôle centralisé.

2. **DAC** via un module pédagogique qui illustre clairement pourquoi ce modèle n'est pas adapté aux données sensibles - démontrant les risques de propagation non contrôlée et de perte de restrictions lors de copies.

**Recommandation :** Pour les systèmes manipulant des données sensibles, privilégier RBAC ou MAC (Mandatory Access Control) plutôt que DAC.

---

**Fin du rapport**
