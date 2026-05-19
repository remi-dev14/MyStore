# PROMPT CLAUDE CODE — NewApp PrestaShop React (JS natif)

## CONTEXTE PROJET

Tu es un développeur fullstack senior. Tu dois développer une application React (JavaScript natif uniquement, PAS de TypeScript) appelée **NewApp** qui sert de frontend personnalisé à une instance PrestaShop existante (ExistingApp). L'app communique avec PrestaShop via son **API Webservice XML**.

**Stack technique :**
- React 18+ (JavaScript natif, CRA ou Vite)
- React Router DOM v6 pour le routing
- Axios pour les appels API
- CSS Modules ou un fichier CSS global par module (pas de Tailwind)
- Pas de bibliothèque UI externe lourde (pas de MUI/Ant Design)
- Node.js backend léger (Express) pour proxifier les appels PrestaShop API (éviter CORS + cacher la clé API)

**Configuration PrestaShop :**
- URL API : `http://localhost/prestashop/api/`
- Authentification : clé API PrestaShop (Basic Auth)
- Langues : id=1 (Français), id=2 (Anglais)
- Pays : France | Devise : Euro (€)
- Format API : XML (pas JSON natif dans PrestaShop)
- Tax rule group id=1 : "MG Standard Rate (20%)"

---

## FICHIERS DE DONNÉES À IMPORTER

### Fichier 1 — Produits (`import-data-mai-26 - fichier1.csv`)
```csv
date_availability_produit,nom,reference,prix_ttc,Taxe,categorie,prix_achat
01/12/2025,Tshirt,T_01,"12,5","11,65%",Akanjo,"8,5"
02/05/2026,Pantalon,P_01,"18,99","11,65%",Akanjo,"14,33"
08/05/2026,Casquette,C_03,5,"5,60%",Accessoire,2
08/05/2026,Montre,M_02,56,"5,60%",Accessoire,40
```
**Notes :** Les prix utilisent la virgule comme séparateur décimal. `date_availability_produit` au format DD/MM/YYYY. La taxe est un pourcentage (11,65% ou 5,60%). Catégories : "Akanjo" et "Accessoire".

### Fichier 2 — Déclinaisons/Stock (`import-data-mai-26 - fichier2.csv`)
```csv
reference,specificité,karazany,stock_initial,prix_vente_ttc
T_01,taille,ngoza,13,"12,5"
T_01,taille,kely,10,15
P_01,couleur,mainty,5,"23,49"
P_01,couleur,fotsy,3,"18,99"
C_03,,,10,
M_02,,,11,
```
**Notes :** `specificité` = type d'attribut (taille/couleur), `karazany` = valeur de l'attribut. Les produits C_03 et M_02 n'ont PAS de déclinaison (produits simples). **IMPORTANT J2 : seule la déclinaison est importée, pas de combinaison** — cela signifie qu'on importe les attributs comme information descriptive mais on ne crée PAS de combinations PrestaShop. Chaque ligne = un stock distinct.

### Fichier 3 — Clients & Commandes (`import-data-mai-26 - fichier3.csv`)
```csv
date,nom,email,pwd,adresse,achat,etat
09/05/2026,Rakoto,rakoto@yopmail.com,XvzsX5O0!GBD0uXQ,Andoharanofotsy,"[(""T_01"";3;""ngoza"")]",
16/04/2026,Rajao,rajao1970@yopmail.com,BAC?UoxjQIW;Na8ix,Analakely,"[(""T_01"";2;""kely""),(""C_03"";1;"""")]",paiement accepté
07/05/2026,Rakoto,rakoto@yopmail.com,XvzsX5O0!GBD0uXQ,Andoharanofotsy,"[(""T_01"";1;""kely"")]",paiement accepté
```
**Notes :** Format `achat` = `[(ref;quantité;déclinaison)]`. Si `etat` est vide = dans le panier (pas encore une commande). `paiement accepté` = commande avec état "paiement effectué". Même email = même client (Rakoto apparaît 2 fois).

### Fichier 4 — Images (`images.zip`)
Fichier ZIP contenant les images produits à uploader via l'API PrestaShop.

---

## SCHÉMA XML PrestaShop (endpoints principaux)

