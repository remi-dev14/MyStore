<?php
/**
 * OrderSyncService — expédition/livraison d'une commande PS 8.2
 *
 * POURQUOI changeIdOrderState() est OBLIGATOIRE :
 * ────────────────────────────────────────────────
 * Un simple UPDATE sur ps_orders.current_state ne fait QUE changer
 * un entier en base. changeIdOrderState() déclenche toute la chaîne :
 *
 *   1. Décrémentation stock (si l'état a shipped = 1, ex : état 4)
 *      → StockAvailable::updateQuantity() appelé pour chaque ligne commande
 *      → Création automatique des enregistrements ps_stock_mvt
 *
 *   2. Statistiques de vente
 *      → ProductSale::fillProductSales()
 *
 *   3. Bon de livraison (si l'état a delivery = 1)
 *      → Delivery::addDelivery()
 *
 *   4. Emails automatiques
 *      → MailAlert, confirmation client/vendeur si configurés
 *
 *   5. Hooks natifs PS (tous les modules connectés sont notifiés) :
 *      → actionOrderStatusUpdate     (avant changement)
 *      → actionOrderStatusPostUpdate (après changement)
 *
 *   6. Mise à jour de ps_orders.current_state
 *
 * FLUX D'EXPÉDITION RECOMMANDÉ :
 * ───────────────────────────────
 *   État 4 (Expédié, shipped=1) → changeIdOrderState(4) déclenche tout
 *   État 5 (Livré,   shipped=0) → changeIdOrderState(5) = état final visible
 *
 * État 4 a shipped=1 → stock décrémenté + stock_mvt créés.
 * État 5 a shipped=0 → ne re-décrémente PAS le stock.
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

class OrderSyncService
{
    // États qui ont déjà déclenché le workflow de stock
    private const SHIPPED_STATES   = [4, 5];
    // État "Expédié" — shipped=1 dans PS par défaut
    private const STATE_EXPÉDIE    = 4;
    // État "Livré" — état final visible (shipped=0, pas de double décrément)
    private const STATE_LIVRE      = 5;
    // État "Annulé"
    private const STATE_ANNULE     = 6;

    private Context $context;

    public function __construct(Context $context)
    {
        $this->context = $context;
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────

    /**
     * Expédier + livrer une commande via le workflow PS complet.
     *
     * Flux :
     *   1. changeIdOrderState(4) → stock décrémenté, stock_mvt créés,
     *      emails envoyés, hooks déclenchés
     *   2. changeIdOrderState(5) → état final "Livré" (pas de stock)
     *
     * Idempotent : si la commande est déjà expédiée/livrée, retourne
     * un résultat sans erreur avec skipped=true.
     */
    public function shipOrder(int $idOrder): array
    {
        $order = new Order($idOrder);

        if (!Validate::isLoadedObject($order)) {
            throw new RuntimeException("Commande #{$idOrder} introuvable.");
        }

        $currentState = (int)$order->current_state;

        // ── Idempotence ─────────────────────────────────────────────────────
        if (in_array($currentState, self::SHIPPED_STATES, true)) {
            return [
                'order_id'      => $idOrder,
                'current_state' => $currentState,
                'message'       => 'Commande déjà expédiée ou livrée — aucune action.',
                'skipped'       => true,
            ];
        }

        // ── Étape 1 : Expédition (state 4, shipped=1) ──────────────────────
        // C'est ici que TOUT se passe :
        //   • Boucle sur order_detail → StockAvailable::updateQuantity(-qty)
        //   • ps_stock_mvt créés avec sign=-1 et id_order
        //   • ProductSale::fillProductSales() (stats)
        //   • Bon de livraison si configured
        //   • Emails client/admin
        //   • Hook actionOrderStatusUpdate + actionOrderStatusPostUpdate
        $this->applyState($order, self::STATE_EXPÉDIE);

        // ── Étape 2 : Livré (state 5, shipped=0) ───────────────────────────
        // Ne re-décrémente PAS le stock (shipped=0).
        // Donne un état final propre visible dans le BO PS et front-office.
        $this->applyState($order, self::STATE_LIVRE);

        PrestaShopLogger::addLog(
            sprintf(
                '[StockSync] Commande #%d expédiée : état %d → 4 → 5. Workflow PS complet déclenché.',
                $idOrder,
                $currentState
            ),
            1, // INFO
            null,
            'Order',
            $idOrder
        );

        return [
            'order_id'        => $idOrder,
            'previous_state'  => $currentState,
            'final_state'     => self::STATE_LIVRE,
            'skipped'         => false,
            'message'         =>
                'Commande expédiée (état 4 → état 5). ' .
                'Stock décrémenté, stock_mvt créés, hooks PS déclenchés.',
        ];
    }

    /**
     * Annuler une commande.
     * L'annulation ne ré-incrémente PAS le stock automatiquement dans PS8
     * (dépend de la config de l'état "Annulé").
     * On appelle quand même changeIdOrderState pour déclencher les hooks.
     */
    public function cancelOrder(int $idOrder): array
    {
        $order = new Order($idOrder);

        if (!Validate::isLoadedObject($order)) {
            throw new RuntimeException("Commande #{$idOrder} introuvable.");
        }

        $currentState = (int)$order->current_state;

        if ($currentState === self::STATE_ANNULE) {
            return [
                'order_id'      => $idOrder,
                'current_state' => $currentState,
                'message'       => 'Commande déjà annulée.',
                'skipped'       => true,
            ];
        }

        $this->applyState($order, self::STATE_ANNULE);

        PrestaShopLogger::addLog(
            "[StockSync] Commande #{$idOrder} annulée (état {$currentState} → 6).",
            1, null, 'Order', $idOrder
        );

        return [
            'order_id'       => $idOrder,
            'previous_state' => $currentState,
            'final_state'    => self::STATE_ANNULE,
            'skipped'        => false,
            'message'        => 'Commande annulée. Hooks PS déclenchés.',
        ];
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVATES
    // ─────────────────────────────────────────────────────────────

    /**
     * Applique un nouvel état à une commande via le workflow PS officiel.
     *
     * Équivalent PHP de :
     *   $history = new OrderHistory();
     *   $history->id_order = $order->id;
     *   $history->changeIdOrderState(4, $order); // déclenche TOUT
     *   $history->add();                          // persiste l'historique
     *
     * IMPORTANT : changeIdOrderState() prépare l'objet et déclenche les
     * effets de bord (stock, emails, hooks), mais ne persiste PAS
     * en base → add() est OBLIGATOIRE pour créer la ligne ps_order_history.
     */
    private function applyState(Order $order, int $newStateId): void
    {
        $history            = new OrderHistory();
        $history->id_order  = (int)$order->id;

        // Premier paramètre : id du nouvel état
        // Deuxième paramètre : objet Order passé par référence
        //   → PS met à jour order.current_state et déclenche tous les effets
        $history->changeIdOrderState($newStateId, $order);

        // Persiste la ligne d'historique dans ps_order_history
        $history->add();
    }
}
