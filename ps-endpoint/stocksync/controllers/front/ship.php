<?php
/**
 * StockSync — Endpoint d'expédition de commande
 * URL : POST /module/stocksync/ship
 *
 * Déclenche le workflow PS COMPLET :
 *   changeIdOrderState(4)  → Expédié  (shipped=1 → décrémente stock, stock_mvt, emails, hooks)
 *   changeIdOrderState(5)  → Livré    (shipped=0 → état final visible, pas de double décrément)
 *
 * ═══════════════════════════════════════════════════════════════════
 * POSTMAN / CURL
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── Expédier la commande #42 ───────────────────────────────────────
 * curl -s -X POST https://myshop.com/module/stocksync/ship \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_order": 42}'
 *
 * ── Réponse succès ─────────────────────────────────────────────────
 * {
 *   "success": true,
 *   "data": {
 *     "order_id": 42,
 *     "previous_state": 11,
 *     "final_state": 5,
 *     "skipped": false,
 *     "message": "Commande expédiée (état 4 → état 5). Stock décrémenté, stock_mvt créés, hooks PS déclenchés."
 *   }
 * }
 *
 * ── Réponse idempotente (déjà livré) ──────────────────────────────
 * {
 *   "success": true,
 *   "data": { "order_id": 42, "current_state": 5, "skipped": true, "message": "..." }
 * }
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once _PS_MODULE_DIR_ . 'stocksync/classes/OrderSyncService.php';

class StocksyncShipModuleFrontController extends ModuleFrontController
{
    public $ajax = true;
    public $ssl  = true;

    // ─────────────────────────────────────────────────────────────
    // POINT D'ENTRÉE
    // ─────────────────────────────────────────────────────────────

    public function postProcess(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendError('Méthode non autorisée. Utilisez POST.', 405);
        }

        $this->authenticate();

        $input   = $this->readJsonBody();
        $idOrder = (int)($input['id_order'] ?? 0);

        if ($idOrder <= 0) {
            $this->sendError('id_order manquant ou invalide.');
        }

        try {
            $service = new OrderSyncService($this->context);
            $result  = $service->shipOrder($idOrder);
            $this->sendSuccess($result);
        } catch (RuntimeException $e) {
            $this->sendError($e->getMessage(), 404);
        } catch (Throwable $e) {
            PrestaShopLogger::addLog(
                '[StockSync/ship] Erreur commande #' . $idOrder . ' : ' . $e->getMessage(),
                3, null, 'Order', $idOrder
            );
            $this->sendError('Erreur interne : ' . $e->getMessage(), 500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS (identiques à api.php — extraction possible en trait si besoin)
    // ─────────────────────────────────────────────────────────────

    private function authenticate(): void
    {
        $provided = $this->extractApiKey();

        if (empty($provided)) {
            $this->sendError('Clé API manquante (header X-Api-Key ou Authorization: Bearer).', 401);
        }

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
        $auth = trim($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (stripos($auth, 'bearer ') === 0) {
            return trim(substr($auth, 7));
        }

        return trim($_SERVER['HTTP_X_API_KEY'] ?? '');
    }

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