Les schémas blank pour products, customers, orders sont fournis dans `XMLlist_utils.txt`.
Les exemples de données réelles sont dans `SchemaXML.txt`.

**Endpoints clés :**
- `GET/POST /api/products` — CRUD produits
- `GET/POST /api/customers` — CRUD clients  
- `GET/POST /api/orders` — CRUD commandes
- `GET/POST /api/carts` — CRUD paniers
- `GET/PUT /api/stock_availables` — Gestion stock (PUT uniquement, pas POST)
- `GET /api/categories` — Catégories
- `GET /api/order_states` — États de commande
- `POST /api/images/products/{id}` — Upload images

**États de commande utilisés dans NewApp (J2) :**
- "dans le panier" → c'est un cart, pas encore une order
- "paiement effectué" → order_state correspondant dans PrestaShop (id=2 "Payment accepted")
- "annulé" → order_state correspondant (id=6 "Canceled")

---

## ARCHITECTURE DES DOSSIERS

```
newapp/
├── package.json
├── .env                          # PRESTASHOP_API_URL, API_KEY, PORT
│
├── server/                       # Backend proxy Express
│   ├── index.js                  # Point d'entrée serveur
│   ├── middleware/
│   │   └── auth.js               # Middleware authentification backoffice
│   └── routes/
│       ├── prestashop.js         # Proxy générique vers API PrestaShop
│       ├── import.js             # Routes d'import CSV/ZIP
│       ├── orders.js             # Routes commandes
│       └── stock.js              # Routes gestion stock (J3)
│
├── src/                          # Frontend React
│   ├── index.js
│   ├── App.js                    # Router principal
│   │
│   ├── config/
│   │   └── api.js                # Base URL, helpers fetch
│   │
│   ├── context/
│   │   ├── AuthContext.js        # Contexte auth backoffice
│   │   └── CartContext.js        # Contexte panier frontoffice
│   │   └── UserContext.js        # Contexte utilisateur sélectionné (J2)
│   │
│   ├── utils/
│   │   ├── xmlParser.js          # Parse XML PrestaShop → JS objects
│   │   ├── xmlBuilder.js         # Build XML depuis JS objects → PrestaShop
│   │   ├── csvParser.js          # Parse CSV avec gestion virgules décimales
│   │   ├── dateUtils.js          # Validation/conversion dates DD/MM/YYYY
│   │   └── importValidation.js   # Validations import J3
│   │
│   ├── modules/
│   │   ├── backoffice/
│   │   │   ├── components/
│   │   │   │   ├── LoginPage.js          # J1-1a : Login avec credentials par défaut
│   │   │   │   ├── ResetDataPage.js      # J1-1b : Bouton réinitialisation données
│   │   │   │   ├── ImportPage.js         # J1-1c : Import 4 fichiers (3 CSV + 1 ZIP)
│   │   │   │   ├── OrdersManagePage.js   # J1-1d : Afficher/modifier état commandes
│   │   │   │   ├── DashboardPage.js      # J2-1b : Tableau de bord
│   │   │   │   ├── ImportErrorsPage.js   # J3-3a : Vérification erreurs import
│   │   │   │   ├── StockAddPage.js       # J3-3b : Ajouter stock produits
│   │   │   │   └── StockHistoryPage.js   # J3-3c : Évolution stock journalier
│   │   │   ├── BackofficeLayout.js       # Layout avec protection route
│   │   │   └── backoffice.css
│   │   │
│   │   └── frontoffice/
│   │       ├── components/
│   │       │   ├── UserSelectPage.js     # J2-2a : Page accueil sélection utilisateur
│   │       │   ├── ProductListPage.js    # J1-2a : Liste produits (accueil après login)
│   │       │   ├── ProductDetailPage.js  # J1-2a-i : Fiche produit détaillée
│   │       │   ├── CartPage.js           # J1-2b-i : Gestion panier
│   │       │   ├── CheckoutPage.js       # J1-2b-ii : Validation commande
│   │       │   ├── MyOrdersPage.js       # J1-2c : État de mes commandes
│   │       │   └── SearchPage.js         # J2-2c : Recherche multicritère
│   │       ├── FrontofficeLayout.js
│   │       └── frontoffice.css
│   │
│   └── shared/
│       └── components/
│           ├── ProtectedRoute.js
│           ├── ProductCard.js
│           └── Badge.js                  # J2-2b : Badges HOT/NEW
```

