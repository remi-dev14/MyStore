import axios from 'axios';
import AdmZip from 'adm-zip';
import { PRESTA_URL, auth, prestaGet, ts, prestaErrorDetail } from './prestaClient.js';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

// STEP 5: Images
export async function importImages(zipFile, productMap, log, report, errors) {
  if (!zipFile) return;
  try {
    const zip = new AdmZip(zipFile.buffer);
    const entries = zip.getEntries().filter(
      (e) => !e.isDirectory && /\.(jpg|jpeg|png|gif|webp)$/i.test(e.entryName) && !e.name.startsWith('._')
    );
    for (const entry of entries) {
      const namePart = entry.name.replace(/\.[^.]+$/, '');
      const pid = productMap[namePart];
      if (!pid) {
        errors.push(`[${ts()}] Image ignorée : "${entry.name}" — référence "${namePart}" inconnue`);
        continue;
      }
      try {
        const imgCheck = await prestaGet(`images/products/${pid}`, { output_format: 'XML' });
        const imgs = imgCheck?.prestashop?.image?.declination;
        if (imgs && (Array.isArray(imgs) ? imgs.length > 0 : true)) {
          report.images.skipped++;
          log.push(`[${ts()}] Image ignorée (déjà présente) : ${entry.name} → product ${pid}`);
          continue;
        }
      } catch { /* proceed with upload if check fails */ }
      try {
        const ext = entry.name.split('.').pop().toLowerCase();
        const contentType = MIME[ext] || 'image/jpeg';
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('image', entry.getData(), { filename: entry.name, contentType });
        await axios.post(`${PRESTA_URL}/images/products/${pid}`, form, { auth, headers: form.getHeaders() });
        report.images.uploaded++;
        log.push(`[${ts()}] Image uploadée : ${entry.name} → product ${pid}`);
      } catch (e) {
        report.images.failed++;
        const detail = prestaErrorDetail(e);
        errors.push(`[${ts()}] ERREUR Image ${entry.name}: ${e.message}${detail ? ' — PS: ' + detail : ''}`);
      }
    }
  } catch (e) {
    errors.push(`[${ts()}] ERREUR ZIP: ${e.message}`);
  }
}
