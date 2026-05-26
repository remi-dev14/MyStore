import { prestaGet, prestaPost, getId, getLang, ts, prestaErrorDetail } from './prestaClient.js';
import { updateStock } from './stockService.js';
import { buildProductXml, buildCategoryXml } from '../../src/utils/xmlBuilder.js';
import { parseDecimal, parsePercent } from '../../src/utils/csvParser.js';
import { frDateToIso } from '../../src/utils/dateUtils.js';

let _cachedCountryId = null;

async function getDefaultCountryId() {
  if (_cachedCountryId) return _cachedCountryId;
  try {
    const res = await prestaGet('configurations', {
      display: 'full', 'filter[name]': '[PS_COUNTRY_DEFAULT]', output_format: 'XML',
    });
    const confs = res?.prestashop?.configurations?.configuration;
    const list = confs ? (Array.isArray(confs) ? confs : [confs]) : [];
    const conf = list.find((c) => c.name === 'PS_COUNTRY_DEFAULT');
    _cachedCountryId = String(conf?.value ?? '8');
  } catch { _cachedCountryId = '8'; }
  return _cachedCountryId;
}

export async function findProductByReference(reference) {
  try {
    const res = await prestaGet('products', {
      display: 'full', 'filter[reference]': `[${reference}]`, output_format: 'XML',
    });
    const products = res?.prestashop?.products?.product;
    if (!products) return null;
    const list = Array.isArray(products) ? products : [products];
    return list[0]?.id ?? null;
  } catch { return null; }
}

async function ensureCategory(name, log, report) {
  const catXml = await prestaGet('categories', { display: 'full', output_format: 'XML' });
  const cats = catXml?.prestashop?.categories?.category;
  const list = cats ? (Array.isArray(cats) ? cats : [cats]) : [];
  const found = list.find((c) => getLang(c.name, '1')?.toLowerCase() === name.toLowerCase());
  if (found) {
    log.push(`[${ts()}] Catégorie existante utilisée : "${name}" (id=${found.id})`);
    report.categories.existing++;
    return found.id;
  }
  const created = await prestaPost('categories', buildCategoryXml({ name }));
  const id = getId(created, 'category');
  log.push(`[${ts()}] Catégorie créée : "${name}" (id=${id})`);
  report.categories.created++;
  return id;
}

