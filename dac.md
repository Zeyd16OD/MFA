# II - Les politiques discrétionnaires (DAC)

Les politiques discrétionnaires assurent le contrôle d'accès sur la base de l'identité de l'utilisateur, et d'un ensemble de règles explicites qui définissent qui peut (ou ne peut pas) accomplir quelle action, sur quelle ressource.

> **Remarque**: Ces politiques sont appelées discrétionnaires car les utilisateurs peuvent avoir la possibilité de transmettre leurs privilèges à d'autres utilisateurs, alors que l'attribution et la révocation des privilèges est régulée par une politique administrative.

Il existe plusieurs politiques et modèles de contrôle d'accès discrétionnaires dans la littérature. Nous en présenterons les principaux dans la suite de ce chapitre.

## A. Le modèle de matrice de contrôle

Le modèle de matrice de contrôle constitue un cadre général pour la description du contrôle d'accès discrétionnaire.

Il est proposé pour la première fois par Lampson (1971) pour la protection des ressources dans un contexte de système d'exploitation. Puis raffiné par Graham et Denning (1972), et formalisé par Harrison, Ruzzo et Ulmann (modèle HRU 1976).

L'appellation "Modèle de matrice de contrôle" est due au fait que les autorisations sont représentées via une matrice. Malgré sa simplicité apparente, ce modèle illustre de façon très claire et utile les différents aspects des politiques discrétionnaires.

La première étape dans le développement d'un système de contrôle d'accès est l'identification des:
- Objets à protéger
- Sujets qui exécutent des activités et requêtes d'accès sur les objets
- Actions qui peuvent être exécutées sur les objets, et qui doivent être contrôlées

### Matrice de contrôle d'accès

> **Remarque**: Les concepts de sujets, objets et actions peuvent être différent en fonction du contexte d'application.

**Exemple**: 
- Dans un système d'exploitation, les objets sont les fichiers, dossiers et programmes
- Dans un SGBD, les objets sont les tables, vues, procédures stockées...

> **Remarque**: Un sujet peut être considéré comme un objet, dans ce cas S est inclus dans O. Un sujet peut éventuellement créer d'autres sujets (processus fils par exemple). Dans ce cas le sujet créateur détient des privilèges sur les sujets créés (un processus, peut suspendre, ou terminer ses processus fils).

Les autorisations administratives peuvent être spécifiées en attachant des marques (flags) aux privilèges d'accès. Par exemple une marque de copie notée '*' attachée à un privilège peut indiquer que ce privilège peut être transféré au autres.

> **Remarque**:
> - La mise à jour d'une politique de sécurité exprimée par ce modèle est coûteuse car si de nouveaux objets, de nouveaux sujets ou de nouvelles actions sont ajoutés dans le système, il devient nécessaire d'enregistrer toutes les permissions accordées pour ces nouvelles entités.
> - Ce modèle ne permet pas de contrôler les interdictions ou d'exprimer des obligations.

### 1. Politique de Lampson

En 1971, Lampson introduit pour la première fois la matrice d'accès, et lui associe un ensemble de règles qui régissent l'évolution de la matrice.

**Règles de Lampson**:
- **Règle 1**: d1 peut supprimer les attributs d'accès de A[d2,x] s'il a l'accès en contrôle de d2
- **Règle 2**: d1 peut copier dans A[d2,x] n'importe quel attribut d'accès qu'il détient sur x s'il a la marque de copie (*), et peut spécifier si l'attribut d'accès doit avoir ou non la marque de copie
- **Règle 3**: d1 peut ajouter n'importe quel attribut d'accès à A[d2,x] avec ou sans la marque de copie s'il est propriétaire de x
- **Règle 4**: d1 peut supprimer un attribut d'accès de A[d2,x] si d1 est propriétaire de x et d2 n'a pas de d'accès protégé sur x

> **Remarque**: La restriction "protégé" permet à un seul propriétaire de défendre son accès des autres propriétaires.

### 2. Formalisation (HRU)

En 1976 Harrison, Ruzzo et Ulmann proposent une formalisation de la matrice d'accès.