---

## TODO.TXT — PLAN D'EXÉCUTION PAR PHASES

Copie ce contenu dans un fichier `todo.txt` à la racine du projet et coche au fur et à mesure :

```
================================================================
NEWAPP — TODO LIST COMPLÈTE
================================================================

PHASE 0 : SETUP PROJET
================================================================
[ ] Initialiser le projet React (Vite ou CRA) en JavaScript
[ ] Installer dépendances : axios, react-router-dom, express, multer, xml2js, cors, fast-csv, dotenv, adm-zip
[ ] Créer le fichier .env avec PRESTASHOP_API_URL, PRESTASHOP_API_KEY, PORT, BACKOFFICE_LOGIN, BACKOFFICE_PWD
[ ] Créer la structure de dossiers selon l'architecture ci-dessus
[ ] Créer server/index.js : serveur Express avec proxy CORS vers PrestaShop
[ ] Créer src/utils/xmlParser.js : convertir XML PrestaShop en objets JS (utiliser xml2js)
[ ] Créer src/utils/xmlBuilder.js : construire XML depuis objets JS pour POST/PUT PrestaShop
[ ] Créer src/utils/csvParser.js : parser CSV avec gestion séparateur décimal virgule (prix "12,5" → 12.5)
[ ] Créer src/utils/dateUtils.js : parser DD/MM/YYYY, convertir vers YYYY-MM-DD, valider format
[ ] Créer src/config/api.js : instance axios avec baseURL vers le serveur proxy
[ ] Tester la connexion proxy → PrestaShop API (GET /api/products)

PHASE 1 — JOUR 1 : BACKOFFICE CORE
================================================================
[ ] [J1-1a] LoginPage.js
    - Formulaire login/mot de passe
    - Mettre les identifiants par DEFAUT dans les champs du formulaire (pré-remplis)
    - Stocker l'état d'authentification dans AuthContext
    - Rediriger vers le dashboard après login

[ ] [J1-1a] ProtectedRoute.js + BackofficeLayout.js
    - Protéger TOUTES les pages backoffice (redirect vers login si non connecté)
    - Layout minimaliste (pas de menu superflu, uniquement les pages demandées)

[ ] [J1-1b] ResetDataPage.js
    - Un bouton "Réinitialiser les données"
    - Appel API pour supprimer les données importées dans PrestaShop
    - Confirmation avant exécution
    - Feedback visuel (loading, succès, erreur)

[ ] [J1-1c] ImportPage.js
    - Zone d'upload pour 4 fichiers : 3 CSV + 1 ZIP images
    - Identification automatique des fichiers par leur contenu/colonnes
    - Parsing CSV fichier1 → créer produits via POST /api/products
      * Convertir prix TTC virgule → point décimal
      * Créer catégories "Akanjo" et "Accessoire" si inexistantes (POST /api/categories)
      * Mapper taxe 11,65% et 5,60% vers les tax_rule_groups PrestaShop
      * Remplir date_add avec la date d'import, available_date avec date_availability_produit
    - Parsing CSV fichier2 → gérer déclinaisons (J2 note: déclinaison sans combinaison)
      * Pour les produits avec spécificité : stocker info déclinaison + stock_initial
      * Pour les produits simples (C_03, M_02) : juste le stock_initial
      * Mettre à jour stock via PUT /api/stock_availables
    - Parsing CSV fichier3 → créer clients + commandes/paniers
      * Dédupliquer clients par email (Rakoto = 1 seul customer)
      * POST /api/customers avec email, nom (lastname), mot de passe
      * Créer adresse via POST /api/addresses (avec le champ adresse du CSV)
      * Si etat vide → créer un cart (POST /api/carts) — "dans le panier"
      * Si etat = "paiement accepté" → créer cart puis order (POST /api/orders) avec état correspondant
      * Parser le format achat [(ref;qté;déclinaison)] pour les lignes de commande
    - Upload images.zip : dézipper et POST /api/images/products/{id} pour chaque produit
    - Afficher progression et résultat de l'import

[ ] [J1-1d] OrdersManagePage.js
    - Tableau listant toutes les commandes (GET /api/orders)
    - Colonnes : référence, client, date, montant total, état actuel
    - Dropdown ou boutons pour modifier l'état :
      * "paiement effectué" → PUT order avec current_state = id état paiement
      * "annulé" → PUT order avec current_state = id état annulé
    - Feedback immédiat après modification

PHASE 2 — JOUR 1 : FRONTOFFICE CORE
================================================================
[ ] [J1-2a] ProductListPage.js
    - Page d'accueil affichant tous les produits (GET /api/products + détails)
    - Carte produit : image, nom, prix TTC, catégorie
    - Clic → fiche produit détaillée

[ ] [J1-2a-i] ProductDetailPage.js
    - Afficher : nom, description, prix, image(s), catégorie
    - Si déclinaisons : afficher les options (taille/couleur) — lecture seule (pas de combinaison)
    - Bouton "Ajouter au panier"
    - [J3-4a] Afficher la quantité en stock disponible

[ ] [J1-2b-i] CartPage.js + CartContext.js
    - Afficher les produits dans le panier avec quantités
    - Modifier quantité / supprimer du panier
    - Afficher le total
    - Bouton "Valider la commande"

[ ] [J1-2b-ii] CheckoutPage.js
    - Récapitulatif de la commande
    - Unique option de paiement : "Paiement à la livraison"
    - Pas de frais de livraison (shipping = 0)
    - Bouton "Confirmer" → créer cart + order dans PrestaShop
    - Rediriger vers page confirmation ou "Mes commandes"

[ ] [J1-2c] MyOrdersPage.js
    - Lister les commandes de l'utilisateur connecté
    - Afficher : référence, date, montant, état
    - Filtrer par client (GET /api/orders?filter[id_customer]=X)

PHASE 3 — JOUR 2 : ENRICHISSEMENTS
================================================================
[ ] [J2-1b] DashboardPage.js
    - Tableau de bord backoffice avec :
      * Par jour : nombre de commandes + montant total
      * Total général : somme de toutes les commandes
    - Données calculées depuis GET /api/orders

[ ] [J2-2a] UserSelectPage.js (NOUVELLE page d'accueil)
    - Remplacer la page d'accueil par défaut
    - Afficher la liste des utilisateurs existants (GET /api/customers)
    - Chaque utilisateur = carte cliquable pour "se connecter en tant que"
    - Option "Utilisateur anonyme" ajoutée
    - Stocker l'utilisateur sélectionné dans UserContext
    - Après sélection → rediriger vers ProductListPage

[ ] [J2-2b] Badges HOT / NEW sur ProductCard
    - Calculer depuis date_availability_produit (= available_date dans PrestaShop)
    - HOT : produit sorti 1 jour avant la date courante
    - NEW : produit sorti dans la semaine précédente
    - Afficher un badge visuel sur la carte produit

[ ] [J2-2c] SearchPage.js (Recherche multicritère)
    - Champ de recherche par nom de produit
    - Filtre par catégorie (dropdown)
    - Filtre par intervalle de prix (min - max)
    - Résultats en temps réel ou au clic "Rechercher"

PHASE 4 — JOUR 3 : VALIDATION IMPORT + STOCK
================================================================
[ ] [J3-3a] ImportErrorsPage.js (ou intégré dans ImportPage)
    - Vérifier AVANT import :
      * Nom de colonne non conforme (comparer headers CSV attendus vs reçus)
      * Format de date différent de DD/MM/YYYY (regex validation)
      * Montant positif (vérifier que prix > 0)
    - Afficher les erreurs trouvées avec numéro de ligne
    - Bloquer l'import si erreurs détectées

[ ] [J3-3b] StockAddPage.js
    - Page backoffice pour ajouter du stock à un produit
    - Sélectionner un produit (dropdown)
    - Saisir la quantité à ajouter (delta positif)
    - Appel au endpoint PrestaShop custom pour StockAvailable::updateQuantity($idProduct, 0, $delta)
    - OU via PUT /api/stock_availables/{id} en ajoutant au quantity existant
    - Note J3 : "mahazo micréer endpoint 1 ianareo ao am prestashop" = vous pouvez créer 1 endpoint custom dans PrestaShop pour appeler updateQuantity

[ ] [J3-3c] StockHistoryPage.js
    - Tableau de l'évolution du stock journalier d'un produit
    - Sélectionner un produit → afficher l'historique
    - Stocker localement les mouvements de stock (table/fichier côté serveur)
    - Afficher : date, quantité ajoutée/retirée, stock résultant
    - Graphique optionnel (ligne temporelle)

[ ] [J3-4a] Afficher quantité stock sur fiche produit
    - GET /api/stock_availables?filter[id_product]=X
    - Afficher "En stock: N unités" ou "Rupture de stock"

PHASE 5 — EXISTINGAPP VÉRIFICATION
================================================================
[ ] Vérifier que toutes les données importées (produits, clients, commandes) 
    sont visibles dans le backoffice PrestaShop natif
[ ] Vérifier que les modifications dans PrestaShop natif se reflètent dans NewApp
    (car NewApp lit l'API en temps réel)

PHASE 6 — FINITIONS
================================================================
[ ] Pas de menu ni affichage non demandé (note PDF)
[ ] Uniquement les pages demandées
[ ] Navigation minimale entre pages (liens simples)
[ ] Tester le workflow complet :
    Import → Affichage produits → Ajout panier → Checkout → Voir commande → Modifier état
[ ] Vérifier responsive basique
```

