<?php
/**
 * cancel_order.php — Annulation d'une commande PrestaShop 8
 *
 * Déployer à la racine PrestaShop (même niveau que index.php).
 *
 * Appelle changeIdOrderState(6) → déclenche hooks PS, email d'annulation,
 * historique commande. La ré-incrémentation du stock dépend de la config
 * de l'état "Annulé" dans Commandes > Statuts du BO PS.
 *
 * ── CURL ──────────────────────────────────────────────────────────────────
 * curl -s -X POST https://myshop.com/cancel_order.php \
 *   -H "X-Api-Key: VOTRE_CLE" \
 *   -H "Content-Type: application/json" \
 *   -d '{"id_order": 42}'
 */

require_once __DIR__ . '/config/config.inc.php';

header('Content-Type: application/json; charset=utf-8');

// ── Authentification ──────────────────────────────────────────────────────

$key = trim($_SERVER['HTTP_X_API_KEY'] ?? '');
if (empty($key)) {
    $auth = trim($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (stripos($auth, 'bearer ') === 0) {
        $key = trim(substr($auth, 7));
    }
}
if (empty($key) && !empty($_POST['key'])) {
    $key = trim($_POST['key']);
}

if (empty($key)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Clé API manquante']);
    exit;
}

$ws = Db::getInstance()->getRow(
    'SELECT id_webservice_account FROM `' . _DB_PREFIX_ . 'webservice_account`
     WHERE `key` = "' . pSQL($key) . '" AND `active` = 1'
);

if (!$ws) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Clé API invalide ou désactivée']);
    exit;
}

// ── Paramètres ────────────────────────────────────────────────────────────

$input = [];
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (str_contains($ct, 'application/json')) {
    $input = json_decode((string)file_get_contents('php://input'), true) ?? [];
} else {
    $input = $_POST;
}

$idOrder = (int)($input['id_order'] ?? 0);

if ($idOrder <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'id_order requis']);
    exit;
}

// ── Chargement commande ───────────────────────────────────────────────────

$order = new Order($idOrder);

if (!Validate::isLoadedObject($order)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => "Commande #{$idOrder} introuvable"]);
    exit;
}

$prevState = (int)$order->current_state;

// Idempotence
if ($prevState === 6) {
    echo json_encode([
        'success'       => true,
        'order_id'      => $idOrder,
        'current_state' => 6,
        'message'       => 'Commande déjà annulée.',
        'skipped'       => true,
    ]);
    exit;
}

// ── Annulation ────────────────────────────────────────────────────────────

try {
    $history = new OrderHistory();
    $history->id_order = (int)$order->id;
    $history->changeIdOrderState(6, $order);
    $history->add();

    PrestaShopLogger::addLog(
        "[cancel_order] Commande #{$idOrder} annulée : état {$prevState} → 6.",
        1, null, 'Order', $idOrder
    );

    echo json_encode([
        'success'        => true,
        'order_id'       => $idOrder,
        'previous_state' => $prevState,
        'final_state'    => 6,
        'message'        => 'Commande annulée. Hooks PS déclenchés.',
    ]);

} catch (Throwable $e) {
    PrestaShopLogger::addLog(
        '[cancel_order] Erreur commande #' . $idOrder . ' : ' . $e->getMessage(),
        3, null, 'Order', $idOrder
    );
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