Dans le modèle de matrice d'accès l'état du système est défini par un triplet (S,O,A), où S est un ensemble de sujets, O un ensemble d'objets et A est la matrice d'accès telle que les lignes correspondent aux sujets et les colonnes aux objets. Une cellule A[s,o] correspond aux privilèges de s sur o.

En plus des privilèges classiques "lecture", "écriture", "exécution" (r,w,e), il est possible en fonction du contexte de définir d'autre privilèges tels que "propriété" (own), "contrôle" (pour modéliser la relation entre un processus père et un processus fils).

> **Remarque**: Un sujet peut être considéré comme un objet, donc S est inclus dans O.

Le changement d'état du système peut se faire à travers des commandes qui exécutent des opérations primitives.

Le formalisme HRU identifie six opérations primitives pour décrire le changement d'état d'un système. Ces opérations sont:
1. Ajouter un sujet
2. Supprimer un sujet
3. Ajouter un objet
4. Supprimer un objet
5. Ajouter un privilège
6. Supprimer un privilège

Chaque commande a une précondition, un corps et une partie action.

**Syntaxe**:
```
command c(x1,....xk)
if r1 in A[xs1,xo1] and r2 in A[xs2,xo2] and.....and rm in A[xsm,xom]
then op1, op2, ... opn
end.
```

Où:
- n>0, m>=0
- r1, r2 ... rm sont des actions (privilèges)
- op1, op2, ... opn sont des actions primitives
- s1, s2, ...sm et o1, o2,....om sont des entiers entre 1 et k

> **Remarque**: Si m=0 alors la commande n'a pas de précondition.

**Exemple**: Commande pour créer un fichier et attribuer au sujet créateur le privilège de propriété (own)
```
command CREATE(creator,file)
create objet file
enter Own into A[creator, file]
end.
```

**Exemple**: Commande pour permettre à un propriétaire d'attribuer des actions sur ses objets à d'autres sujets
```
command CONFERa (owner, friend, file)
if Own in A[owner, file]
then enter a into A[friend, file]
end.
```

**Exemple**: Commande pour permettre à un propriétaire de retirer des actions sur ses objets d'autres sujets
```
command REVOKEa (owner,ex_friend, file)
if Own in A[owner, file]
then delete a from A[ex_friend, file]
end.
```

> **Remarque**: Dans les deux exemple précédents a n'est pas un paramètre, mais une abréviation pour définir plusieurs commandes similaire, une pour chaque valeur possible de a (par exemple CONFERread, REVOKEwrite). Car les commandes sont paramétrées par des sujets et objets et non par des actions. Il est donc nécessaire de définir des commandes pour chaque action.

Notons Q |--op Q' l'exécution d'une opération op sur un état Q, résultant en un état Q'.

L'exécution de la commande c(a1,...., ak) sur un état Q=(S,O,A) induit une transition de l'état Q à l'état Q' tel que il existe Q1,...,Qn pour lesquels Q |--op*1 Q1 |--op*2 Q2 ...|--op*n Qn =Q', où op*1,...,op*n sont les opérations primitives op1,...,opn dans les corps de la commande c, dans laquelle les paramètres ai sont substitués pour chaque paramètre xi i :=1,...,k.

> **Remarque**: Si la partie conditionnelle de la commande n'est pas vérifiée alors Q=Q'

Bien que le modèle HRU n'inclut aucune politique administrative intégrée, la possibilité de définir des commandes en permet la formulation.

Les autorisations administratives peuvent être spécifiées en attachant des marques (flags) aux privilèges d'accès. Par exemple une marque de copie notée * attachée à un privilège peut indiquer que ce privilège peut être transféré au autres.

**Exemple**:
```
Command TRANSFERa (subj, friend, file)
if a* in A[subj, file]
then enter a into A[friend, file]
end.
```

La capacité de spécifier ce type de commande induit une flexibilité, car différentes politiques administratives peuvent être formalisées en définissant les commandes appropriées.

