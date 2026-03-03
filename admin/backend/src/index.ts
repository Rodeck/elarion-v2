import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { requireAdmin } from './middleware/auth';
import { mapsRouter } from './routes/maps';
import { nodesRouter } from './routes/nodes';
import { edgesRouter } from './routes/edges';
import { buildingsRouter } from './routes/buildings';
import { uploadRouter } from './routes/upload';
import { authRouter } from './routes/auth';
import { itemsRouter } from './routes/items';
import { adminToolsRouter } from './routes/admin-tools';

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded map images statically
const imagesDir = path.resolve(__dirname, '../../../backend/assets/maps/images');
app.use('/images', express.static(imagesDir));

// Serve item icons statically
const iconsDir = path.resolve(__dirname, '../../../backend/assets/items/icons');
app.use('/item-icons', express.static(iconsDir));

// Public auth routes (must be before requireAdmin middleware)
app.use(authRouter);

// All /api routes require admin authentication
app.use('/api', requireAdmin);

// Mount route modules
app.use('/api/maps', mapsRouter);
app.use('/api/maps', nodesRouter);
app.use('/api/maps', edgesRouter);
app.use('/api/maps', buildingsRouter);
app.use('/api/maps', uploadRouter);
app.use('/api/items', itemsRouter);
app.use('/api/admin-tools', adminToolsRouter);

app.listen(config.editorPort, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'Admin editor backend started',
    port: config.editorPort,
    timestamp: new Date().toISOString(),
  }));
});
