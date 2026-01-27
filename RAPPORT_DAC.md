# 🔐 Rapport des Fonctionnalités DAC (Discretionary Access Control)

## 🎯 Vue d'Ensemble

Ce module implémente deux fonctionnalités principales de contrôle d'accès discrétionnaire, démontrant les **faiblesses du modèle DAC** et leurs **solutions sécurisées** :

1. **Partage de Documents** - Basé sur le modèle **HRU (Harrison-Ruzzo-Ullman) Matrix**
2. **Délégation de Droits** - Basé sur le modèle **Take-Grant**

Chaque fonctionnalité propose deux modes :
- 🔴 **Mode DAC (Vulnérable)** : Démontre les faiblesses classiques du DAC
- 🟢 **Mode Sécurisé** : Implémente les solutions pour corriger ces faiblesses

---

## 📚 Fondements Théoriques

### Modèle DAC (Discretionary Access Control)

Le DAC est un modèle de contrôle d'accès où **le propriétaire d'une ressource décide qui peut y accéder**. 

**Caractéristiques** :
- Le propriétaire contrôle les permissions
- Les droits peuvent être transférés à d'autres utilisateurs
- Flexibilité maximale mais risques de sécurité

**Faiblesses principales** :
1. **Propagation incontrôlée des droits** : Un utilisateur peut re-partager sans limite
2. **Pas de contrôle centralisé** : L'administrateur perd le contrôle après le partage initial
3. **Problème du Cheval de Troie** : Un programme malveillant peut exploiter les droits de l'utilisateur

---

## 📄 Fonctionnalité 1 : Partage de Documents (Modèle HRU Matrix)

### Description

Implémentation d'un système de partage de documents basé sur la **matrice d'accès HRU** (Harrison-Ruzzo-Ullman, 1976).

### Modèle Théorique HRU

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATRICE D'ACCÈS HRU                          │
├─────────────────┬──────────────┬──────────────┬────────────────┤
│                 │ Document 1   │ Document 2   │ Document 3     │
├─────────────────┼──────────────┼──────────────┼────────────────┤
│ Admin           │ r, w, own    │ r, w, own    │ r              │
├─────────────────┼──────────────┼──────────────┼────────────────┤
│ HR Manager      │ r            │ r, w         │ r, w, own      │
├─────────────────┼──────────────┼──────────────┼────────────────┤
│ Employee1       │ r, w         │ -            │ r              │
├─────────────────┼──────────────┼──────────────┼────────────────┤
│ Employee2       │ -            │ r            │ -              │
└─────────────────┴──────────────┴──────────────┴────────────────┘

Légende : r = read, w = write, own = owner (propriétaire)
```
### Comparaison : DAC vs Sécurisé

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PARTAGE DE DOCUMENTS                                  │
├────────────────────────────────────┬────────────────────────────────────────┤
│     🔴 MODE DAC (Vulnérable)       │     🟢 MODE SÉCURISÉ                   │
├────────────────────────────────────┼────────────────────────────────────────┤
│ • can_reshare = true               │ • can_reshare = false                  │
│ • Pas de contrôle de propagation   │ • Propagation bloquée                  │
│ • Chaîne de partage illimitée      │ • Seul le propriétaire peut partager   │
│                                    │                                        │
│ Exemple de faiblesse:              │ Exemple sécurisé:                      │
│ Admin → Employee1 → Employee2      │ Admin → Employee1 (STOP)               │
│      → Employee3 → Employee4...    │ Employee1 ne peut pas re-partager      │
│ (propagation incontrôlée)          │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│ RISQUE: Fuite de données           │ SOLUTION: Contrôle centralisé          │
│ Le propriétaire perd le contrôle   │ Le propriétaire garde le contrôle      │
└────────────────────────────────────┴────────────────────────────────────────┘
```

### Diagramme de Séquence : Partage de Document

