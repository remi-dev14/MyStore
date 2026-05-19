<?php
/**
 * Custom stock update endpoint for PrestaShop 8
 *
 * Supports:
 * - Simple products
 * - One specific combination
 *
 * Example:
 *
 * Simple product:
 * http://localhost/prestashop/stock_update.php
 * ?key=API_KEY
 * &id_product=1
 * &quantity=10
 *
 * Product combination:
 * http://localhost/prestashop/stock_update.php
 * ?key=API_KEY
 * &id_product=1
 * &id_product_attribute=3
 * &quantity=10
 */

require_once __DIR__ . '/config/config.inc.php';

header('Content-Type: application/json; charset=utf-8');

try {

    // =========================================================
    // AUTH
    // =========================================================

    $key = '';

    if (!empty($_SERVER['HTTP_X_API_KEY'])) {
        $key = trim($_SERVER['HTTP_X_API_KEY']);
    } elseif (!empty($_POST['key'])) {
        $key = trim($_POST['key']);
    } elseif (!empty($_GET['key'])) {
        $key = trim($_GET['key']);
    }

    if (empty($key)) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'error' => 'Missing API key'
        ]);

        exit;
    }

    $webservice = Db::getInstance()->getRow(
        'SELECT id_webservice_account
         FROM `' . _DB_PREFIX_ . 'webservice_account`
         WHERE `key` = "' . pSQL($key) . '"
         AND `active` = 1'
    );

    if (!$webservice) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'error' => 'Unauthorized'
        ]);

        exit;
    }

    // =========================================================
    // PARAMETERS
    // =========================================================

    $idProduct = (int)($_POST['id_product'] ?? $_GET['id_product'] ?? 0);

    $idProductAttribute = (int)($_POST['id_product_attribute'] ?? $_GET['id_product_attribute'] ?? 0);

    $quantity = (int)($_POST['quantity'] ?? $_GET['quantity'] ?? 0);

    if ($idProduct <= 0) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'id_product is required'
        ]);

        exit;
    }

    // =========================================================
    // RECHERCHE OU CRÉATION DE L'ENTRÉE stock_available
    // Fonctionne même si le produit est absent de ps_product.
    // =========================================================

    $db = Db::getInstance();

    $stockRow = $db->getRow(
        'SELECT * FROM `' . _DB_PREFIX_ . 'stock_available`
         WHERE `id_product`           = ' . (int)$idProduct . '
         AND   `id_product_attribute` = ' . (int)$idProductAttribute
    );

    if (!$stockRow) {
        // Créer l'entrée manquante (ex : produit venant d'être importé)
        $db->insert('stock_available', [
            'id_product'           => (int)$idProduct,
            'id_product_attribute' => (int)$idProductAttribute,
            'id_shop'              => 1,
            'id_shop_group'        => 0,
            'quantity'             => 0,
            'depends_on_stock'     => 0,
            'out_of_stock'         => 2,
            'location'             => '',
        ]);
        $stockRow = $db->getRow(
            'SELECT * FROM `' . _DB_PREFIX_ . 'stock_available`
             WHERE `id_product`           = ' . (int)$idProduct . '
             AND   `id_product_attribute` = ' . (int)$idProductAttribute
        );
    }

    if (!$stockRow) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Impossible de créer/trouver stock_available']);
        exit;
    }

    // =========================================================
    // MISE À JOUR
    // =========================================================

    $beforeQty = (int)$stockRow['quantity'];

    $updated = $db->update(
        'stock_available',
        ['quantity' => (int)$quantity],
        '`id_product`           = ' . (int)$idProduct . '
         AND `id_product_attribute` = ' . (int)$idProductAttribute
    );

    // Synchronisation du stock total du produit (non fatale si produit absent de ps_product)
    try {
        StockAvailable::synchronize($idProduct);
    } catch (Throwable $e) { /* non bloquant */ }

    $afterQty = (int)$db->getValue(
        'SELECT quantity FROM `' . _DB_PREFIX_ . 'stock_available`
         WHERE `id_product`           = ' . (int)$idProduct . '
         AND   `id_product_attribute` = ' . (int)$idProductAttribute
    );

    echo json_encode([
        'success'              => (bool)$updated,
        'id_product'           => $idProduct,
        'id_product_attribute' => $idProductAttribute,
        'quantity_before'      => $beforeQty,
        'quantity_after'       => $afterQty,
        'requested_quantity'   => $quantity,
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}