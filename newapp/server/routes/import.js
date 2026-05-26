import { Router } from 'express';
import multer from 'multer';
import { parseCsvText, detectFileType } from '../../src/utils/csvParser.js';
import { ts } from '../services/prestaClient.js';
import { importProducts } from '../services/productService.js';
import { importCustomers } from '../services/customerService.js';
import { importOrders } from '../services/orderService.js';
import { importImages } from '../services/imageService.js';
import { resetAll } from '../services/resetService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), v]));
}

router.post('/', upload.array('files'), async (req, res) => {
  const log = [], errors = [];
  const report = {
    categories: { created: 0, existing: 0 },
    products:   { created: 0, existing: 0, failed: 0 },
    clients:    { created: 0, existing: 0, failed: 0 },
    paniers:    { created: 0, failed: 0 },
    commandes:  { created: 0, failed: 0 },
    images:     { uploaded: 0, skipped: 0, failed: 0 },
  };
  try {
    let f1Rows = [], f2Rows = [], f3Rows = [], zipFile = null;
    for (const file of (req.files || [])) {
      if (file.originalname.endsWith('.zip')) { zipFile = file; continue; }
      const rows = parseCsvText(file.buffer.toString('utf-8')).map(normalizeRow);
      if (!rows.length) continue;
      const type = detectFileType(Object.keys(rows[0]));
      const cols = Object.keys(rows[0]);
      log.push(`[${ts()}] Fichier : ${file.originalname} → ${type} (${rows.length} lignes, ${cols.length} col: ${cols.slice(0, 6).join(', ')}${cols.length > 6 ? '…' : ''})`);
      if (type === 'fichier1') f1Rows = rows;
      else if (type === 'fichier2') f2Rows = rows;
      else if (type === 'fichier3') f3Rows = rows;
    }

    const { productMap, comboMap } = await importProducts(f1Rows, f2Rows, log, errors, report);
    const customerMap = await importCustomers(f3Rows, log, errors, report);
    await importOrders(f3Rows, productMap, comboMap, customerMap, f1Rows, f2Rows, log, errors, report);

    const shouldImportImages = req.body.importImages !== '0';
    if (shouldImportImages) {
      await importImages(zipFile, productMap, log, report, errors);
    } else {
      log.push(`[${ts()}] Import des images ignoré (désactivé)`);
    }


    log.push(`[${ts()}] ===== RAPPORT FINAL =====`);
    log.push(`Catégories : ${report.categories.created} créées, ${report.categories.existing} existantes`);
    log.push(`Produits   : ${report.products.created} créés, ${report.products.existing} existants, ${report.products.failed} échecs`);
    log.push(`Clients    : ${report.clients.created} créés, ${report.clients.existing} existants, ${report.clients.failed} échecs`);
    log.push(`Paniers    : ${report.paniers.created} créés, ${report.paniers.failed} échecs`);
    log.push(`Commandes  : ${report.commandes.created} créées, ${report.commandes.failed} échecs`);
    log.push(`Images     : ${report.images.uploaded} uploadées, ${report.images.skipped} ignorées, ${report.images.failed} échecs`);

    res.json({ success: true, log, errors, report });
  } catch (err) {
    errors.push(`[${ts()}] ERREUR CRITIQUE: ${err.message}`);
    res.status(500).json({ success: false, error: err.message, log, errors });
  }
});

router.delete('/reset', async (_req, res) => {
  const log = [], errors = [];
  await resetAll(log, errors);
  res.json({ success: true, log, errors });
});

export default router;