import { isFrDateValid } from './dateUtils.js';
import { parseDecimal } from './csvParser.js';

const EXPECTED_HEADERS = {
  fichier1: ['date_availability_produit', 'nom', 'reference', 'prix_ttc', 'taxe', 'categorie', 'prix_achat'],
  // specificité may be misencoded (Windows-1252/UTF-8 mismatch) — checked by prefix below
  fichier2: ['reference', 'karazany', 'stock_initial', 'prix_vente_ttc'],
  fichier3: ['date', 'nom', 'email', 'pwd', 'adresse', 'achat', 'etat'],
};

// Values stored after normalizeEtatStr (accent-stripped, lowercase)
const VALID_ETATS = new Set([
  '', 'dans le panier',
  'paiement accepte',
  'payment effectuer',
  'annuler', 'annule',
  'livre',
]);

function normalizeEtatStr(str) {
  return (str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function validateCsv(rows, fileType) {
  if (!rows.length) return [{ row: 0, column: '-', message: 'Fichier vide' }];
  const errors = [];
  const expected = EXPECTED_HEADERS[fileType];
  if (expected) {
    const actual = Object.keys(rows[0]).map((k) => k.trim().toLowerCase());
    expected.forEach((col) => {
      const found = actual.some((a) => a === col.toLowerCase());
      if (!found) errors.push({ row: 0, column: col, message: `Colonne manquante : "${col}"` });
    });
    // specificité may be misencoded — check by prefix
    if (fileType === 'fichier2') {
      const hasSpecif = actual.some((a) => a.startsWith('specif'));
      if (!hasSpecif) errors.push({ row: 0, column: 'specificité', message: 'Colonne manquante : "specificité"' });
    }
  }

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    if (fileType === 'fichier1') {
      if (row.date_availability_produit && !isFrDateValid(row.date_availability_produit)) {
        errors.push({ row: rowNum, column: 'date_availability_produit', message: `Format date invalide (attendu DD/MM/YYYY) : "${row.date_availability_produit}"` });
      }
      if (row.prix_ttc !== undefined && parseDecimal(row.prix_ttc) <= 0) {
        errors.push({ row: rowNum, column: 'prix_ttc', message: `Prix TTC doit être positif : "${row.prix_ttc}"` });
      }
      if (row.prix_achat !== undefined && parseDecimal(row.prix_achat) < 0) {
        errors.push({ row: rowNum, column: 'prix_achat', message: `Prix achat ne peut pas être négatif : "${row.prix_achat}"` });
      }
    }
    if (fileType === 'fichier2') {
      if (row.stock_initial !== undefined && parseDecimal(row.stock_initial) < 0) {
        errors.push({ row: rowNum, column: 'stock_initial', message: `Stock initial négatif : "${row.stock_initial}"` });
      }
    }
    if (fileType === 'fichier3') {
      if (row.date && !isFrDateValid(row.date)) {
        errors.push({ row: rowNum, column: 'date', message: `Format date invalide (attendu DD/MM/YYYY) : "${row.date}"` });
      }
      const etat = normalizeEtatStr(row.etat || '');
      if (!VALID_ETATS.has(etat)) {
        errors.push({ row: rowNum, column: 'etat', message: `État inconnu "${row.etat}" — valeurs acceptées : vide, "paiement accepté", "payment effectuer", "annulé", "livré"` });
      }
    }
  });

  return errors;
}