**Exemple**: Une marque administrative alternative appelée transfert uniquement (transfer only) notée + pourrait être prise en compte. Celle ci permettrai à un sujet de transmettre un privilège, mais en effectuant ce transfert il perd le privilège.

> **Remarque**: Cette flexibilité introduit un problème intéressant appelé problème de sûreté (safety problem), qui concerne la propagation des privilèges.

**Définition**: Étant donné un système avec une configuration initiale, le problème de sûreté consiste à déterminer si oui ou non un sujet s peut acquérir un privilège a sur un objet o. c-à-d s'il existe une séquence de requêtes qui appliquée sur Q produit un état Q' dans lequel 'a' apparaît dans une cellule A[s,o].

En fait, ce problème revient à vérifier qu'un schéma d'autorisation est correct vis-à-vis d'un ensemble d'objectifs de sécurité.

Harrison, Ruzzo et Ullman ont démontré deux théorèmes fondamentaux concernant la complexité du problème de sûreté:
- Le problème de sûreté est indécidable dans le cas général, c'est-à-dire, étant donné une matrice d'accès initiale et un ensemble de commandes, il est impossible de savoir si aucune séquence d'applications de ces commandes n'aura pour conséquence de mettre un droit particulier dans un endroit de la matrice où il ne se trouvait pas initialement
- Le problème de sûreté est décidable pour les systèmes à mono-opération, c'est-à-dire dont les commandes ne contiennent qu'une seule opération élémentaire

Les auteurs du modèle HRU ont proposé un algorithme de vérification de sûreté pour le système mono-opérationnel. L'algorithme consiste à tester un ensemble fini d'exécutions. Cependant, l'algorithme est difficilement utilisable du fait de sa complexité (NP-Complete) et l'hypothèse d'un système mono-opérationnel ne correspond pas aux systèmes réels.

> **Remarque**: Ce modèle ne permet pas d'exprimer des interdictions, des obligations ou des recommandations.

### 3. Implémentation de la matrice d'accès

Bien que la matrice représente une bonne conceptualisation des autorisations, elle n'est pas appropriée pour l'implémentation. Dans un système réel la matrice serait creuse (la plupart des cellules seraient vides) et d'une taille très importante. Donc le stockage de la matrice dans un tableau à deux dimensions conduirait à une perte considérable d'espace mémoire.

Il y trois approches pour l'implémentation de la matrice:
- Table d'autorisations
- Liste de contrôle d'accès (ACL)
- Capacités

#### Table d'autorisations

La table comprend trois colonnes (sujet, actions et objet). Chaque tuple dans la table correspond à une autorisation. Cette approche est utilisée notamment dans les SGBDs où les autorisations sont stockées dans les catalogues.

#### Liste de contrôle d'accès (ACL)

La matrice est stockée par colonnes. Chaque objet est associé à une liste indiquant pour chaque sujet les actions qu'il peut entreprendre sur l'objet.

#### Capacités

La matrice est stockée par lignes. Chaque sujet est associé à une liste appelé liste de capacités, indiquant pour chaque objet les accès que le sujet peut effectuer dessus.

ACLs et capacités présentent des avantages et des inconvénients. Dans les ACLs on peut facilement connaître les autorisations associées à un objet, alors la recherche des autorisations d'un sujet requiert le parcours de toutes les listes des objets. L'inverse est vrai pour les capacités. Ceci affecte l'efficacité de la révocation des autorisations (nécessité d'une étape de recherche).

> **Remarque**: Les capacités présentent un intérêt notamment dans les systèmes distribués. Car elles permettent d'éviter la répétition des authentifications. Un sujet peut s'authentifier une fois auprès du hôte, récupérer sa capacité et les présenter pour obtenir des accès aux différents serveurs du système. Cependant les capacités sont vulnérable à la contrefaçon (elles peuvent être copiées et utilisées par un sujet non autorisé).

Plusieurs systèmes à base de capacités ont été développés dans les années 70, mais n'ont pas eu de succès commercial. Les systèmes d'exploitation récents se basent sur l'approche ACL. Certains implémentent une abréviation des ACLs basée sur un nombre limité de groupes et ne permettent pas les autorisations individuelles. Ceci induit un gain d'efficacité en travaillant sur de petits vecteurs de bits.

