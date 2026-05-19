<?php
/**
 * StockSync — Endpoint de mouvement de stock
 * URL : POST /module/stocksync/api
 *
 * ═══════════════════════════════════════════════════════════════════
 * POSTMAN / CURL — Exemples d'utilisation
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── Décrémenter un produit simple ──────────────────────────────────
 * curl -s -X POST https://myshop.com/module/stocksync/api \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_product":12,"quantity":3,"operation":"decrease","reason":"Livraison commande"}'
 *
 * ── Incrémenter une déclinaison ────────────────────────────────────
 * curl -s -X POST https://myshop.com/module/stocksync/api \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_product":12,"id_product_attribute":7,"quantity":10,"operation":"increase","reason":"Réappro fournisseur"}'
 *
 * ── Fixer un stock absolu ──────────────────────────────────────────
 * curl -s -X POST https://myshop.com/module/stocksync/api \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_product":12,"quantity":50,"operation":"set","reason":"Inventaire physique"}'
 *
 * ── Avec commande liée ─────────────────────────────────────────────
 * curl -s -X POST https://myshop.com/module/stocksync/api \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_product":12,"quantity":2,"operation":"decrease","id_order":45,"reason":"Livré"}'
 *
 * ═══════════════════════════════════════════════════════════════════
 * Paramètres JSON
 * ═══════════════════════════════════════════════════════════════════
 * id_product            int      requis
 * id_product_attribute  int      optionnel (0 = produit simple)
 * quantity              int > 0  requis
 * operation             string   requis  — increase | decrease | set
 * reason                string   optionnel (journalisation)
 * id_order              int      optionnel (lie le mvt à une commande)
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once _PS_MODULE_DIR_ . 'stocksync/classes/StockSyncService.php';

class StocksyncApiModuleFrontController extends ModuleFrontController
{
    /** Force le mode AJAX (supprime le layout PS autour de la réponse) */
    public $ajax = true;
    /** Force HTTPS */
    public $ssl  = true;

    // ─────────────────────────────────────────────────────────────
    // POINT D'ENTRÉE
    // ─────────────────────────────────────────────────────────────

    public function postProcess(): void
    {
        // ── Méthode HTTP ──────────────────────────────────────────────────
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendError('Méthode non autorisée. Utilisez POST.', 405);
        }

        // ── Authentification ──────────────────────────────────────────────
        $this->authenticate();

        // ── Lecture des paramètres ────────────────────────────────────────
        $input = $this->readJsonBody();

        $idProduct          = (int)($input['id_product']           ?? 0);
        $idProductAttribute = (int)($input['id_product_attribute'] ?? 0);
        $quantity           = (int)($input['quantity']             ?? 0);
        $operation          = trim((string)($input['operation']    ?? ''));
        $reason             = trim((string)($input['reason']       ?? 'Ajustement manuel'));
        $idOrder            = (int)($input['id_order']             ?? 0);

        // ── Validation ────────────────────────────────────────────────────
        if ($idProduct <= 0) {
            $this->sendError('id_product manquant ou invalide.');
        }
        if ($quantity <= 0) {
            $this->sendError('quantity doit être un entier strictement positif.');
        }
        if (!in_array($operation, ['increase', 'decrease', 'set'], true)) {
            $this->sendError('operation doit être : increase, decrease ou set.');
        }

        // ── Existence du produit ──────────────────────────────────────────
        if (!Product::existsInDatabase($idProduct, 'product')) {
            $this->sendError("Produit #{$idProduct} introuvable.", 404);
        }

        // ── Existence de la déclinaison (si fournie) ──────────────────────
        if ($idProductAttribute > 0) {
            $exists = (int)Db::getInstance()->getValue(
                'SELECT id_product_attribute FROM ' . _DB_PREFIX_ . 'product_attribute
                 WHERE id_product = ' . $idProduct . '
                 AND id_product_attribute = ' . $idProductAttribute
            );
            if (!$exists) {
                $this->sendError(
                    "Déclinaison #{$idProductAttribute} introuvable pour le produit #{$idProduct}.",
                    404
                );
            }
        }

        // ── Traitement ────────────────────────────────────────────────────
        try {
            $service = new StockSyncService($this->context);
            $result  = $service->updateStock(
                $idProduct,
                $idProductAttribute,
                $quantity,
                $operation,
                $reason,
            );

            // Ajouter l'id_order dans le résultat si fourni
            if ($idOrder > 0) {
                $result['order_id'] = $idOrder;
            }

            $this->sendSuccess($result);
        } catch (InvalidArgumentException $e) {
            $this->sendError($e->getMessage());
        } catch (Throwable $e) {
            PrestaShopLogger::addLog(
                '[StockSync/api] Erreur : ' . $e->getMessage(),
                3, null, 'Product', $idProduct
            );
            $this->sendError('Erreur interne : ' . $e->getMessage(), 500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Authentification via la clé webservice PS existante.
     * Accepte :
     *   Header  X-Api-Key: <clé>
     *   Header  Authorization: Bearer <clé>
     */
    private function authenticate(): void
    {
        $provided = $this->extractApiKey();

        if (empty($provided)) {
            $this->sendError('Clé API manquante (header X-Api-Key ou Authorization: Bearer).', 401);
        }

        // Vérifie contre les comptes webservice PS actifs (même table que /api)
        $exists = (int)Db::getInstance()->getValue(
            'SELECT id_webservice_account FROM ' . _DB_PREFIX_ . 'webservice_account
             WHERE `key` = "' . pSQL($provided) . '" AND active = 1'
        );

        if (!$exists) {
            $this->sendError('Clé API invalide ou désactivée.', 401);
        }
    }

    private function extractApiKey(): string
    {
        // Authorization: Bearer <token>
        $auth = trim($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (stripos($auth, 'bearer ') === 0) {
            return trim(substr($auth, 7));
        }

        // X-Api-Key: <token>
        $key = trim($_SERVER['HTTP_X_API_KEY'] ?? '');
        if ($key !== '') {
            return $key;
        }

        return '';
    }

    /**
     * Lit le corps JSON de la requête.
     * Accepte aussi les champs POST classiques en fallback.
     */
    private function readJsonBody(): array
    {
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';

        if (str_contains($ct, 'application/json')) {
            $raw  = file_get_contents('php://input');
            $data = json_decode((string)$raw, true);
            return is_array($data) ? $data : [];
        }

        return $_POST;
    }

    private function sendSuccess(array $data, int $code = 200): void
    {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($code);
        echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    private function sendError(string $message, int $code = 400): void
    {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