---

## RÈGLES IMPORTANTES À RESPECTER

1. **JavaScript natif uniquement** — Aucun TypeScript (.ts, .tsx interdit)
2. **Pas de menu ni affichage non demandé** — Seulement les pages listées dans le PDF
3. **France + Euro** — Configurer devise et pays
4. **Paiement uniquement "à la livraison"** — Pas d'autre mode de paiement
5. **Pas de frais de livraison** — total_shipping = 0
6. **Déclinaison sans combinaison (J2)** — Importer les attributs comme info mais pas de PrestaShop combinations
7. **Format CSV virgule décimale** — `"12,5"` = 12.5 en float
8. **Format date DD/MM/YYYY** — Convertir vers YYYY-MM-DD pour PrestaShop
9. **Dédupliquer clients par email** — Même email = même customer
10. **État commande vide = dans le panier** — Créer un cart, pas un order

---

## COMMANDES POUR DÉMARRER

```bash
# Créer le projet
npm create vite@latest newapp -- --template react
cd newapp
npm install

# Dépendances frontend
npm install axios react-router-dom

# Dépendances backend  
npm install express cors multer xml2js fast-csv dotenv adm-zip

# Lancer le dev
# Terminal 1 : npm run dev (React)
# Terminal 2 : node server/index.js (Express proxy)
```