**Exemple**: Dans Unix chaque utilisateur appartient à un seul groupe et chaque fichier a un seul propriétaire (généralement l'utilisateur qui l'a créé) et est associé à un groupe (généralement le groupe de son propriétaire).

Les autorisations de chaque fichier peuvent être spécifiées pour: son propriétaire, son groupe d'appartenance, et le "reste du monde".

Les autorisations sont représentées par l'association à chaque objet d'une liste de contrôle d'accès de 9 bits: les bits de 1 à 3 reflètent les privilèges du propriétaire, les bits de 4 à 6 reflètent les privilèges de groupe d'appartenance, et les trois derniers bits aux privilèges des autres utilisateurs.

Chaque groupe de trois bits fait référence respectivement aux autorisations de lecture (r), écriture (w) et exécution (x).

**Exemple**: `rwxr-x--x`

## B. Modèle Take-Grant

Diverses évolutions issues du modèle HRU ont tenté de déterminer un modèle suffisamment expressif pour représenter des politiques d'autorisation sophistiquées, mais pour lequel le problème de sûreté reste décidable.

Le modèle Take-Grant proposé par Jones, Lipton et Snyder (1976) est constitué d'un graphe dont les nœuds sont des sujets ou des objets, et des règles de modification de ce graphe.

Take-Grant peut être vu comme une variante de HRU à ceci près qu'il restreint les différentes commandes en les répartissant en quatre catégories:
- La commande "create" qui permet de créer un objet et d'attribuer initialement un droit d'accès à un sujet sur cet objet
- La commande "remove" qui permet de retirer un droit d'accès d'un sujet sur un objet
- La commande "take", représentée par un arc étiqueté t entre un sujet P et un sujet (ou objet) R, indique que P peut prendre tous les droits que R possède
- La commande "grant" qui permet à un sujet P possédant un droit d'accès α sur Q ainsi que le droit g sur un autre sujet R, de céder à R le droit α sur Q (que P possède sur Q)

> **Remarque**: Dans ce modèle, le graphe représentant l'état du système, peut être assimilé à la matrice d'accès, et les quatre règles ci-dessus (dites de réécriture), correspondent au schéma d'autorisation, c'est-à-dire aux commandes.

Même si ces règles peuvent paraître simples, leurs combinaisons peuvent mener le système dans des états d'insécurité. En effet, l'application successive de plusieurs règles (bien choisies) peut donner d'autres droits à des sujets, ce qui risque de compromettre certains objectifs de sécurité.

**Exemple**: L'exemple ci dessous montre un graphe de protection qui contient deux sujets, P et R et un objet O.

Dans l'état de protection initial, R possède le droit α sur O et le droit t sur P. Considérons un objectif de sécurité stipulant que le système est déclaré non-sûr si P parvient à acquérir le droit α sur O.

La séquence d'application des règles indique que le système n'est pas sûr, alors que ce constat n'est pas directement explicite dans l'état initial.

Pour pallier à ce type de problème, Jones et al. ont étudié le problème de sûreté dans le cadre du modèle Take-Grant. Ils définissent le prédicat "can" de la façon suivante: « P can a Q » est vrai si et seulement s'il existe une séquence de graphes "G1, .., Gn" telle que P ait le droit a sur Q dans le graphe Gn.

Jones et al. définissent les conditions nécessaires et suffisantes pour que le prédicat soit satisfait:
- **Chemin tg**: chemin dans le graphe représentant la matrice de droits d'accès ne contenant que des arêtes t ou g. (Orientation d'arêtes non-importante)
- **Théorème**: En supposant S = O, pour x, y ∈ S, x peut récupérer le droit α ∈ sur y si et seulement si il existe un z ∈ S tel que α ∈ A[z, y] et x et z sont reliés par un chemin tg

Ils établissent également l'existence d'une solution algorithmique de complexité linéaire permettant d'établir si le prédicat est vérifié. Toutefois, les hypothèses sous-jacentes à ce modèle sont assez peu réalistes.

