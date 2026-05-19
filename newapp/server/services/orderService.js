import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { PRESTA_URL, auth, prestaPost, getId, ts, prestaErrorDetail } from './prestaClient.js';
import { insertStockMvt } from './stockService.js';
import { buildCartXml, buildOrderXml } from '../../src/utils/xmlBuilder.js';
import { parseDecimal, parsePercent, parseAchat } from '../../src/utils/csvParser.js';
import { frDateToIso } from '../../src/utils/dateUtils.js';

const MODULE_URL = `${PRESTA_URL}/order_state_update`;

export const PS_STATE_PAID      = 11;
export const PS_STATE_CANCELLED = 6;
export const PS_STATE_DELIVERED = 5;
export const RESERVED_STATES    = new Set(['2', '3', '11']);
export const DELIVERED_STATES   = new Set(['4', '5']);

export function normalizeEtat(str) {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function scalar(field, fallback = '') {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'object') return String(field._ ?? fallback);
  return String(field);
}

function asList(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export async function changeOrderState(orderId, stateId) {
  const resp = await axios.post(
    MODULE_URL,
    { id_order: parseInt(orderId, 10), id_order_state: parseInt(stateId, 10) },
    { auth, headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
  );
  const raw = resp.data || '';
  if (raw.includes('<errors>')) {
    const m = raw.match(/<message[^>]*>([\s\S]*?)<\/message>/i);
    throw new Error(m ? m[1].replace(/<[^>]+>/g, '').trim() : 'Erreur module order_state_update');
  }
  return raw;
}

export async function fetchOrderData(orderId) {
  const r = await axios.get(`${PRESTA_URL}/orders/${orderId}`, {
    auth, params: { display: 'full' }, responseType: 'text',
  });
  const p = await parseStringPromise(r.data, { explicitArray: false, mergeAttrs: true });
  const order = p?.prestashop?.order;
  if (!order) throw new Error(`Commande #${orderId} introuvable`);
  const rows = asList(order.associations?.order_rows?.order_row)
    .map((row) => ({
      pid:    scalar(row.product_id),
      attrId: scalar(row.product_attribute_id, '0') || '0',
      qty:    parseInt(scalar(row.product_quantity) || scalar(row.quantity) || '1', 10),
    }))
    .filter((r) => r.pid && r.pid !== '0' && !isNaN(r.qty) && r.qty > 0);
  return { currentState: scalar(order.current_state, '0'), rows };
}

// STEP 4: Carts + Orders
export async function importOrders(f3Rows, productMap, comboMap, customerMap, f1Rows, f2Rows, log, errors, report) {
  for (const row of f3Rows) {
    const etatNorm   = normalizeEtat(row.etat);
    const isPaid      = etatNorm === 'paiement accepte' || etatNorm === 'payment effectuer';
    const isCancelled = etatNorm === 'annuler' || etatNorm === 'annule';
    const isDelivered = etatNorm === 'livre';
    const needsOrder  = isPaid || isCancelled || isDelivered;
    const currentState = isCancelled ? PS_STATE_CANCELLED : isDelivered ? PS_STATE_DELIVERED : PS_STATE_PAID;

    try {
      const cust = customerMap[row.email];
      if (!cust) {
        if (row.achat) errors.push(`[${ts()}] ${needsOrder ? 'Commande' : 'Panier'} ignoré : client ${row.email} non disponible`);
        continue;
      }
      const items = parseAchat(row.achat);
      if (!items.length) { log.push(`[${ts()}] Pas d'achats pour : ${row.email}`); continue; }

      const missingRefs = items.filter((item) => !productMap[item.reference]);
      if (missingRefs.length) {
        errors.push(`[${ts()}] ERREUR ${needsOrder ? 'Commande' : 'Panier'} ${row.email}: produits manquants — ${missingRefs.map((i) => i.reference).join(', ')}`);
        if (needsOrder) report.commandes.failed++; else report.paniers.failed++;
        continue;
      }

      let totalTTC = 0;
      const cartRows = [];
      const orderRows = [];
      for (const item of items) {
        const itemVariant = (item.variant || '').trim();
        const comboKey    = `${item.reference}::${itemVariant}`;
        const f2row       = f2Rows.find((r) => r.reference === item.reference && (r.karazany || '').trim() === itemVariant);
        const f1row       = f1Rows.find((r) => r.reference === item.reference);
        const unitPriceTTC = f2row?.prix_vente_ttc ? parseDecimal(f2row.prix_vente_ttc) : f1row ? parseDecimal(f1row.prix_ttc) : 0;
        const taxPercent   = f1row ? parsePercent(f1row.taxe) : 20;
        const unitPriceHT  = taxPercent > 0 ? unitPriceTTC / (1 + taxPercent / 100) : unitPriceTTC;
        totalTTC += unitPriceTTC * item.quantity;
        const attrId = comboMap[comboKey] ?? 0;
        const pid    = productMap[item.reference];
        cartRows.push({ product_id: pid, product_attribute_id: attrId, quantity: item.quantity, id_shop: 1 });
        if (needsOrder) {
          orderRows.push({
            product_id: pid, product_attribute_id: attrId, quantity: item.quantity,
            product_name: f1row?.nom || item.reference, product_reference: item.reference,
            product_price: unitPriceHT.toFixed(6),
            unit_price_tax_incl: unitPriceTTC.toFixed(6),
            unit_price_tax_excl: unitPriceHT.toFixed(6),
          });
        }
      }

      const cartCreated = await prestaPost('carts', buildCartXml({
        id_customer: cust.id, id_address_delivery: cust.addressId,
        id_address_invoice: cust.addressId, cartRows,
      }));
      const cartId = getId(cartCreated, 'cart');
      if (!cartId) throw new Error('Aucun cart id retourné par PrestaShop');

      const orderDate = frDateToIso(row.date) || new Date().toISOString().split('T')[0];
      const etatLabel = (row.etat || '').trim();

      if (!needsOrder) {
        report.paniers.created++;
        log.push(`[${ts()}] Panier créé : ${row.email} (cart id=${cartId}, ${cartRows.length} article(s), total=${totalTTC.toFixed(2)}€${etatLabel ? ', état=' + etatLabel : ''})`);
        continue;
      }

      const totalHT    = orderRows.reduce((s, r) => s + parseFloat(r.product_price) * r.quantity, 0);
      const paymentLabel = isCancelled ? 'Annulé' : isDelivered ? 'Livré' : 'Paiement à distance';
      const orderCreated = await prestaPost('orders', buildOrderXml({
        id_customer: cust.id, id_cart: cartId,
        id_address_delivery: cust.addressId, id_address_invoice: cust.addressId,
        orderRows, current_state: currentState, payment: paymentLabel,
        module: 'ps_cashondelivery',
        total_paid: totalTTC.toFixed(6), total_paid_real: totalTTC.toFixed(6),
        total_paid_tax_incl: totalTTC.toFixed(6), total_paid_tax_excl: totalHT.toFixed(6),
        total_products: totalHT.toFixed(6), total_products_wt: totalTTC.toFixed(6),
      }));
      const orderId = getId(orderCreated, 'order');
      if (!orderId) throw new Error('Aucun order id retourné par PrestaShop');

      try {
        await prestaPost('order_histories', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><order_history>
  <id_employee>0</id_employee>
  <id_order_state>${currentState}</id_order_state>
  <id_order>${orderId}</id_order>
</order_history></prestashop>`);
      } catch { /* non-bloquant */ }

      if (isDelivered) {
        for (const or of orderRows) {
          try { await insertStockMvt(or.product_id, or.product_attribute_id, or.quantity, -1, orderId); }
          catch (e) { log.push(`[${ts()}] [mvt-stock] sortie ignorée pid=${or.product_id}: ${e.message}`); }
        }
      }

      report.commandes.created++;
      log.push(`[${ts()}] Commande créée : ${row.email} (order id=${orderId}, cart id=${cartId}, ${orderRows.length} article(s), total=${totalTTC.toFixed(2)}€, date=${orderDate}, état=${etatLabel})`);
    } catch (e) {
      if (needsOrder) report.commandes.failed++; else report.paniers.failed++;
      const detail = prestaErrorDetail(e);
      errors.push(`[${ts()}] ERREUR ${needsOrder ? 'Commande' : 'Panier'} ${row.email}: ${e.message}${detail ? ' — PS: ' + detail : ''}`);
    }
  }
}
