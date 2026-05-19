<?php
/**
 * StockSyncService — gestion propre des mouvements de stock PrestaShop 8.2
 *
 * POURQUOI NE JAMAIS modifier stock_available directement via SQL :
 * ─────────────────────────────────────────────────────────────────
 * 1. Pas de stock_mvt créé → historique vide dans le BO PS.
 * 2. Pas d'exécution du hook actionUpdateQuantity → modules tiers (ERP,
 *    marketplace, analytics) ne sont pas notifiés.
 * 3. Désynchronisation possible si le cache PS (table ps_product)
 *    contient des quantités préagrégées.
 * 4. Quantités négatives possibles (pas de validation).
 * 5. Incompatible avec la Gestion Avancée des Stocks (ASM).
 *
 * COMMENT FONCTIONNE LE MOTEUR DE STOCK PS 8 :
 * ─────────────────────────────────────────────
 * StockAvailable::updateQuantity($id_product, $id_attr, $delta)
 *   → met à jour ps_stock_available.quantity
 *   → déclenche hook actionUpdateQuantity
 *   → appelle StockAvailable::synchronize() pour recalculer le total produit
 *
 * Pour créer un mouvement formel (ps_stock_mvt) :
 *   → new StockMvt() + ->add()   (classe ObjectModel de PS)
 *   → ou changeIdOrderState() qui le fait automatiquement
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

class StockSyncService
{
    private Context $context;
    private int     $idShop;

    public function __construct(Context $context)
    {
        $this->context = $context;
        $this->idShop  = (int)($context->shop->id ?? Shop::getContextShopID());
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────

    /**
     * Ajuster le stock d'un produit/déclinaison sans commande associée.
     *
     * @param int    $idProduct          ID produit
     * @param int    $idProductAttribute ID déclinaison (0 si produit simple)
     * @param int    $quantity           Quantité (toujours positive)
     * @param string $operation          increase | decrease | set
     * @param string $reason             Libellé du mouvement (journalisation)
     */
    public function updateStock(
        int    $idProduct,
        int    $idProductAttribute,
        int    $quantity,
        string $operation,
        string $reason
    ): array {
        $beforeQty = StockAvailable::getQuantityAvailableByProduct(
            $idProduct,
            $idProductAttribute,
            $this->idShop
        );

        [$delta, $afterQty, $sign] = $this->computeDelta(
            $operation,
            $quantity,
            $beforeQty
        );

        // ── Mise à jour propre via StockAvailable ──────────────────────────
        // updateQuantity() s'occupe de :
        //   • ps_stock_available.quantity
        //   • Hook actionUpdateQuantity
        //   • StockAvailable::synchronize() (recalcul total produit)
        StockAvailable::updateQuantity(
            $idProduct,
            $idProductAttribute,
            $delta,
            $this->idShop
        );

        // ── Création du mouvement formel (ps_stock_mvt) ────────────────────
        $this->createStockMvt(
            $idProduct,
            $idProductAttribute,
            abs($delta),
            $sign,
            0,    // pas de commande
            $reason
        );

        PrestaShopLogger::addLog(
            sprintf(
                '[StockSync] %s · produit #%d · décl #%d · %d → %d (Δ%+d) · %s',
                strtoupper($operation),
                $idProduct,
                $idProductAttribute,
                $beforeQty,
                $afterQty,
                $delta,
                $reason
            ),
            1, // INFO
            null,
            'Product',
            $idProduct
        );

        return [
            'product_id'   => $idProduct,
            'attribute_id' => $idProductAttribute,
            'operation'    => $operation,
            'qty_before'   => $beforeQty,
            'qty_after'    => $afterQty,
            'delta'        => $delta,
        ];
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVATES
    // ─────────────────────────────────────────────────────────────

    /**
     * Calcule le delta, la quantité résultante et le signe MVT.
     * @return array{int, int, int}  [delta, newQty, sign]
     */
    private function computeDelta(string $operation, int $quantity, int $currentQty): array
    {
        return match ($operation) {
            'increase' => [$quantity,                          $currentQty + $quantity,              1],
            'decrease' => [-$quantity,                         max(0, $currentQty - $quantity),     -1],
            'set'      => [$quantity - $currentQty,            $quantity,         ($quantity >= $currentQty) ? 1 : -1],
            default    => throw new InvalidArgumentException("Operation invalide : $operation"),
        };
    }

    /**
     * Crée un enregistrement formel dans ps_stock_mvt.
     *
     * POURQUOI id_stock = 0 est acceptable en mode non-ASM :
     *   PS8 n'impose pas de FK entre ps_stock_mvt et ps_stock.
     *   La colonne id_stock est un index, pas une contrainte d'intégrité.
     *   PS lui-même insère id_stock=0 pour les mouvements hors-ASM
     *   (voir StockAvailable::updateQuantity source PS 8.x).
     *
     * En mode ASM (Gestion Avancée des Stocks activée), id_stock doit
     * pointer vers ps_stock.id. Dans ce cas, récupérer l'id via la
     * classe Stock ou StockManager.
     */
    private function createStockMvt(
        int    $idProduct,
        int    $idProductAttribute,
        int    $physicalQty,
        int    $sign,
        int    $idOrder,
        string $reason
    ): void {
        if ($physicalQty === 0) {
            return;
        }

        // Cherche une raison de mouvement cohérente avec le signe
        $idReason = $this->getMvtReasonId($sign);

        // Récupère le nom du produit (champ obligatoire dans ps_stock_mvt)
        $productName = (string)Db::getInstance()->getValue(
            'SELECT pl.name FROM ' . _DB_PREFIX_ . 'product_lang pl
             WHERE pl.id_product = ' . (int)$idProduct . '
             AND pl.id_lang = ' . (int)$this->context->language->id . '
             LIMIT 1'
        );
        if ($productName === '') {
            $productName = 'Product #' . $idProduct;
        }

        try {
            $mvt                     = new StockMvt();
            $mvt->id_stock           = 0;          // 0 pour les shops sans ASM
            $mvt->id_stock_mvt_reason = $idReason;
            $mvt->id_employee        = (int)($this->context->employee?->id ?: 1);
            $mvt->id_order           = $idOrder;
            $mvt->product_name       = $productName;
            $mvt->physical_quantity  = $physicalQty;
            $mvt->sign               = $sign;      // 1 = entrée, -1 = sortie
            $mvt->price_te           = 0.0;
            $mvt->date_add           = date('Y-m-d H:i:s');
            $mvt->add();
        } catch (Throwable $e) {
            // Non bloquant — PS sans ASM peut refuser id_stock=0 selon config
            PrestaShopLogger::addLog(
                '[StockSync] stock_mvt ignoré (shop sans ASM ?) : ' . $e->getMessage(),
                2, // WARNING
                null,
                'Product',
                $idProduct
            );
        }
    }

    /**
     * Retourne l'id d'une raison de mouvement compatible avec le signe donné.
     * Fallback sur 1 si aucune raison n'est trouvée.
     */
    private function getMvtReasonId(int $sign): int
    {
        $id = (int)Db::getInstance()->getValue(
            'SELECT id_stock_mvt_reason FROM ' . _DB_PREFIX_ . 'stock_mvt_reason
             WHERE sign = ' . $sign . ' AND deleted = 0 ORDER BY id_stock_mvt_reason ASC LIMIT 1'
        );

        return $id ?: 1;
    }
}
