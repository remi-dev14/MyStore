import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prestaRoutes from './routes/prestashop.js';
import importRoutes from './routes/import.js';
import ordersRoutes from './routes/orders.js';
import stockRoutes from './routes/stock.js';
import statsRoutes from './routes/stats.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'application/xml', limit: '10mb' }));

app.use('/api/presta', prestaRoutes);
app.use('/api/import', importRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stats', statsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy server running on http://localhost:${PORT}`));
