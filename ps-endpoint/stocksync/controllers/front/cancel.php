<?php
/**
 * StockSync — Endpoint d'annulation de commande
 * URL : POST /module/stocksync/cancel
 *
 * Déclenche le workflow PS complet via changeIdOrderState(6) :
 *   - Hook actionOrderStatusUpdate + actionOrderStatusPostUpdate
 *   - Email d'annulation client (si configuré dans l'état "Annulé")
 *   - Historique commande
 *
 * Note : la ré-incrémentation du stock dépend de la configuration
 * de l'état "Annulé" dans le BO PS (Commandes > Statuts).
 *
 * ═══════════════════════════════════════════════════════════════
 * CURL
 * ═══════════════════════════════════════════════════════════════
 * curl -s -X POST https://myshop.com/module/stocksync/cancel \
 *   -H "X-Api-Key: VOTRE_CLE_WEBSERVICE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_order": 42}'
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once _PS_MODULE_DIR_ . 'stocksync/classes/OrderSyncService.php';

class StocksyncCancelModuleFrontController extends ModuleFrontController
{
    public $ajax = true;
    public $ssl  = true;

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
            $result  = $service->cancelOrder($idOrder);
            $this->sendSuccess($result);
        } catch (RuntimeException $e) {
            $this->sendError($e->getMessage(), 404);
        } catch (Throwable $e) {
            PrestaShopLogger::addLog(
                '[StockSync/cancel] Erreur commande #' . $idOrder . ' : ' . $e->getMessage(),
                3, null, 'Order', $idOrder
            );
            $this->sendError('Erreur interne : ' . $e->getMessage(), 500);
        }
    }

    private function authenticate(): void
    {
        $provided = $this->extractApiKey();
        if (empty($provided)) {
            $this->sendError('Clé API manquante.', 401);
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
            $data = json_decode((string)file_get_contents('php://input'), true);
            return is_array($data) ? $data : [];
        }
        return $_POST;
    }

    private function sendSuccess(array $data): void
    {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(200);
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