---

## EXEMPLE DE PROXY SERVER (server/index.js)

```javascript
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PRESTA_URL = process.env.PRESTASHOP_API_URL;
const PRESTA_KEY = process.env.PRESTASHOP_API_KEY;

// Proxy générique GET
app.get('/api/presta/*', async (req, res) => {
  try {
    const path = req.params[0];
    const response = await axios.get(`${PRESTA_URL}/${path}`, {
      auth: { username: PRESTA_KEY, password: '' },
      params: req.query
    });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('Proxy server running');
});
```

---

## EXEMPLE PARSER XML (src/utils/xmlParser.js)

```javascript
import { parseStringPromise } from 'xml2js';

export async function parsePrestaXml(xmlString) {
  const result = await parseStringPromise(xmlString, {
    explicitArray: false,
    ignoreAttrs: false,
    mergeAttrs: true
  });
  return result;
}

export function extractProducts(parsed) {
  const products = parsed?.prestashop?.products?.product;
  if (!products) return [];
  return Array.isArray(products) ? products : [products];
}
```

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

Exécuter dans cet ordre strict pour éviter les dépendances cassées :

1. **PHASE 0** en entier (setup + utils + proxy)
2. **PHASE 1 Backoffice** : Login → Import → Orders (l'import alimente les données)
3. **PHASE 2 Frontoffice** : Products → Cart → Checkout → MyOrders
4. **PHASE 3** : Dashboard, UserSelect, Badges, Search
5. **PHASE 4** : Import validation, Stock
6. **PHASE 5 + 6** : Vérification + finitions

À chaque phase, **tester** avant de passer à la suivante.
