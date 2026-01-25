# 🔓 Rapport - Module DAC (Discretionary Access Control)

## 1. Introduction au DAC

### Définition

Le **Discretionary Access Control (DAC)** est un modèle de contrôle d'accès où le **propriétaire d'une ressource** décide de manière discrétionnaire qui peut y accéder et avec quelles permissions.

```
┌─────────────────────────────────────────────────────────────┐
│                    PRINCIPE DU DAC                          │
│                                                             │
│   ┌──────────────┐         Décide         ┌─────────────┐  │
│   │ PROPRIÉTAIRE │ ───────librement─────► │   ACCÈS     │  │
│   │ du document  │                        │   AUTRES    │  │
│   └──────────────┘                        └─────────────┘  │
│                                                             │
│   • Le propriétaire a le contrôle TOTAL                    │
│   • Peut accorder/révoquer des permissions                 │
│   • Peut déléguer le droit de partage                      │
└─────────────────────────────────────────────────────────────┘
```

### Objectif du Module

Ce module a été implémenté pour **démontrer les faiblesses du modèle DAC** dans un contexte de gestion RH, en comparaison avec le modèle RBAC utilisé pour le reste de l'application.

---

## 2. Acteurs du Système

### Tableau des Utilisateurs

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| zeydody@gmail.com | Administrateur IT | admin123 |
| zakarialaidi6@gmail.com | Responsable RH | hr123 |
| abdoumerabet374@gmail.com | Employé | emp123 |

---

## 3. Matrice des Accès DAC

### Permissions par Utilisateur

| Action | zeydody@gmail.com | zakarialaidi6@gmail.com | abdoumerabet374@gmail.com |
|--------|-------------------|-------------------------|---------------------------|
| **Créer un document** | ✅ Oui | ✅ Oui | ❌ Non |
| **Lire ses documents** | ✅ Oui | ✅ Oui | ✅ Oui (partagés uniquement) |
| **Modifier ses documents** | ✅ Oui | ✅ Oui | ❌ Non |
| **Supprimer ses documents** | ✅ Oui | ✅ Oui | ❌ Non |
| **Partager ses documents** | ✅ Oui | ✅ Oui | ❌ Non |
| **Voir les logs d'audit** | ✅ Tous | ✅ Les siens | ✅ Les siens |

### Règles de Partage

| Qui partage | Vers qui | Permissions possibles |
|-------------|----------|----------------------|
| zeydody@gmail.com | zakarialaidi6@gmail.com | Lecture, Écriture, Suppression, Partage |
| zeydody@gmail.com | abdoumerabet374@gmail.com | Lecture, Écriture, Suppression, Partage |
| zakarialaidi6@gmail.com | zeydody@gmail.com | Lecture, Écriture, Suppression, Partage |
| zakarialaidi6@gmail.com | abdoumerabet374@gmail.com | ⚠️ **Lecture SEULE** |
| abdoumerabet374@gmail.com | - | ❌ Ne peut pas partager (pas de documents) |

---

## 4. Processus de Fonctionnement

### 4.1 Création d'un Document

```
┌────────────────────────────────────────────────────────────────┐
│  PROCESSUS DE CRÉATION                                         │
│                                                                 │
│  zeydody@gmail.com          Système           Base de données  │
│  ou zakarialaidi6@gmail.com                                    │
│         │                      │                    │          │
│         │  1. Clique "Créer"   │                    │          │
│         ├─────────────────────►│                    │          │
│         │                      │                    │          │
│         │  2. Remplit le       │                    │          │
│         │     formulaire       │                    │          │
│         │     - Titre          │                    │          │
│         │     - Contenu        │                    │          │
│         │     - Confidentiel?  │                    │          │
│         │                      │                    │          │
│         │  3. POST /dac/docs   │                    │          │
│         ├─────────────────────►│                    │          │
│         │                      │                    │          │
│         │                      │  4. Stocke doc    │          │
│         │                      ├───────────────────►│          │
│         │                      │                    │          │
│         │                      │  5. Crée perms    │          │
│         │                      │     (propriétaire)│          │
│         │                      ├───────────────────►│          │
│         │                      │                    │          │
│         │                      │  6. Log audit     │          │
│         │                      ├───────────────────►│          │
│         │                      │                    │          │
│         │◄─────────────────────┤                    │          │
│         │  7. Confirmation     │                    │          │
│         │                      │                    │          │
└────────────────────────────────────────────────────────────────┘
```

