const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function parseFrDate(str) {
  const m = String(str).match(DD_MM_YYYY);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}`);
}

export function frDateToIso(str) {
  const m = String(str).match(DD_MM_YYYY);
  if (!m) return str;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isFrDateValid(str) {
  return DD_MM_YYYY.test(String(str));
}

export function daysDiff(dateStr) {
  const d = parseFrDate(dateStr);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
}

export function isoToFr(isoStr) {
  if (!isoStr) return '';
  // PS stores "YYYY-MM-DD HH:MM:SS" (space) or ISO "YYYY-MM-DDTHH:MM:SS"
  const dateOnly = isoStr.split(/[ T]/)[0];
  const parts = dateOnly.split('-');
  if (parts.length < 3) return isoStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// Days elapsed since an ISO date (YYYY-MM-DD). Positive = in the past.
export function daysDiffIso(isoStr) {
  if (!isoStr || isoStr === '0000-00-00') return null;
  const d = new Date(isoStr.split(/[ T]/)[0]);
  if (isNaN(d)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
}
