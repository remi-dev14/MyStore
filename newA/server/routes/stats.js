import { Router } from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const PRESTA_URL = process.env.PRESTASHOP_API_URL;
const auth = { username: process.env.PRESTASHOP_API_KEY, password: '' };

async function prestaFull(resource) {
  const res = await axios.get(`${PRESTA_URL}/${resource}`, {
    auth,
    params: { display: 'full', output_format: 'XML' },
    responseType: 'text',
  });
  return parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
}

function asList(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Extract plain text from xml2js field (may be string or { _: '...', href: '...' })
function scalar(field, fallback = '') {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'object') return String(field._ ?? fallback);
  return String(field);
}

function getLang(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  const langs = asList(field.language);
  return langs[0]?._ ?? langs[0] ?? '';
}

// 1-minute server-side cache
let _cache = null;
let _cacheAt = 0;
const TTL = 60_000;

router.get('/overview', async (req, res) => {
  try {
    if (_cache && Date.now() - _cacheAt < TTL) return res.json(_cache);

    const [ordersData, productsData, categoriesData, stockData, taxesData, taxRulesData] = await Promise.all([
      prestaFull('orders'),
      prestaFull('products'),
      prestaFull('categories'),
      prestaFull('stock_availables'),
      prestaFull('taxes'),
      prestaFull('tax_rules'),
    ]);

    const orders     = asList(ordersData?.prestashop?.orders?.order);
    const products   = asList(productsData?.prestashop?.products?.product);
    const categories = asList(categoriesData?.prestashop?.categories?.category);
    const stockList  = asList(stockData?.prestashop?.stock_availables?.stock_available);

    // Build taxRuleGroupId → tax rate map
    const taxRateById = {};
    asList(taxesData?.prestashop?.taxes?.tax).forEach((t) => {
      taxRateById[scalar(t.id)] = parseFloat(scalar(t.rate, '0'));
    });
    const taxRuleGroupRate = {};
    asList(taxRulesData?.prestashop?.tax_rules?.tax_rule).forEach((r) => {
      const groupId = scalar(r.id_tax_rules_group);
      if (!taxRuleGroupRate[groupId]) {
        taxRuleGroupRate[groupId] = taxRateById[scalar(r.id_tax)] ?? 0;
      }
    });

    // --- Build product map ---
    const productMap = {};
    products.forEach((p) => {
      productMap[scalar(p.id)] = {
        name: getLang(p.name),
        wholesale_price: parseFloat(scalar(p.wholesale_price, '0')),
        id_category_default: scalar(p.id_category_default, '0'),
        id_tax_rules_group: scalar(p.id_tax_rules_group, '0'),
      };
    });

    // --- Build category map ---
    const catMap = {};
    categories.forEach((c) => { catMap[scalar(c.id)] = getLang(c.name); });

    // Resolve a product's display category (skip root 1/2, walk up if needed)
    function resolveCat(catId) {
      if (catId !== '1' && catId !== '2' && catMap[catId]) return catId;
      return catId; // fallback
    }

    // --- Aggregate orders ---
    // Paid states: 2, 4, 5, 11 → count for sales (paid, shipped, delivered)
    // Reserved states: 2, 3, 11 → stock committed but not yet shipped
    const PAID     = new Set(['2', '4', '5', '11']);
    const RESERVED = new Set(['2', '3', '11']);

    let totalSalesHT     = 0;
    let totalPurchasesHT = 0;
    const profitCatMap = {}; // catId → { qtySold, salesHT, purchasesHT }
    const reservedMap  = {}; // productId → qty

    for (const order of orders) {
      const state = scalar(order.current_state);
      const isPaid     = PAID.has(state);
      const isReserved = RESERVED.has(state);

      const rows = asList(order.associations?.order_rows?.order_row);

      for (const row of rows) {
        const pid    = scalar(row.product_id);
        const qty    = parseInt(scalar(row.product_quantity) || scalar(row.quantity) || '1', 10);
        const prod      = productMap[pid];
        const taxRate   = taxRuleGroupRate[prod?.id_tax_rules_group ?? '0'] ?? 0;
        const unitTTC   = parseFloat(scalar(row.unit_price_tax_incl) || '0');
        const unitExcl  = parseFloat(scalar(row.unit_price_tax_excl) || scalar(row.product_price) || '0');
        // Derive HT from TTC when possible (tolerates buggy imports that stored TTC in the excl field)
        let unitHT;
        if (unitTTC > 0 && taxRate > 0) {
          unitHT = unitTTC / (1 + taxRate / 100);
        } else if (unitTTC > 0 && taxRate === 0) {
          // 0% tax: TTC = HT
          unitHT = unitTTC;
        } else {
          unitHT = unitExcl;
        }
        const catId     = resolveCat(prod?.id_category_default ?? '0');
        const wholesale = prod?.wholesale_price ?? 0;

        if (isReserved) {
          reservedMap[pid] = (reservedMap[pid] ?? 0) + qty;
        }

        if (isPaid) {
          const lineHT       = unitHT * qty;
          const linePurchase = wholesale * qty;
          totalSalesHT     += lineHT;
          totalPurchasesHT += linePurchase;

          if (!profitCatMap[catId]) profitCatMap[catId] = { qtySold: 0, salesHT: 0, purchasesHT: 0 };
          profitCatMap[catId].qtySold     += qty;
          profitCatMap[catId].salesHT     += lineHT;
          profitCatMap[catId].purchasesHT += linePurchase;
        }
      }

      // Fallback: if order has no rows but is paid, add total_products to sales
      if (isPaid && rows.length === 0) {
        totalSalesHT += parseFloat(scalar(order.total_products, '0'));
      }
    }

    const profitByCategory = Object.entries(profitCatMap)
      .map(([catId, d]) => ({
        categoryId:   catId,
        categoryName: catMap[catId] ?? `Catégorie #${catId}`,
        qtySold:      d.qtySold,
        salesHT:      parseFloat(d.salesHT.toFixed(2)),
        purchasesHT:  parseFloat(d.purchasesHT.toFixed(2)),
        profit:       parseFloat((d.salesHT - d.purchasesHT).toFixed(2)),
      }))
      .sort((a, b) => b.profit - a.profit);

    // --- Stock by category ---
    // Aggregate physical stock per product from stock_availables
    const physicalByProduct = {};
    stockList.forEach((s) => {
      const pid = scalar(s.id_product);
      physicalByProduct[pid] = (physicalByProduct[pid] ?? 0) + parseInt(scalar(s.quantity, '0'), 10);
    });

    const stockCatMap = {};
    for (const [pid, physical] of Object.entries(physicalByProduct)) {
      const prod = productMap[pid];
      if (!prod) continue;
      const catId = resolveCat(prod.id_category_default);
      if (!stockCatMap[catId]) stockCatMap[catId] = { qtyPhysical: 0, qtyReserved: 0 };
      stockCatMap[catId].qtyPhysical += physical;
      stockCatMap[catId].qtyReserved += reservedMap[pid] ?? 0;
    }

    // stock_available.quantity = disponible (déjà décrémenté lors de "Paiement effectué")
    // physique = disponible + réservé (reconstruit)
    const stockByCategory = Object.entries(stockCatMap)
      .map(([catId, d]) => ({
        categoryId:   catId,
        categoryName: catMap[catId] ?? `Catégorie #${catId}`,
        qtyAvailable: Math.max(0, d.qtyPhysical),
        qtyReserved:  d.qtyReserved,
        qtyPhysical:  Math.max(0, d.qtyPhysical) + d.qtyReserved,
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    const result = {
      totalSalesHT:     parseFloat(totalSalesHT.toFixed(2)),
      totalPurchasesHT: parseFloat(totalPurchasesHT.toFixed(2)),
      totalProfit:      parseFloat((totalSalesHT - totalPurchasesHT).toFixed(2)),
      profitByCategory,
      stockByCategory,
    };

    _cache = result;
    _cacheAt = Date.now();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invalidate cache (call after import/reset)
router.delete('/cache', (_req, res) => {
  _cache = null;
  res.json({ cleared: true });
});

export default router;
