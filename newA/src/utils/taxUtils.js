import { prestaGet } from '../config/api.js';
import { parsePrestaXml, extractList } from './xmlParser.js';

let _cache = null;

// Returns a map: tax_rule_group_id (string) → tax rate (number, e.g. 20)
export async function loadTaxRateMap() {
  if (_cache) return _cache;

  const [taxXml, ruleXml] = await Promise.all([
    prestaGet('taxes', { display: 'full', output_format: 'XML' }),
    prestaGet('tax_rules', { display: 'full', output_format: 'XML' }),
  ]);

  const taxList = extractList(parsePrestaXml(taxXml), 'taxes');
  const taxMap = {}; // id → rate
  taxList.forEach((t) => { taxMap[String(t.id)] = parseFloat(t.rate) || 0; });

  const ruleList = extractList(parsePrestaXml(ruleXml), 'tax_rules');
  const groupMap = {}; // group_id → rate
  ruleList.forEach((r) => {
    const gid = String(r.id_tax_rules_group);
    if (!groupMap[gid]) groupMap[gid] = taxMap[String(r.id_tax)] ?? 0;
  });

  _cache = groupMap;
  return groupMap;
}

export function applyTax(priceHT, taxRuleGroupId, taxRateMap) {
  const rate = taxRateMap?.[String(taxRuleGroupId)] ?? 0;
  return priceHT * (1 + rate / 100);
}