**Note :** abdoumerabet374@gmail.com ne peut PAS créer de documents.

---

### 4.2 Partage d'un Document

#### Cas 1 : zeydody@gmail.com partage vers n'importe qui

```
┌────────────────────────────────────────────────────────────────┐
│  zeydody@gmail.com                        Destinataire         │
│         │                                      │               │
│         │  1. Sélectionne document             │               │
│         │  2. Clique "Partager"                │               │
│         │  3. Choisit destinataire             │               │
│         │  4. Sélectionne permissions:         │               │
│         │     ☑ Lecture                        │               │
│         │     ☑ Écriture                       │               │
│         │     ☑ Suppression                    │               │
│         │     ☑ Partage                        │               │
│         │                                      │               │
│         │  ─────── Partage accordé ──────────► │               │
│         │                                      │               │
│         │                                      │  Reçoit accès │
│         │                                      │  complet      │
└────────────────────────────────────────────────────────────────┘
```

#### Cas 2 : zakarialaidi6@gmail.com partage vers abdoumerabet374@gmail.com

```
┌────────────────────────────────────────────────────────────────┐
│  zakarialaidi6@gmail.com                abdoumerabet374@gmail  │
│  (RH)                                   (Employé)              │
│         │                                      │               │
│         │  1. Sélectionne document             │               │
│         │  2. Clique "Partager"                │               │
│         │  3. Choisit abdoumerabet374@gmail    │               │
│         │                                      │               │
│         │  ⚠️ RESTRICTION AUTOMATIQUE:         │               │
│         │     ☑ Lecture (forcé)                │               │
│         │     ☐ Écriture (désactivé)           │               │
│         │     ☐ Suppression (désactivé)        │               │
│         │     ☐ Partage (désactivé)            │               │
│         │                                      │               │
│         │  ─────── Lecture seule ────────────► │               │
│         │                                      │               │
│         │                                      │  Ne peut que  │
│         │                                      │  LIRE         │
└────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Consultation des Documents

```
┌────────────────────────────────────────────────────────────────┐
│                    QUI VOIT QUOI ?                             │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ zeydody@gmail.com                                        │  │
│  │ ├── Ses propres documents (propriétaire)                │  │
│  │ └── Documents partagés avec lui                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ zakarialaidi6@gmail.com                                  │  │
│  │ ├── Ses propres documents (propriétaire)                │  │
│  │ └── Documents partagés avec lui                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ abdoumerabet374@gmail.com                                │  │
│  │ └── UNIQUEMENT les documents partagés avec lui          │  │
│  │     (lecture seule)                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Faiblesses du DAC Démontrées

### 5.1 Problème de la Copie (Non applicable ici)

Dans notre implémentation, la fonction de copie est désactivée pour les employés. Cependant, le risque théorique reste :

```
┌────────────────────────────────────────────────────────────────┐
│  RISQUE THÉORIQUE DE LA COPIE                                  │
│                                                                │
│  Document Original                    Document Copié           │
│  ┌─────────────────────┐              ┌─────────────────────┐  │
│  │ Propriétaire: RH    │              │ Propriétaire: AUTRE │  │
│  │ Confidentiel: OUI   │  ──COPIE──►  │ Confidentiel: NON   │  │
│  │ Permissions:        │              │ Permissions:        │  │
│  │   Lecture seule     │              │   TOUTES            │  │
│  └─────────────────────┘              └─────────────────────┘  │
│                                                                │
│  ⚠️ Les restrictions sont PERDUES lors de la copie!           │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Propagation Non Contrôlée (Admin uniquement)

```
zeydody@gmail.com crée un document
        │
        ▼ partage avec permission "Share" vers zakarialaidi6@gmail.com