```
Propriétaire         Backend              Destinataire         Base de Données
     │                  │                      │                      │
     │─ POST /documents │                      │                      │
     │  {title, content}│                      │                      │
     │                  │─ Create document ────┤                      │
     │                  │─ Add to ACL (owner) ─┤                      │
     │<─ Document créé ─│                      │                      │
     │                  │                      │                      │
     │─ POST /documents/{id}/share/dac ───────>│                      │
     │  {user_id, permissions: [read, write]}  │                      │
     │                  │─ Add ACL entry ──────┤                      │
     │                  │  can_reshare: true   │                      │
     │<─ "Partagé (DAC)"│                      │                      │
     │                  │                      │                      │
     │                  │                      │─ GET /documents/my ──│
     │                  │                      │<─ Document visible ──│
     │                  │                      │                      │
     │                  │     🔴 MODE DAC:     │                      │
     │                  │                      │─ POST /share/dac ────│
     │                  │                      │  (Re-partage OK)     │
     │                  │                      │                      │
     │                  │     🟢 MODE SECURE:  │                      │
     │                  │                      │─ POST /share/secure ─│
     │                  │                      │<─ ERREUR 403 ────────│
     │                  │                      │  "Re-partage interdit"│
```


## 🔑 Fonctionnalité 2 : Délégation de Droits (Modèle Take-Grant)

### Description

Implémentation d'un système de délégation basé sur le **modèle Take-Grant** (Jones, Lipton, Snyder, 1976).

### Modèle Théorique Take-Grant

Le modèle Take-Grant représente les droits sous forme de **graphe orienté** :
- **Nœuds** : Sujets (utilisateurs) et Objets (ressources)
- **Arcs** : Droits d'accès avec labels

```
┌─────────────────────────────────────────────────────────────────┐
│                    GRAPHE TAKE-GRANT                             │
│                                                                  │
│    ┌──────────┐     grant (g)      ┌──────────┐                 │
│    │HR Manager│ ─────────────────> │Employee1 │                 │
│    └──────────┘                    └──────────┘                 │
│         │                               │                        │
│         │ approve_leave                 │ approve_leave          │
│         │ view_requests                 │ view_requests          │
│         │ delegate                      │ delegate               │
│         ▼                               ▼                        │
│    ┌──────────┐                    ┌──────────┐                 │
│    │  Droits  │                    │  Droits  │                 │
│    │   RH     │                    │ Délégués │                 │
│    └──────────┘                    └──────────┘                 │
│                                         │                        │
│                          🔴 DAC:        │ grant (g)              │
│                          Peut créer     ▼                        │
│                          nouvel arc  ┌──────────┐               │
│                                      │Employee2 │               │
│                                      └──────────┘               │
│                                          │                       │
│                           🔴 Chaîne      │ grant (g)             │
│                           infinie        ▼                       │
│                                      ┌──────────┐               │
│                                      │Employee3 │               │
│                                      └──────────┘               │
│                                          │                       │
│                                          ▼ ...∞                  │
└─────────────────────────────────────────────────────────────────┘
```

### Opérations Take-Grant

| Opération | Description | Condition |
|-----------|-------------|-----------|
| **take** | S prend les droits de O via un arc t | Arc `t` de S vers O |
| **grant** | S donne des droits à O via un arc g | Arc `g` de S vers O |
| **create** | S crée un nouvel objet avec droits | S est sujet |
| **remove** | S supprime un arc | S possède l'arc |

### Théorème "can" de Take-Grant

> **Théorème** : Un sujet S peut obtenir le droit `r` sur un objet O si et seulement s'il existe un chemin `tg` (take ou grant) de S à O dans le graphe.

**Implication de sécurité** : Si les arcs `grant` ne sont pas contrôlés, la propagation est **indécidable** - on ne peut pas prédire qui aura accès.

