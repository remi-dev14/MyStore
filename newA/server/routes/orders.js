import { Router } from 'express';
import { changeOrderState, fetchOrderData, duplicateOrder, RESERVED_STATES, DELIVERED_STATES } from '../services/orderService.js';
import { applyStockDelta } from '../services/stockService.js';

const router = Router();

router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 1, 1), 20);
    const created = await duplicateOrder(id, count);
    res.json({ success: true, created, count: created.length });
  } catch (err) {
    console.error('[orders/duplicate]', err.message, err.response?.data ?? '');
    res.status(500).json({ error: err.message, detail: err.response?.data ?? null });
  }
});

router.put('/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const { current_state } = req.body;
    if (!current_state) return res.status(400).json({ error: 'current_state requis' });
    const newState = String(current_state);

    // Paiement effectué (2 ou 11) → réserver le stock si pas déjà réservé
    if (newState === '2' || newState === '11') {
      const { currentState, rows } = await fetchOrderData(id);
      await changeOrderState(id, newState);
      if (!RESERVED_STATES.has(currentState) && !DELIVERED_STATES.has(currentState)) {
        const stock_errors = [];
        for (const row of rows) {
          try { await applyStockDelta(row.pid, row.attrId, -row.qty, id); }
          catch (e) {
            console.error(`[orders/reserve] Produit #${row.pid}: ${e.message}`);
            stock_errors.push({ pid: row.pid, error: e.message });
          }
        }
        return res.json({ success: true, action: 'reserved', stock_errors });
      }
      return res.json({ success: true, action: 'no_reservation_needed' });
    }

    // Livré (5) → PS insère stock_mvt via changeIdOrderState, stock_available non modifié
    if (newState === '5') {
      await changeOrderState(id, newState);
      return res.json({ success: true, action: 'delivered' });
    }

    // Annulé (6) → PS réintègre le stock automatiquement
    if (newState === '6') {
      const { currentState } = await fetchOrderData(id);
      await changeOrderState(id, newState);
      const wasReserved  = RESERVED_STATES.has(currentState);
      const wasDelivered = DELIVERED_STATES.has(currentState);
      const action = wasDelivered ? 'physical_return' : wasReserved ? 'reservation_released' : 'cancelled';
      return res.json({ success: true, action });
    }

    // Autres états (3 En préparation, etc.)
    await changeOrderState(id, newState);
    res.json({ success: true });
  } catch (err) {
    console.error('[orders]', err.message, err.response?.data ?? '');
    res.status(500).json({ error: err.message, detail: err.response?.data ?? null });
  }
});

export default router;
