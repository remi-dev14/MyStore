import { prestaGet, prestaPost, getId, ts, prestaErrorDetail } from './prestaClient.js';
import { buildCustomerXml, buildAddressXml } from '../../src/utils/xmlBuilder.js';

export function splitName(nom) {
  const parts = (nom || '').trim().split(/\s+/);
  if (parts.length >= 2) return { firstname: parts.slice(0, -1).join(' '), lastname: parts[parts.length - 1] };
  return { firstname: nom || 'Client', lastname: nom || 'Client' };
}

export function safePasswd(raw) {
  const p = (raw || '').trim();
  return p.length >= 8 ? p : (p + 'Aa12345!').substring(0, Math.max(8, p.length));
}

async function findCustomerByEmail(email) {
  try {
    const res = await prestaGet('customers', {
      display: 'full', 'filter[email]': `[${email}]`, output_format: 'XML',
    });
    const customers = res?.prestashop?.customers?.customer;
    if (!customers) return null;
    const list = Array.isArray(customers) ? customers : [customers];
    return list[0]?.id ?? null;
  } catch { return null; }
}

async function findAddressForCustomer(customerId) {
  try {
    const res = await prestaGet('addresses', {
      display: 'full', 'filter[id_customer]': customerId, output_format: 'XML',
    });
    const addresses = res?.prestashop?.addresses?.address;
    if (!addresses) return null;
    const list = Array.isArray(addresses) ? addresses : [addresses];
    return list[0]?.id ?? null;
  } catch { return null; }
}

// STEP 3: Customers — returns customerMap { email → { id, addressId } }
export async function importCustomers(f3Rows, log, errors, report) {
  const customerMap = {};
  const seenEmails = new Set();

  for (const row of f3Rows) {
    const email = (row.email || '').trim();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    try {
      const existingId = await findCustomerByEmail(email);
      if (existingId) {
        const addrId = await findAddressForCustomer(existingId);
        customerMap[email] = { id: existingId, addressId: addrId };
        report.clients.existing++;
        log.push(`[${ts()}] Client existant utilisé : ${email} (id=${existingId}, adresse id=${addrId ?? 'inconnue'})`);
        continue;
      }
      const { firstname, lastname } = splitName(row.nom);
      const passwd = safePasswd(row.pwd);
      const custCreated = await prestaPost('customers', buildCustomerXml({ firstname, lastname, email, passwd }));
      const custId = getId(custCreated, 'customer');
      if (!custId) throw new Error('Aucun id client retourné');
      const addrCreated = await prestaPost('addresses', buildAddressXml({
        id_customer: custId, alias: 'Domicile',
        address1: row.adresse || '1 rue de Paris', city: 'Paris', firstname, lastname,
      }));
      const addrId = getId(addrCreated, 'address');
      customerMap[email] = { id: custId, addressId: addrId };
      report.clients.created++;
      log.push(`[${ts()}] Client créé : ${firstname} ${lastname} <${email}> (id=${custId}, adresse id=${addrId})`);
    } catch (e) {
      report.clients.failed++;
      const detail = prestaErrorDetail(e);
      errors.push(`[${ts()}] ERREUR Client ${row.email}: ${e.message}${detail ? ' — PS: ' + detail : ''}`);
    }
  }
  return customerMap;
}