En effet, et comme on peut le constater avec l'exemple présenté, s'il est vrai que P peut parvenir à acquérir le droit a sur O, il ne peut le faire que si R collabore avec lui. En réalité, il est difficile d'imaginer que tous les sujets vont collaborer afin de mettre la sécurité en péril. Une telle hypothèse est donc le pire cas sur le comportement des utilisateurs du système.

## C. Modèle TAM

S'inspirant du modèle HRU, Sandhu a présenté un modèle appelé TAM (Typed Access Matrix) (1992). Dans TAM, chaque objet appartient à un certain type qui ne peut changer. Les commandes utilisent cette notion de type.

Un modèle de sécurité utilisant TAM est composé d'un ensemble fini A de droits, d'un ensemble de types d'objets Ʈ et d'un ensemble fini de types de sujets Ʈs (Ʈs inclus dans Ʈ). Ces éléments sont utilisés pour définir l'état de protection à l'aide d'une matrice de contrôle d'accès typée.

Le schéma d'autorisation est constitué de A, Ʈ, et d'une collection finie de commandes TAM.

Les opérations primitives de TAM sont données dans le tableau ci dessous (ts appartient à Ʈs ; t appartient à Ʈ).

**Sémantique**: les substitutions des variables doivent respecter les types.

> **Attention**: Les types et les droits sont définis quand le système est initialisé et demeurent constants.

**Exemple**:
- Ʈ = {utilisateur, os, fichier}
- Ʈs = {utilisateur, os}
- A = {lire, écrire, exécuter, propriétaire}

Ici le type os désigne un officier de sécurité.

### Commandes TAM

Les commandes TAM utilisent le format suivant, où "xi:Ʈi" exprime que le paramètre xi est de type ti.

### État de protection

L'état de protection est un quadruplet (S, O, t, M) où:
1. **S**: l'ensemble des sujets
2. **O**: ensembles des objets
3. **t**: la fonction qui accorde un type à chaque objet
4. **M**: la matrice d'accès

> **Remarque**: Un point important, dans ce modèle, est que la création de nouveaux types n'est pas possible.

Sandhu montre qu'il est possible de résoudre le problème de sûreté dans bon nombre de cas pratiques, sans perdre de puissance d'expression.

Le problème de sûreté est décidable suivant certaines conditions parmi lesquelles:
- Le système doit être monotone (les privilèges ne peuvent être supprimés)
- Les commandes doivent être limitées à 3 paramètres

> **Complément**: Une version dite "augmentée" de TAM, appelée ATAM, a été proposée (1992) afin de fournir un moyen simple de détecter l'absence de droits dans une matrice d'accès. Pour cela, le modèle ATAM offre la possibilité d'utiliser des tests du type: « ai n'appartient pas à M(s,o) » dans la partie conditionnelle de la commande.

La façon de gérer ce type de commande et de résoudre le problème de protection a également été définie. L'intérêt de cette démarche consiste à modéliser facilement la séparation des responsabilités (celle-ci préconise l'intervention de plusieurs utilisateurs pour mener à bien une certaine tâche).

## D. Vulnérabilités des modèles discrétionnaires

En définissant les concepts de base des politiques discrétionnaires, nous avons fait références aux requête d'accès faites par les utilisateurs pour accéder aux objets. Celles ci sont vérifiées par rapport aux autorisations des utilisateurs. Bien que chaque requête soit affiliée à un utilisateur, une étude plus poussée des contrôles d'accès montre l'intérêt de différencier entre un utilisateur et un sujet.

Les utilisateurs sont des entités passives pour lesquels des autorisations peuvent être spécifiées, et qui peuvent se connecter au système. Une fois connectés au système, les utilisateurs créent des processus (sujets) qui s'exécutent pour leur compte et, par conséquent, envoient des requêtes au système.

Les politiques discrétionnaires ignorent cette distinction et évaluent toutes les requêtes présentées par un processus en cours d'exécution pour le compte de certains utilisateurs par rapport aux autorisations de l'utilisateur.

