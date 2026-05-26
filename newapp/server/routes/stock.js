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

// Insert a stock_mvt record via mon_order_state module.
// Accepts a signed quantity; positive = entrée (sign=+1), negative = sortie (sign=-1).
async function insertStockMovement(productId, attrId, quantity, sign) {
  const finalSign = sign ?? (quantity >= 0 ? 1 : -1);
  const finalQty = Math.abs(parseInt(quantity, 10));
  const resp = await axios.post(
    STOCK_MOVEMENT_URL,
    {
      id_product: parseInt(productId, 10),
      id_product_attribute: parseInt(attrId || '0', 10),
      quantity: finalQty,
      sign: finalSign,
    },
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

async function getProductsByCategory(categoryId) {
  const res = await axios.get(`${PRESTA_URL}/products`, {
    auth,
    params: { display: 'full', 'filter[id_category_default]': categoryId, output_format: 'XML' },
    responseType: 'text',
  });
  const parsed = await parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
  const raw = parsed?.prestashop?.products?.product;
  return raw ? (Array.isArray(raw) ? raw : [raw]) : [];
}

async function getCategoryName(categoryId) {
  try {
    const res = await axios.get(`${PRESTA_URL}/categories/${categoryId}`, {
      auth, params: { output_format: 'XML' }, responseType: 'text',
    });
    const parsed = await parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
    const nameField = parsed?.prestashop?.category?.name;
    if (!nameField) return '';
    const langs = nameField.language;
    const arr = Array.isArray(langs) ? langs : [langs].filter(Boolean);
    const m = arr.find((l) => String(l.id) === '1') ?? arr[0];
    return m?._ ?? '';
  } catch { return ''; }
}

router.post('/remove-by-category', async (req, res) => {
  try {
    const { categoryId, quantity } = req.body;
    if (!categoryId || quantity === undefined) {
      return res.status(400).json({ error: 'categoryId et quantity requis' });
    }
    const n = Math.max(0, parseInt(quantity, 10) || 0);
    if (n <= 0) return res.status(400).json({ error: 'La quantité doit être positive' });

    const products = await getProductsByCategory(categoryId);
    if (!products.length) return res.status(404).json({ error: 'Aucun produit dans cette catégorie' });

    const categoryName = await getCategoryName(categoryId);
    const history = loadHistory();
    const details = [];
    let totalRemoved = 0;

    for (const p of products) {
      const pid = String(p.id);
      const productName = (() => {
        const f = p.name;
        if (!f) return `Produit #${pid}`;
        const langs = f.language;
        const arr = Array.isArray(langs) ? langs : [langs].filter(Boolean);
        const m = arr.find((l) => String(l.id) === '1') ?? arr[0];
        return m?._ ?? `Produit #${pid}`;
      })();

      const stockEntries = await getAllStockAvailables(pid);
      const combEntries = stockEntries.filter((s) => scalar(s.id_product_attribute, '0') !== '0');
      const entries = combEntries.length > 0 ? combEntries : stockEntries;

      let productRemoved = 0;
      let productOldTotal = 0;
      let productNewTotal = 0;

      for (const sa of entries) {
        const saAttr = scalar(sa.id_product_attribute, '0');
        const oldQty = parseInt(scalar(sa.quantity, '0'), 10);
        // On ne peut retirer que ce qui est disponible : jamais en dessous de 0,
        // donc removed est borné à [0, max(0, oldQty)] et newQty reste >= 0.
        const available = Math.max(0, oldQty);
        const removed = Math.min(n, available);
        const newQty = Math.max(0, oldQty - removed);
        productOldTotal += oldQty;
        productNewTotal += newQty;
        productRemoved += removed;

        if (removed > 0) {
          await setStock(pid, saAttr, newQty);
          try {
            await insertStockMovement(pid, saAttr, removed, -1);
          } catch (e) {
            console.error(`[stock/mvt remove] pid=${pid} attr=${saAttr}: ${e.message}`);
          }
          history.push({
            date: new Date().toISOString().split('T')[0],
            productId: pid,
            id_product_attribute: saAttr,
            delta: -removed,
            oldQty,
            newQty,
            reason: `Retrait catégorie ${categoryName || categoryId}`,
          });
        }
      }

      details.push({
        productId: pid,
        productName,
        oldQty: productOldTotal,
        newQty: productNewTotal,
        removed: productRemoved,
      });
      totalRemoved += productRemoved;
    }

    saveHistory(history);
    res.json({ success: true, action: 'remove', categoryId, categoryName, requested: n, totalApplied: totalRemoved, details });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response?.data ?? null });
  }
});

