import { Router } from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = join(__dirname, '../stock_history.json');

const PRESTA_URL  = process.env.PRESTASHOP_API_URL;
const PRESTA_KEY  = process.env.PRESTASHOP_API_KEY;
const PRESTA_BASE = PRESTA_URL.replace(/\/api\/?$/, '');
const auth        = { username: PRESTA_KEY, password: '' };

const STOCK_UPDATE_URL   = `${PRESTA_BASE}/stock_update.php`;
const STOCK_MOVEMENT_URL = `${PRESTA_URL}/stock_movement`;

// PS webservice returns objects like {_: '144', 'xlink:href': '...'} for linked fields
function scalar(field, fallback = '') {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'object') return String(field._ ?? fallback);
  return String(field);
}

function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')); } catch { return []; }
}

function saveHistory(data) {
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function getAllStockAvailables(productId) {
  const res = await axios.get(`${PRESTA_URL}/stock_availables`, {
    auth,
    params: { display: 'full', 'filter[id_product]': productId, output_format: 'XML' },
    responseType: 'text',
  });
  const parsed = await parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
  const stocks = parsed?.prestashop?.stock_availables?.stock_available;
  return stocks ? (Array.isArray(stocks) ? stocks : [stocks]) : [];
}

async function setStock(productId, attrId, quantity) {
  const params = new URLSearchParams({
    key:                  PRESTA_KEY,
    id_product:           String(parseInt(productId, 10)),
    id_product_attribute: String(parseInt(attrId || '0', 10)),
    quantity:             String(Math.max(0, quantity)),
  });
  const resp = await axios.post(STOCK_UPDATE_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (resp.data?.success === false) {
    throw new Error(resp.data?.error ?? 'stock_update.php : erreur inconnue');
  }
  return resp.data;
}

// Insert a stock_mvt record (sign=+1) via mon_order_state module
async function insertStockMovement(productId, attrId, quantity) {
  const resp = await axios.post(
    STOCK_MOVEMENT_URL,
    { id_product: parseInt(productId, 10), id_product_attribute: parseInt(attrId || '0', 10), quantity },
    { auth, headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
  );
  const raw = resp.data || '';
  if (raw.includes('<errors>')) {
    const m = raw.match(/<message[^>]*>([\s\S]*?)<\/message>/i);
    throw new Error(m ? m[1].replace(/<[^>]+>/g, '').trim() : 'Erreur stock_movement');
  }
  return raw;
}

router.post('/add', async (req, res) => {
  try {
    const { productId, delta, productAttributeId, applyToAll } = req.body;
    if (!productId || delta === undefined) return res.status(400).json({ error: 'productId and delta required' });

    const intDelta = parseInt(delta, 10);

    if (applyToAll) {
      const list = await getAllStockAvailables(productId);
      if (!list.length) return res.status(404).json({ error: 'No stock entries found for this product' });

      const history = loadHistory();
      const updatedEntries = [];

      for (const sa of list) {
        const saAttr = scalar(sa.id_product_attribute, '0');
        const oldQty = parseInt(scalar(sa.quantity, '0'), 10);
        const newQty = Math.max(0, oldQty + intDelta);
        await setStock(productId, saAttr, newQty);

        try {
          await insertStockMovement(productId, saAttr, intDelta);
        } catch (e) {
          console.error(`[stock/mvt] pid=${productId} attr=${saAttr}: ${e.message}`);
        }

        history.push({
          date: new Date().toISOString().split('T')[0],
          productId: String(productId),
          id_product_attribute: saAttr,
          delta: intDelta,
          oldQty,
          newQty,
        });
        updatedEntries.push({ attrId: saAttr, oldQty, newQty });
      }

      saveHistory(history);
      return res.json({ success: true, updated: updatedEntries });
    }

    const attrId = String(productAttributeId || '0');
    const list = await getAllStockAvailables(productId);
    const sa = list.find((s) => scalar(s.id_product_attribute, '0') === attrId)
            ?? (attrId === '0' ? list[0] ?? null : null);

    const oldQty = sa ? parseInt(scalar(sa.quantity, '0'), 10) : 0;
    const newQty = Math.max(0, oldQty + intDelta);

    await setStock(productId, attrId, newQty);

    try {
      await insertStockMovement(productId, attrId, intDelta);
    } catch (e) {
      console.error(`[stock/mvt] pid=${productId} attr=${attrId}: ${e.message}`);
    }

    const history = loadHistory();
    history.push({
      date: new Date().toISOString().split('T')[0],
      productId: String(productId),
      id_product_attribute: attrId,
      delta: intDelta,
      oldQty,
      newQty,
    });
    saveHistory(history);

    res.json({ success: true, oldQty, newQty });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response?.data ?? null });
  }
});

router.get('/history/:productId', (req, res) => {
  const history = loadHistory();
  const filtered = history.filter((h) => String(h.productId) === String(req.params.productId));
  res.json(filtered);
});

export default router;
