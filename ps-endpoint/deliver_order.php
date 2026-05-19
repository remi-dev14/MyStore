<?php
/**
 * deliver_order.php — Livraison d'une commande PrestaShop 8
 *
 * Déployer à la racine PrestaShop (même niveau que index.php).
 *
 * Ce script exécute le workflow PS COMPLET via changeIdOrderState() :
 *   État 4 (Expédié, shipped=1) → décrémente stock, crée stock_mvt,
 *                                  déclenche hooks, envoie emails
 *   État 5 (Livré,   shipped=0) → état final visible (pas de re-décrémentation)
 *
 * Authentification : clé webservice PS
 *   Header : X-Api-Key: <clé>   ou   POST param : key=<clé>
 *
 * ── CURL ──────────────────────────────────────────────────────────────────
 * curl -s -X POST https://myshop.com/deliver_order.php \
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

// Idempotence : déjà expédiée ou livrée
if (in_array($prevState, [4, 5], true)) {
    echo json_encode([
        'success'       => true,
        'order_id'      => $idOrder,
        'current_state' => $prevState,
        'message'       => 'Commande déjà expédiée / livrée — aucune action.',
        'skipped'       => true,
    ]);
    exit;
}

// ── Workflow de livraison ─────────────────────────────────────────────────

try {
    // ── État 4 : Expédié (shipped = 1) ────────────────────────────────────
    // changeIdOrderState(4) déclenche TOUT :
    //   • StockAvailable::updateQuantity(-qty) pour chaque ligne de commande
    //   • Création automatique des enregistrements ps_stock_mvt (sign = -1)
    //   • ProductSale::fillProductSales() (statistiques ventes)
    //   • Bon de livraison si l'état l'exige
    //   • Email client / admin si configuré
    //   • Hook actionOrderStatusUpdate
    //   • Hook actionOrderStatusPostUpdate
    //   • Mise à jour ps_orders.current_state
    $h1 = new OrderHistory();
    $h1->id_order = (int)$order->id;
    $h1->changeIdOrderState(4, $order);
    $h1->add(); // persiste la ligne dans ps_order_history

    // ── État 5 : Livré (shipped = 0) ──────────────────────────────────────
    // État final visible dans le BO et le front.
    // shipped = 0 → NE re-décrémente PAS le stock une deuxième fois.
    $h2 = new OrderHistory();
    $h2->id_order = (int)$order->id;
    $h2->changeIdOrderState(5, $order);
    $h2->add();

    PrestaShopLogger::addLog(
        "[deliver_order] Commande #{$idOrder} livrée : état {$prevState} → 4 → 5. Workflow PS complet.",
        1, null, 'Order', $idOrder
    );

    echo json_encode([
        'success'        => true,
        'order_id'       => $idOrder,
        'previous_state' => $prevState,
        'final_state'    => 5,
        'message'        => 'Commande livrée. Stock décrémenté, stock_mvt créés, hooks déclenchés.',
    ]);

} catch (Throwable $e) {
    PrestaShopLogger::addLog(
        '[deliver_order] Erreur commande #' . $idOrder . ' : ' . $e->getMessage(),
        3, null, 'Order', $idOrder
    );
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
