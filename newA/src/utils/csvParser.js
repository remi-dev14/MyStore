export function parseDecimal(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(',', '.'));
}

export function parsePercent(str) {
  if (!str) return 0;
  const val = parseFloat(String(str).replace('%', '').replace(',', '.').trim());
  if (isNaN(val)) return 0;
  // Decimal fraction (0.20) → percentage (20). Strict < 1 to keep "1%" as-is.
  return val > 0 && val < 1 ? val * 100 : val;
}

export function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], sep);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, sep);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i] !== undefined ? values[i].trim() : '';
    });
    return row;
  });
}

function detectSeparator(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvLine(line, sep = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function detectFileType(headers) {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (h.includes('date_availability_produit') && h.includes('prix_ttc')) return 'fichier1';
  if (h.includes('specificité') || h.includes('specificite') || h.includes('karazany')) return 'fichier2';
  if (h.includes('achat') && h.includes('pwd')) return 'fichier3';
  return 'unknown';
}

export function parseAchat(achatStr) {
  if (!achatStr) return [];
  const matches = [...achatStr.matchAll(/\("([^"]+)";(\d+);"([^"]*)"\)/g)];
  return matches.map((m) => ({
    reference: m[1],
    quantity: parseInt(m[2], 10),
    variant: m[3],
  }));
}
