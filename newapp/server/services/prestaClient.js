import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';
dotenv.config();

export const PRESTA_URL  = process.env.PRESTASHOP_API_URL;
export const PRESTA_KEY  = process.env.PRESTASHOP_API_KEY;
export const PRESTA_BASE = PRESTA_URL.replace(/\/api\/?$/, '');
export const auth        = { username: PRESTA_KEY, password: '' };

export function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

export function getId(parsed, resource) {
  return parsed?.prestashop?.[resource]?.id ?? null;
}

export function getLang(field, id = '1') {
  if (!field) return '';
  if (typeof field === 'string') return field;
  const langs = Array.isArray(field.language) ? field.language : [field.language].filter(Boolean);
  const m = langs.find((l) => String(l.id) === String(id));
  return m?._ ?? m ?? '';
}

export function prestaErrorDetail(err) {
  const data = err.response?.data;
  if (!data) return '';
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const m = str.match(/<message[^>]*>([\s\S]*?)<\/message>/i)
    || str.match(/<error[^>]*>([\s\S]*?)<\/error>/i);
  if (m) return m[1].replace(/<[^>]+>/g, '').trim().substring(0, 300);
  return str.substring(0, 300);
}

function assertXml(raw, context) {
  const trimmed = (raw || '').trim();
  if (!trimmed.startsWith('<')) {
    throw new Error(`Réponse non-XML [${context}]: "${trimmed.substring(0, 400)}"`);
  }
}

export async function prestaGet(path, params = {}) {
  const res = await axios.get(`${PRESTA_URL}/${path}`, { auth, params, responseType: 'text' });
  return parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
}

export async function prestaPost(path, xml) {
  let res;
  try {
    res = await axios.post(`${PRESTA_URL}/${path}`, xml, {
      auth, headers: { 'Content-Type': 'application/xml' }, responseType: 'text',
    });
  } catch (e) {
    const raw = typeof e.response?.data === 'string' ? e.response.data : '';
    const status = e.response?.status || 0;
    throw new Error(`HTTP ${status} POST /${path} — ${raw.substring(0, 500) || e.message}`, { cause: e });
  }
  const raw = res.data || '';
  assertXml(raw, `POST /${path} HTTP ${res.status}`);
  return parseStringPromise(raw, { explicitArray: false, mergeAttrs: true });
}
