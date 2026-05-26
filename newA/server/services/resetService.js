import axios from 'axios';
import { PRESTA_URL, auth, prestaGet, ts, prestaErrorDetail } from './prestaClient.js';

async function listIds(resource) {
  try {
    const data = await prestaGet(resource, { output_format: 'XML' });
    const singular = resource.endsWith('ies')
      ? resource.slice(0, -3) + 'y'
      : resource.replace(/s$/, '');
    const items = data?.prestashop?.[resource]?.[singular];
    const list = items ? (Array.isArray(items) ? items : [items]) : [];
    return list.map((item) => String(item?.id ?? item)).filter((id) => id && id !== 'undefined');
  } catch { return []; }
}

async function deleteAll(resource, protectedIds, log, errors) {
  const ids = await listIds(resource);
  let deleted = 0;
  for (const id of ids) {
    if (protectedIds.has(id)) continue;
    try {
      await axios.delete(`${PRESTA_URL}/${resource}/${id}`, { auth });
      deleted++;
    } catch (e) { errors.push(`Delete ${resource}/${id}: ${prestaErrorDetail(e) || e.message}`); }
  }
  if (deleted > 0) log.push(`[${ts()}] ${resource} : ${deleted} supprimé(s)`);
}

export async function resetAll(log, errors) {
  const NONE      = new Set();
  const ROOT      = new Set(['1', '2']);

  await deleteAll('orders',              NONE, log, errors);
  await deleteAll('order_cart_rules',    NONE, log, errors);
  await deleteAll('carts',              NONE, log, errors);
  await deleteAll('cart_rules',          NONE, log, errors);
  await deleteAll('addresses',           NONE, log, errors);
  await deleteAll('customers',           NONE, log, errors);
  await deleteAll('combinations',        NONE, log, errors);
  await deleteAll('product_features',    NONE, log, errors);
  await deleteAll('product_feature_values', NONE, log, errors);
  await deleteAll('product_options',     NONE, log, errors);
  await deleteAll('product_option_values', NONE, log, errors);
  await deleteAll('products',            NONE, log, errors);
  await deleteAll('categories',          ROOT, log, errors);
  await deleteAll('tax_rules',           new Set(['1']), log, errors);
  await deleteAll('tax_rule_groups',     new Set(['1']), log, errors);
  await deleteAll('taxes',               new Set(['1']), log, errors);
  await deleteAll('manufacturers',       ROOT, log, errors);
  await deleteAll('suppliers',           ROOT, log, errors);
}
