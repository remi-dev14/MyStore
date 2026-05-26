import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const PRESTA_URL = process.env.PRESTASHOP_API_URL;
const PRESTA_KEY = process.env.PRESTASHOP_API_KEY;
const auth = { username: PRESTA_KEY, password: '' };

function buildPrestaUrl(paramPath) {
  // Express 5 wildcard: req.params.path
  const path = Array.isArray(paramPath) ? paramPath.join('/') : (paramPath ?? '');
  return `${PRESTA_URL}/${path}`;
}

router.get('/*path', async (req, res) => {
  try {
    const url = buildPrestaUrl(req.params.path);
    const pathStr = Array.isArray(req.params.path) ? req.params.path.join('/') : (req.params.path ?? '');
    const isImage = pathStr.startsWith('images/');
    const response = await axios.get(url, {
      auth,
      params: req.query,
      responseType: isImage ? 'arraybuffer' : 'text',
    });
    if (isImage) {
      const ct = response.headers['content-type'] || 'image/jpeg';
      res.set('Content-Type', ct);
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(response.data));
    } else {
      res.set('Content-Type', 'application/xml');
      res.send(response.data);
    }
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, detail: err.response?.data });
  }
});

router.post('/*path', async (req, res) => {
  try {
    const url = buildPrestaUrl(req.params.path);
    const response = await axios.post(url, req.body, {
      auth,
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, detail: err.response?.data });
  }
});

router.put('/*path', async (req, res) => {
  try {
    const url = buildPrestaUrl(req.params.path);
    const response = await axios.put(url, req.body, {
      auth,
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, detail: err.response?.data });
  }
});

router.delete('/*path', async (req, res) => {
  try {
    const url = buildPrestaUrl(req.params.path);
    const response = await axios.delete(url, { auth, responseType: 'text' });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

export default router;