async function findOrCreateTaxRuleGroup(taxPercent, cache, log) {
  const rateKey = parseFloat(taxPercent.toFixed(3));
  const cacheKey = String(rateKey);
  if (cache[cacheKey]) return cache[cacheKey];
  try {
    const countryId = await getDefaultCountryId();
    const taxRes = await prestaGet('taxes', { display: 'full', output_format: 'XML' });
    const taxList = (() => { const r = taxRes?.prestashop?.taxes?.tax; return r ? (Array.isArray(r) ? r : [r]) : []; })();
    const taxRateMap = {};
    for (const t of taxList) taxRateMap[String(t.id)] = parseFloat(t.rate);

    const ruleRes = await prestaGet('tax_rules', { display: 'full', output_format: 'XML' });
    const ruleList = (() => { const r = ruleRes?.prestashop?.tax_rules?.tax_rule; return r ? (Array.isArray(r) ? r : [r]) : []; })();
    const matchRule = ruleList.find((r) => {
      const rate = taxRateMap[String(r.id_tax)];
      if (rate === undefined || Math.abs(rate - rateKey) >= 0.01) return false;
      const c = String(r.id_country);
      return c === '0' || c === countryId;
    });
    if (matchRule) {
      const groupId = String(matchRule.id_tax_rules_group);
      cache[cacheKey] = groupId;
      log.push(`[${ts()}] Taxe ${rateKey}% : groupe id=${groupId} (règle existante, pays=${matchRule.id_country})`);
      return groupId;
    }

    const matchTax = taxList.find((t) => Math.abs(parseFloat(t.rate) - rateKey) < 0.01);
    let taxId = matchTax ? String(matchTax.id) : null;
    if (!taxId) {
      const taxName = `TVA ${rateKey}%`;
      const taxCreated = await prestaPost('taxes', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><tax>
  <rate>${rateKey.toFixed(3)}</rate><active>1</active>
  <name><language id="1"><![CDATA[${taxName}]]></language><language id="2"><![CDATA[${taxName}]]></language></name>
</tax></prestashop>`);
      taxId = String(getId(taxCreated, 'tax'));
      log.push(`[${ts()}] Taxe ${rateKey}% : enregistrement créé (id=${taxId})`);
    } else {
      log.push(`[${ts()}] Taxe ${rateKey}% : enregistrement existant réutilisé (id=${taxId})`);
    }

    const groupName = `TVA ${rateKey}%`;
    const groupCreated = await prestaPost('tax_rule_groups', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><tax_rule_group>
  <name><![CDATA[${groupName}]]></name><active>1</active>
</tax_rule_group></prestashop>`);
    const newGroupId = String(getId(groupCreated, 'tax_rule_group'));

    await prestaPost('tax_rules', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><tax_rule>
  <id_tax_rules_group>${newGroupId}</id_tax_rules_group>
  <id_country>${countryId}</id_country><id_state>0</id_state>
  <id_tax>${taxId}</id_tax><behavior>0</behavior>
  <description><![CDATA[]]></description>
  <zipcode_from></zipcode_from><zipcode_to></zipcode_to>
</tax_rule></prestashop>`);

    cache[cacheKey] = newGroupId;
    log.push(`[${ts()}] Taxe ${rateKey}% : groupe créé (id=${newGroupId}), règle pays=${countryId}, tax id=${taxId})`);
    return newGroupId;
  } catch (e) {
    throw new Error(`Règle taxe ${rateKey}%: ${e.message} — vérifier les permissions webservice (taxes, tax_rule_groups, tax_rules)`, { cause: e });
  }
}

async function findOrCreateCombination(pid, ref, variant, groupByKey, key, f1Rows, f2Rows, optionGroupCache, optionValueCache, log) {
  const GROUP = groupByKey[key] || 'Déclinaison';
  const gKey = GROUP.toLowerCase();

  // Attribute group
  if (!optionGroupCache[gKey]) {
    const gRes = await prestaGet('product_options', { display: 'full', output_format: 'XML' });
    const opts = gRes?.prestashop?.product_options?.product_option;
    const optList = opts ? (Array.isArray(opts) ? opts : [opts]) : [];
    const found = optList.find((o) => getLang(o.name, '1').toLowerCase() === gKey);
    if (found) {
      optionGroupCache[gKey] = found.id;
      log.push(`[${ts()}] Groupe attribut existant : "${GROUP}" (id=${found.id})`);
    } else {
      const gCreated = await prestaPost('product_options', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><product_option>
  <is_color_group>0</is_color_group><group_type>select</group_type>
  <name><language id="1"><![CDATA[${GROUP}]]></language><language id="2"><![CDATA[${GROUP}]]></language></name>
  <public_name><language id="1"><![CDATA[${GROUP}]]></language><language id="2"><![CDATA[${GROUP}]]></language></public_name>
</product_option></prestashop>`);
      optionGroupCache[gKey] = getId(gCreated, 'product_option');
      log.push(`[${ts()}] Groupe attribut créé : "${GROUP}" (id=${optionGroupCache[gKey]})`);
    }
  }
  const groupId = optionGroupCache[gKey];

  // Attribute value
  const vKey = `${groupId}::${variant.toLowerCase()}`;
  if (!optionValueCache[vKey]) {
    const vRes = await prestaGet('product_option_values', {
      display: 'full', 'filter[id_attribute_group]': `[${groupId}]`, output_format: 'XML',
    });
    const vals = vRes?.prestashop?.product_option_values?.product_option_value;
    const valList = vals ? (Array.isArray(vals) ? vals : [vals]) : [];
    const foundVal = valList.find((v) => getLang(v.name, '1').toLowerCase() === variant.toLowerCase());
    if (foundVal) {
      optionValueCache[vKey] = foundVal.id;
      log.push(`[${ts()}] Valeur attribut existante : "${variant}" (id=${foundVal.id})`);
    } else {
      const vCreated = await prestaPost('product_option_values', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><product_option_value>
  <id_attribute_group>${groupId}</id_attribute_group><color></color>
  <name><language id="1"><![CDATA[${variant}]]></language><language id="2"><![CDATA[${variant}]]></language></name>
</product_option_value></prestashop>`);
      optionValueCache[vKey] = getId(vCreated, 'product_option_value');
      log.push(`[${ts()}] Valeur attribut créée : "${variant}" (id=${optionValueCache[vKey]})`);
    }
  }
  const optionValueId = optionValueCache[vKey];

  // Combination
  const cRes = await prestaGet('combinations', {
    display: 'full', 'filter[id_product]': `[${pid}]`, output_format: 'XML',
  });
  const combos = cRes?.prestashop?.combinations?.combination;
  const comboList = combos ? (Array.isArray(combos) ? combos : [combos]) : [];
  const foundCombo = comboList.find((c) => {
    const ov = c.associations?.product_option_values?.product_option_value;
    const ovList = ov ? (Array.isArray(ov) ? ov : [ov]) : [];
    return ovList.some((v) => String(v.id) === String(optionValueId));
  });

  // Price offset
  const f1row = f1Rows.find((r) => r.reference === ref);
  const f2row = f2Rows.find((r) => r.reference === ref && (r.karazany || '').trim() === variant);
  let priceOffset = 0;
  if (f2row?.prix_vente_ttc && f1row) {
    const taxPct = parsePercent(f1row.taxe);
    const baseHT = parseDecimal(f1row.prix_ttc) / (taxPct > 0 ? 1 + taxPct / 100 : 1);
    const variantHT = parseDecimal(f2row.prix_vente_ttc) / (taxPct > 0 ? 1 + taxPct / 100 : 1);
    priceOffset = variantHT - baseHT;
  }

  if (foundCombo) {
    const attrId = parseInt(foundCombo.id, 10) || 0;
    log.push(`[${ts()}] Déclinaison existante : "${variant}" product id=${pid} (attr id=${attrId})`);
    return attrId;
  }

  const cCreated = await prestaPost('combinations', `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><combination>
  <id_product>${pid}</id_product><minimal_quantity>1</minimal_quantity>
  <reference><![CDATA[${ref}-${variant}]]></reference>
  <price>${priceOffset.toFixed(6)}</price><weight>0</weight>
  <associations><product_option_values>
    <product_option_value><id>${optionValueId}</id></product_option_value>
  </product_option_values></associations>
</combination></prestashop>`);
  const attrId = parseInt(getId(cCreated, 'combination'), 10) || 0;
  log.push(`[${ts()}] Déclinaison créée : "${variant}" product id=${pid} (attr id=${attrId})`);
  return attrId;
}

// STEP 1 + STEP 2: products + stock + combinations
export async function importProducts(f1Rows, f2Rows, log, errors, report) {
  const productMap = {};
  const taxGroupCache = {};

  for (const row of f1Rows) {
    const ref = (row.reference || '').trim();
    if (!ref) { errors.push(`[${ts()}] Produit sans référence ignoré : ${row.nom}`); continue; }
    try {
      const existingId = await findProductByReference(ref);
      if (existingId) {
        productMap[ref] = existingId;
        report.products.existing++;
        log.push(`[${ts()}] Produit existant utilisé : ${row.nom} (ref=${ref}, id=${existingId})`);
        continue;
      }
      const taxPercent = parsePercent(row.taxe || row.tva || row.taux_tva || row.tax || '');
      const priceTTC = parseDecimal(row.prix_ttc);
      if (priceTTC <= 0) throw new Error(`prix_ttc invalide : "${row.prix_ttc}"`);
      const priceHT = taxPercent > 0 ? priceTTC / (1 + taxPercent / 100) : priceTTC;
      const wholesalePrice = parseDecimal(row.prix_achat);
      const categoryId = await ensureCategory(row.categorie || 'Produits', log, report);
      const taxRuleGroupId = await findOrCreateTaxRuleGroup(taxPercent, taxGroupCache, log);
      const availableDate = frDateToIso(row.date_availability_produit);
      const xml = buildProductXml({
        name: row.nom, reference: ref,
        price: priceHT.toFixed(6), wholesale_price: wholesalePrice.toFixed(6),
        id_tax_rules_group: taxRuleGroupId, id_category_default: categoryId,
        available_date: availableDate,
      });
      const created = await prestaPost('products', xml);
      const pid = getId(created, 'product');
      if (!pid) throw new Error('Aucun id produit retourné par PrestaShop');
      productMap[ref] = pid;
      report.products.created++;
      log.push(`[${ts()}] Produit créé : ${row.nom} (ref=${ref}, id=${pid}, TTC=${priceTTC.toFixed(2)}, HT=${priceHT.toFixed(4)}, taxe=${taxPercent}%, groupe taxe id=${taxRuleGroupId})`);
    } catch (e) {
      report.products.failed++;
      const detail = prestaErrorDetail(e);
      errors.push(`[${ts()}] ERREUR Produit "${row.nom}" ref=${ref}: ${e.message}${detail ? ' — PS: ' + detail : ''}`);
    }
  }

  // STEP 2: Stock + combinations
  const stockByKey = {};
  const groupByKey = {};
  for (const row of f2Rows) {
    const ref = (row.reference || '').trim();
    const variant = (row.karazany || '').trim();
    const qty = parseInt(parseDecimal(row.stock_initial), 10) || 0;
    const key = `${ref}::${variant}`;
    stockByKey[key] = (stockByKey[key] ?? 0) + qty;
    if (variant && !groupByKey[key]) {
      const grpEntry = Object.entries(row).find(([k]) => k.startsWith('specif'));
      const grpRaw = (grpEntry?.[1] || '').trim();
      groupByKey[key] = grpRaw ? grpRaw.charAt(0).toUpperCase() + grpRaw.slice(1) : 'Déclinaison';
    }
  }

  const optionGroupCache = {};
  const optionValueCache = {};
  const comboMap = {};

  for (const [key, qty] of Object.entries(stockByKey)) {
    const [ref, variant] = key.split('::');
    try {
      const pid = productMap[ref];
      if (!pid) { errors.push(`[${ts()}] ERREUR Stock : ref="${ref}" inconnue (produit non importé)`); continue; }
      let attrId = 0;
      if (variant) {
        attrId = await findOrCreateCombination(pid, ref, variant, groupByKey, key, f1Rows, f2Rows, optionGroupCache, optionValueCache, log);
        comboMap[key] = attrId;
      }
      await updateStock(pid, qty, log, attrId);
    } catch (e) {
      errors.push(`[${ts()}] ERREUR Stock ref=${ref}${variant ? ' déclinaison=' + variant : ''}: ${e.message}`);
    }
  }

  return { productMap, comboMap };
}