### Comparaison : DAC vs Sécurisé

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DÉLÉGATION DE DROITS                                  │
├────────────────────────────────────┬────────────────────────────────────────┤
│     🔴 MODE DAC (Vulnérable)       │     🟢 MODE SÉCURISÉ                   │
├────────────────────────────────────┼────────────────────────────────────────┤
│ • can_redelegate = true            │ • can_redelegate = (max_depth > 0)     │
│ • max_depth = -1 (illimité)        │ • max_depth = N (limité)               │
│ • expires_at = null (jamais)       │ • expires_at = DateTime                │
│ • Droit 'delegate' transmissible   │ • Profondeur contrôlée                 │
│                                    │                                        │
│ Faiblesse Take-Grant:              │ Solution:                              │
│ Chemin tg* satisfait "can"         │ Chemin tg cassé par:                   │
│ pour tout sujet atteignable        │ 1. Limite de profondeur                │
│                                    │ 2. Expiration temporelle               │
│                                    │ 3. Pas de droit 'delegate'             │
├────────────────────────────────────┼────────────────────────────────────────┤
│ Exemple:                           │ Exemple (max_depth=2):                 │
│ RH → E1 → E2 → E3 → E4 → ...∞     │ RH(d=0) → E1(d=1) → E2(d=2) STOP       │
│ (chaîne infinie)                   │ E2 ne peut plus déléguer               │
├────────────────────────────────────┼────────────────────────────────────────┤
│ RISQUE: Prédicat "can" toujours    │ SOLUTION: Prédicat "can" contrôlé      │
│ satisfaisable (indécidable)        │ Chemin tg borné et temporel            │
└────────────────────────────────────┴────────────────────────────────────────┘
```

### Diagramme de Séquence : Délégation et Re-délégation

```
HR Manager           Backend              Employee1            Employee2
     │                  │                      │                    │
     │─ POST /delegations/secure ─────────────>│                    │
     │  {delegate_to: E1,                      │                    │
     │   rights: [approve_leave, view_requests, delegate],          │
     │   max_depth: 2,                         │                    │
     │   expires_in_hours: 24}                 │                    │
     │                  │─ Create delegation ──┤                    │
     │                  │  current_depth: 0    │                    │
     │                  │  can_redelegate: true│                    │
     │<─ "Délégation créée" ───────────────────│                    │
     │                  │                      │                    │
     │                  │                      │─ GET /delegations/my
     │                  │                      │<─ Droits reçus ────│
     │                  │                      │                    │
     │                  │                      │─ GET /leave-requests/all
     │                  │                      │<─ Liste demandes ──│
     │                  │                      │  (grâce à view_requests)
     │                  │                      │                    │
     │                  │   RE-DÉLÉGATION:     │                    │
     │                  │                      │─ POST /delegations/secure
     │                  │                      │  {delegate_to: E2, │
     │                  │                      │   rights: [view_requests],
     │                  │                      │   max_depth: 1}    │
     │                  │                      │                    │
     │                  │─ Validate depth ─────┤                    │
     │                  │  current: 0+1=1      │                    │
     │                  │  max parent: 2       │                    │
     │                  │  1 < 2 → OK          │                    │
     │                  │─ Create delegation ──┤                    │
     │                  │  current_depth: 1    │                    │
     │                  │                      │<─ "Re-délégué" ────│
     │                  │                      │                    │
     │                  │                      │                    │─ Peut consulter
     │                  │                      │                    │  demandes
     │                  │                      │                    │
     │                  │   LIMITE ATTEINTE:   │                    │
     │                  │                      │                    │─ POST /delegations
     │                  │                      │                    │  → Employee3
     │                  │<─────────────────────┼────────────────────│
     │                  │  ERREUR 403:         │                    │
     │                  │  "Profondeur max     │                    │
     │                  │   atteinte"          │                    │
```


### Droits Déléguables

| Droit | Description | Impact |
|-------|-------------|--------|
| `view_requests` | Consulter les demandes de congé | Accès en lecture aux demandes |
| `approve_leave` | Approuver/Rejeter les demandes | Modifier le statut des demandes |

## 🔒 Sécurité et Bonnes Pratiques

### Contrôles Implémentés

| Contrôle | Mode DAC | Mode Sécurisé |
|----------|----------|---------------|
| Vérification propriétaire | ✅ | ✅ |
| Limite de re-partage | ❌ | ✅ |
| Limite de profondeur | ❌ | ✅ |
| Expiration temporelle | ❌ | ✅ |
| Traçabilité (granted_by) | ✅ | ✅ |
| Révocation possible | ✅ | ✅ |

---

## 🚀 Conclusion

Ce module DAC démontre :

1. **Les faiblesses théoriques** des modèles DAC classiques (HRU, Take-Grant)
2. **Des solutions pratiques** pour sécuriser le contrôle d'accès discrétionnaire
3. **L'importance du contrôle de propagation** dans les systèmes de partage
4. **La nécessité de limites temporelles et structurelles** pour la délégation

Le mode comparatif (DAC vs Sécurisé) permet une **démonstration pédagogique** des vulnérabilités et de leurs solutions.