Cet aspect rend les politiques discrétionnaires vulnérables aux processus exécutant des programmes malveillants qui exploitent les autorisations de l'utilisateur pour le compte duquel ils s'exécutent.

En particulier, le système de contrôle d'accès peut être contournée par les chevaux de Troie intégrées dans les programmes.

**Définition**: Un cheval de Troie est un programme d'ordinateur avec une fonction apparemment ou réellement utile, qui contient des fonctions supplémentaires cachées qui exploitent sournoisement les autorisations légitimes du processus appelant. (Les virus et les bombes logiques sont généralement transmis comme les chevaux de Troie).

> **Remarque**: Un cheval de Troie peut utiliser à mauvais escient les autorisations de l'utilisateur exécutant, par exemple, il pourrait même supprimer tous les fichiers de l'utilisateur (ce comportement destructeur n'est pas rare dans le cas des virus).

Cette vulnérabilité aux chevaux de Troie, ainsi que le fait que les politiques discrétionnaires n'assurent aucun contrôle sur la circulation de l'information une fois que cette information est acquise par un processus, font qu'il est possible pour les processus de divulguer des informations à des utilisateurs non autorisés à les lire.

Tout cela peut se produire à l'insu de l'administrateur ou propriétaires de données, et malgré le fait que chaque demande d'accès unique est contrôlée.

### Exemple: Attaque par cheval de Troie

Supposons que dans une organisation, Vicky, un gestionnaire de haut niveau, crée un fichier 'Market' contenant des informations importantes sur l'émission de nouveaux produits. Ces informations sont très sensibles pour l'organisation et, conformément à la politique de l'organisation, ne doivent pas être divulgués à quiconque en dehors de Vicky.

Considérons maintenant John, l'un des subordonnés de Vicky, qui veut acquérir ces informations sensibles pour les vendre à un concurrent.

Pour ce faire, John crée un fichier, appelons-le "Stolen", et donne l'autorisation à Vicky pour écrire dans ce fichier.

Notez que Vicky ne peut même pas connaître l'existence de "Stolen", ou sur le fait qu'il a l'autorisation d'écriture sur celui-ci.

En outre, John modifie une application généralement utilisée par Vicky, pour inclure deux opérations cachées, une opération de lecture sur le fichier "Market" et une opération d'écriture sur le fichier "Stolen". Puis, il donne la nouvelle application à son manager.

Supposons maintenant que Vicky exécute l'application. Depuis l'application exécutée au nom de Vicky, chaque accès est vérifié par rapport aux autorisations de Vicky, et les opérations de lecture et d'écriture ci-dessus sont autorisés. En conséquence, lors de l'exécution, des informations sensibles du fichier "Market" sont transférées vers "Stolen" et donc en mode lecture à l'employé malhonnête John, qui peut alors les vendre à un concurrent.

Il peut paraître peu intéressant de à se défendre contre les fuites d'information à travers chevaux de Troie car une telle fuite peut avoir lieu de toute façon, Vicky peut transmettre explicitement cette information à John, éventuellement hors ligne, sans l'utilisation du système informatique. C'est ici que la distinction entre les utilisateurs et les sujets opérant sur leur nom entre en jeu. Alors que les utilisateurs sont sensés respecter les restrictions d'accès, les sujets opérant en leur nom ne le sont pas.

En ce qui concerne notre exemple, Vicky est digne de confiance de ne pas divulguer les informations sensibles qu'il connaît à Jean, puisque, selon les autorisations, John ne peut pas y accéder.

Cependant, les processus opérant pour le compte de Vicky ne peut pas jouir de la même confiance.

Les processus exécutent des programmes qui, sauf dûment certifiés, ne peuvent pas jouir de confiance pour les opérations qu'ils exécutent. Pour cette raison, les restrictions doivent être imposées sur les opérations que les processus peuvent exécuter.

En particulier, la protection contre les chevaux de Troie exige le contrôle des flux d'informations lors de l'exécution des processus et éventuellement de les restreindre.

Les politiques obligatoires fournissent un moyen de faire respecter le contrôle de flux d'informations grâce à l'utilisation d'étiquettes.