zakarialaidi6@gmail.com reçoit le document
        │
        ▼ peut re-partager (vers zeydody seulement, pas vers employé avec full perms)

⚠️ Dans un DAC pur, cette chaîne pourrait continuer indéfiniment
```

### 5.3 Absence de Contrôle Centralisé

| Aspect | DAC (ce module) | RBAC (reste de l'app) |
|--------|-----------------|----------------------|
| Qui décide des accès ? | Le propriétaire | L'administrateur système |
| Politique globale ? | ❌ Non | ✅ Oui |
| Traçabilité | Complexe | Simple |
| Révocation | Manuelle par propriétaire | Centralisée |

---

## 6. Flux Complet - Scénario Type

### Scénario : Le RH envoie un document à un employé

```
┌────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1: zakarialaidi6@gmail.com se connecte                          │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│  1. Login: zakarialaidi6@gmail.com + hr123                            │
│  2. Reçoit code OTP par email                                         │
│  3. Saisit le code OTP                                                │
│  4. Accède au Dashboard RH                                            │
│  5. Clique sur l'onglet "🔓 Module DAC"                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2: Création du document                                         │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│  1. Clique "+ Créer un document"                                      │
│  2. Remplit:                                                          │
│     - Titre: "Politique de congés 2026"                               │
│     - Contenu: "Les congés annuels sont de 25 jours..."              │
│     - ☑ Document confidentiel                                         │
│  3. Clique "Créer"                                                    │
│  4. ✅ Document créé avec succès                                      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3: Partage avec l'employé                                       │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│  1. Sur le document, clique "🔗 Partager"                             │
│  2. Sélectionne: abdoumerabet374@gmail.com (employee)                 │
│  3. ⚠️ Le système affiche:                                            │
│     "Partage avec un employé : seule la lecture est autorisée."      │
│  4. Les options Écriture, Suppression, Partage sont GRISÉES          │
│  5. Clique "Partager"                                                 │
│  6. ✅ Document partagé en lecture seule                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 4: L'employé consulte le document                               │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│  1. abdoumerabet374@gmail.com se connecte                             │
│  2. Accède au Dashboard Employé                                       │
│  3. Clique sur "🔓 Module DAC"                                        │
│  4. Voit le message: "En tant qu'employé, vous ne pouvez pas          │
│     créer de documents..."                                            │
│  5. Voit le document "Politique de congés 2026"                       │
│  6. Permissions affichées: ✓ Lecture uniquement                       │
│  7. Peut LIRE le contenu                                              │
│  8. Ne peut PAS modifier, supprimer ou partager                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Interface Utilisateur

### Vue selon l'utilisateur

#### Pour zeydody@gmail.com (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│  🔓 Module DAC - Demonstration des Faiblesses               │
│                                                             │
│  [+ Créer un document]                                      │
│                                                             │
│  📄 Documents (3)          📋 Audit Logs (15)               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔒 Document Confidentiel RH                          │   │
│  │ Propriétaire: zeydody@gmail.com (vous)              │   │
│  │ [✏️ Modifier] [🔗 Partager] [📋 Copier] [🗑️ Suppr]  │   │
│  │ Permissions: ✓R ✓W ✓D ✓S                            │   │
│  │ Partagé avec: zakarialaidi6@gmail.com (R,W,D,S)     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Pour zakarialaidi6@gmail.com (RH)

