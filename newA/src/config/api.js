import axios from 'axios';

const BASE_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: BASE_URL,
});

export async function prestaGet(path, params = {}) {
  const res = await api.get(`/api/presta/${path}`, { params });
  return res.data;
}

export async function prestaPost(path, xmlBody) {
  const res = await api.post(`/api/presta/${path}`, xmlBody, {
    headers: { 'Content-Type': 'application/xml' },
  });
  return res.data;
}

export async function prestaPut(path, xmlBody) {
  const res = await api.put(`/api/presta/${path}`, xmlBody, {
    headers: { 'Content-Type': 'application/xml' },
  });
  return res.data;
}

export async function prestaDelete(path) {
  const res = await api.delete(`/api/presta/${path}`);
  return res.data;
}
