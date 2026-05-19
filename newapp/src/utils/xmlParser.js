// Browser-native XML parser — no Node.js dependency

export function parsePrestaXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('XML parse error: ' + parseError.textContent);
  return doc;
}

// Proper singular: categories→category, products→product, stock_availables→stock_available
function toSingular(resource) {
  if (resource.endsWith('ies')) return resource.slice(0, -3) + 'y';
  if (resource.endsWith('s')) return resource.slice(0, -1);
  return resource;
}

// Extract a list — uses DIRECT children only to avoid matching nested descendants
export function extractList(doc, resource) {
  const singular = toSingular(resource);
  const container = doc.querySelector(resource);
  if (!container) return [];
  return Array.from(container.children)
    .filter((el) => el.tagName.toLowerCase() === singular.toLowerCase())
    .map(nodeToObj);
}

// Extract a single resource object
export function extractSingle(doc, resource) {
  const el = doc.querySelector(`prestashop > ${resource}`);
  return el ? nodeToObj(el) : null;
}

// Get the id of a single resource from a POST/PUT response
export function extractId(doc, resource) {
  const obj = extractSingle(doc, resource);
  return obj?.id ?? null;
}

// Get the text value of a language field
// fieldObj can be a string, or { language: [{id, _}] }
export function getLangValue(fieldObj, langId = 1) {
  if (!fieldObj) return '';
  if (typeof fieldObj === 'string') return fieldObj;
  if (fieldObj.language) {
    const langs = Array.isArray(fieldObj.language) ? fieldObj.language : [fieldObj.language];
    const match = langs.find((l) => String(l.id) === String(langId));
    return match?._ ?? langs[0]?._ ?? '';
  }
  return fieldObj._ ?? '';
}

// PS navigation attributes that are not actual data
const SKIP_ATTRS = new Set(['xlink:href', 'notFilterable', 'href']);

// Convert a DOM Element into a plain JS object
function nodeToObj(el) {
  const obj = {};
  const hasChildren = el.children.length > 0;

  if (!hasChildren) {
    // Leaf node — strip non-data navigation attributes (xlink:href, notFilterable)
    const text = el.textContent.trim();
    const meaningful = Array.from(el.attributes).filter((a) => !SKIP_ATTRS.has(a.name));
    if (meaningful.length > 0) {
      for (const attr of meaningful) obj[attr.name] = attr.value;
      obj._ = text;
      return obj;
    }
    // Pure text leaf (e.g. <id>5</id>, <quantity>3</quantity>)
    return text;
  }

  // Container element: skip navigation attributes; skip 'id' attr when child <id> will set it
  const childTags = new Set(Array.from(el.children).map((c) => c.tagName));
  for (const attr of el.attributes) {
    if (SKIP_ATTRS.has(attr.name)) continue;
    if (attr.name === 'id' && childTags.has('id')) continue;
    obj[attr.name] = attr.value;
  }

  for (const child of el.children) {
    const key = child.tagName;
    const val = nodeToObj(child);
    if (obj[key] !== undefined) {
      if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
      obj[key].push(val);
    } else {
      obj[key] = val;
    }
  }
  return obj;
}