```
┌─────────────────────────────────────────────────────────────┐
│  🔓 Module DAC - Demonstration des Faiblesses               │
│                                                             │
│  [+ Créer un document]                                      │
│                                                             │
│  📄 Documents (2)          📋 Audit Logs (8)                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔒 Politique de congés 2026                          │   │
│  │ Propriétaire: zakarialaidi6@gmail.com (vous)        │   │
│  │ [✏️ Modifier] [🔗 Partager] [📋 Copier] [🗑️ Suppr]  │   │
│  │ Permissions: ✓R ✓W ✓D ✓S                            │   │
│  │ Partagé avec: abdoumerabet374@gmail.com (R)         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Pour abdoumerabet374@gmail.com (Employé)

```
┌─────────────────────────────────────────────────────────────┐
│  🔓 Module DAC - Demonstration des Faiblesses               │
│                                                             │
│  📄 En tant qu'employé, vous ne pouvez pas créer de        │
│     documents. Vous pouvez uniquement consulter les         │
│     documents partagés avec vous.                           │
│                                                             │
│  📄 Documents (1)          📋 Audit Logs (2)                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔒 Politique de congés 2026                          │   │
│  │ Propriétaire: zakarialaidi6@gmail.com               │   │
│  │ (Aucune action disponible - lecture seule)          │   │
│  │ Permissions: ✓R ✗W ✗D ✗S                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Logs d'Audit

### Exemple de logs générés

| Timestamp | Action | Document | Acteur | Cible | Détails | Warning |
|-----------|--------|----------|--------|-------|---------|---------|
| 2026-01-18 10:30:00 | created | Politique congés | zakarialaidi6@gmail.com | - | Confidentiel: true | - |
| 2026-01-18 10:31:15 | shared | Politique congés | zakarialaidi6@gmail.com | abdoumerabet374@gmail.com | read=true, write=false | - |
| 2026-01-18 10:35:42 | accessed | Politique congés | abdoumerabet374@gmail.com | - | Document read access | - |

---

## 9. Comparaison avec RBAC

| Critère | DAC (ce module) | RBAC (gestion congés) |
|---------|-----------------|----------------------|
| **Qui contrôle ?** | zeydody@ ou zakarialaidi6@ (propriétaires) | Système (rôles fixes) |
| **Flexibilité** | Haute (permissions individuelles) | Faible (rôles prédéfinis) |
| **Sécurité** | ⚠️ Dépend du propriétaire | ✅ Centralisée |
| **Cas d'usage** | Partage ad-hoc | Workflows métier |
| **Audit** | Par document | Par action/rôle |

---

## 10. Conclusion

Ce module DAC démontre que :

1. **Le propriétaire a trop de pouvoir** - zeydody@gmail.com et zakarialaidi6@gmail.com peuvent partager librement

2. **Les restrictions peuvent être contournées** - Sauf les règles métier imposées (HR→Employé = lecture seule)

3. **Pas de vision globale** - Chaque propriétaire gère ses documents indépendamment

4. **Recommandation** - Pour les données sensibles RH, le modèle RBAC (utilisé pour les congés) est préférable car il impose des règles centralisées.

---

## 11. Résumé des Accès

### Tableau Final par Email

| Fonctionnalité | zeydody@gmail.com | zakarialaidi6@gmail.com | abdoumerabet374@gmail.com |
|----------------|-------------------|-------------------------|---------------------------|
| Accès au module DAC | ✅ | ✅ | ✅ |
| Créer document | ✅ | ✅ | ❌ |
| Lire document (propriétaire) | ✅ | ✅ | N/A |
| Lire document (partagé) | ✅ | ✅ | ✅ |
| Modifier document | ✅ | ✅ | ❌ |
| Supprimer document | ✅ | ✅ | ❌ |
| Partager document | ✅ | ✅ | ❌ |
| Partager vers employé avec full perms | ✅ | ❌ (lecture seule) | ❌ |
| Voir tous les audit logs | ✅ | ❌ | ❌ |
| Copier document | ✅ | ✅ | ❌ |

---

**Fin du rapport DAC**
