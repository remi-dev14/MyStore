import axios from 'axios';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';
import { PRESTA_URL, PRESTA_KEY, PRESTA_BASE, auth, ts } from './prestaClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE       = join(__dirname, '../stock_history.json');
const STOCK_UPDATE_URL   = `${PRESTA_BASE}/stock_update.php`;
const STOCK_MOVEMENT_URL = `${PRESTA_URL}/stock_movement`;

function scalar(field, fallback = '') {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'object') return String(field._ ?? fallback);
  return String(field);
}

export function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')); } catch { return []; }
}

export function saveHistory(data) {
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function fetchCurrentQty(productId, attrId) {
  const r = await axios.get(`${PRESTA_URL}/stock_availables`, {
    auth,
    params: { display: 'full', 'filter[id_product]': productId, output_format: 'XML' },
    responseType: 'text',
  });
  const p = await parseStringPromise(r.data, { explicitArray: false, mergeAttrs: true });
  const raw = p?.prestashop?.stock_availables?.stock_available ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  const attrStr = String(attrId || '0');
  const sa = list.find((s) => scalar(s.id_product_attribute, '0') === attrStr)
          ?? list.find((s) => scalar(s.id_product_attribute, '0') === '0')
          ?? null;
  return sa ? parseInt(scalar(sa.quantity, '0'), 10) : null;
}

export async function applyStockDelta(productId, attrId, delta, orderId) {
  const currentQty = await fetchCurrentQty(productId, attrId);
  if (currentQty === null) throw new Error(`stock_available introuvable pour #${productId}`);
  const newQty = Math.max(0, currentQty + delta);
  const params = new URLSearchParams({
    key: PRESTA_KEY,
    id_product: String(parseInt(productId, 10)),
    id_product_attribute: String(parseInt(attrId || '0', 10)),
    quantity: String(newQty),
  });
  const resp = await axios.post(STOCK_UPDATE_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (resp.data?.success === false) throw new Error(resp.data?.error ?? 'stock_update.php : erreur inconnue');
  const history = loadHistory();
  history.push({
    date: new Date().toISOString().split('T')[0],
    productId: String(productId),
    id_product_attribute: String(attrId || '0'),
    delta, oldQty: currentQty, newQty,
    reason: `Commande #${orderId}`,
  });
  saveHistory(history);
}

export async function updateStock(productId, quantity, log, idProductAttribute = 0) {
  const pid = String(productId);
  const attrId = String(idProductAttribute);
  const attrLabel = idProductAttribute > 0 ? ` attr=${attrId}` : '';
  log.push(`[${ts()}] Stock : product id=${pid}${attrLabel}, qty cible=${quantity}`);
  const params = new URLSearchParams({
    key: PRESTA_KEY,
    id_product: pid,
    id_product_attribute: attrId,
    quantity: String(quantity),
  });
  const resp = await axios.post(STOCK_UPDATE_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (resp.data?.success === false) throw new Error(resp.data?.error ?? 'stock_update.php : erreur inconnue');
  log.push(`[${ts()}] Stock : mis à jour product id=${pid}${attrLabel} → ${quantity}`);
}

export async function insertStockMvt(productId, attrId, quantity, sign, idOrder = 0) {
  const resp = await axios.post(
    STOCK_MOVEMENT_URL,
    { id_product: parseInt(productId, 10), id_product_attribute: parseInt(attrId || '0', 10), quantity: Math.abs(quantity), sign, id_order: idOrder },
    { auth, headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
  );
  const raw = resp.data || '';
  if (raw.includes('<errors>')) {
    const m = raw.match(/<message[^>]*>([\s\S]*?)<\/message>/i);
    throw new Error(m ? m[1].replace(/<[^>]+>/g, '').trim() : 'Erreur stock_movement');
  }
}