router.post('/add-by-category', async (req, res) => {
  try {
    const { categoryId, quantity, limit } = req.body;
    if (!categoryId || quantity === undefined) {
      return res.status(400).json({ error: 'categoryId et quantity requis' });
    }
    const n = parseInt(quantity, 10);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: 'La quantité doit être positive' });
    }
    // limit : null | '' | undefined → pas de limite. Sinon entier >= 0.
    const hasLimit = limit !== undefined && limit !== null && String(limit).trim() !== '';
    const maxLimit = hasLimit ? parseInt(limit, 10) : null;
    if (hasLimit && (!Number.isFinite(maxLimit) || maxLimit < 0)) {
      return res.status(400).json({ error: 'La limite doit être un entier positif ou vide' });
    }

    const products = await getProductsByCategory(categoryId);
    if (!products.length) return res.status(404).json({ error: 'Aucun produit dans cette catégorie' });

    const categoryName = await getCategoryName(categoryId);
    const history = loadHistory();
    const details = [];
    let totalAdded = 0;

    for (const p of products) {
      const pid = String(p.id);
      const productName = (() => {
        const f = p.name;
        if (!f) return `Produit #${pid}`;
        const langs = f.language;
        const arr = Array.isArray(langs) ? langs : [langs].filter(Boolean);
        const m = arr.find((l) => String(l.id) === '1') ?? arr[0];
        return m?._ ?? `Produit #${pid}`;
      })();

      const stockEntries = await getAllStockAvailables(pid);
      const combEntries = stockEntries.filter((s) => scalar(s.id_product_attribute, '0') !== '0');
      const entries = combEntries.length > 0 ? combEntries : stockEntries;

      let productAdded = 0;
      let productOldTotal = 0;
      let productNewTotal = 0;

      for (const sa of entries) {
        const saAttr = scalar(sa.id_product_attribute, '0');
        const oldQty = parseInt(scalar(sa.quantity, '0'), 10);
        // Limite n : on ne peut pas dépasser n. Si oldQty >= maxLimit, on n'ajoute rien.
        // Sinon, on ajoute min(quantity, maxLimit - oldQty).
        let added;
        if (maxLimit === null) {
          added = n;
        } else if (oldQty >= maxLimit) {
          added = 0;
        } else {
          added = Math.min(n, maxLimit - oldQty);
        }
        added = Math.max(0, added);
        const newQty = oldQty + added;
        productOldTotal += oldQty;
        productNewTotal += newQty;
        productAdded += added;

        if (added > 0) {
          await setStock(pid, saAttr, newQty);
          try {
            await insertStockMovement(pid, saAttr, added, 1);
          } catch (e) {
            console.error(`[stock/mvt add-cat] pid=${pid} attr=${saAttr}: ${e.message}`);
          }
          history.push({
            date: new Date().toISOString().split('T')[0],
            productId: pid,
            id_product_attribute: saAttr,
            delta: added,
            oldQty,
            newQty,
            reason: `Ajout catégorie ${categoryName || categoryId}${maxLimit !== null ? ` (limite ${maxLimit})` : ''}`,
          });
        }
      }

      details.push({
        productId: pid,
        productName,
        oldQty: productOldTotal,
        newQty: productNewTotal,
        added: productAdded,
      });
      totalAdded += productAdded;
    }

    saveHistory(history);
    res.json({
      success: true,
      action: 'add',
      categoryId,
      categoryName,
      requested: n,
      limit: maxLimit,
      totalApplied: totalAdded,
      details,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response?.data ?? null });
  }
});

export default router;
