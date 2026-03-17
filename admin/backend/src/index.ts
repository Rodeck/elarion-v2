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
import { monstersRouter } from './routes/monsters';
import { adminToolsRouter } from './routes/admin-tools';
import { imagePromptsRouter } from './routes/image-prompts';
import { adminConfigRouter } from './routes/admin-config';
import { aiGenerateRouter } from './routes/ai-generate';
import { encounterTablesRouter } from './routes/encounter-tables';
import { npcsRouter } from './routes/npcs';
import { abilitiesRouter } from './routes/abilities';
import { recipesRouter } from './routes/recipes';

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded map images statically
const imagesDir = path.resolve(__dirname, '../../../backend/assets/maps/images');
app.use('/images', express.static(imagesDir));

// Serve item icons statically
const iconsDir = path.resolve(__dirname, '../../../backend/assets/items/icons');
app.use('/item-icons', express.static(iconsDir));

// Serve monster icons statically
const monsterIconsDir = path.resolve(__dirname, '../../../backend/assets/monsters/icons');
app.use('/monster-icons', express.static(monsterIconsDir));

// Serve NPC icons statically
const npcIconsDir = path.resolve(__dirname, '../../../backend/assets/npcs/icons');
app.use('/npc-icons', express.static(npcIconsDir));

// Serve ability icons statically
const abilityIconsDir = path.resolve(__dirname, '../../../backend/assets/ability-icons');
app.use('/ability-icons', express.static(abilityIconsDir));

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
app.use('/api/monsters', monstersRouter);
app.use('/api/admin-tools', adminToolsRouter);
app.use('/api/image-prompts', imagePromptsRouter);
app.use('/api/admin-config', adminConfigRouter);
app.use('/api/ai', aiGenerateRouter);
app.use('/api/encounter-tables', encounterTablesRouter);
app.use('/api/npcs', npcsRouter);
app.use('/api/abilities', abilitiesRouter);
app.use('/api/recipes', recipesRouter);

if (!process.env['OPENROUTER_API_KEY']) {
  console.log(JSON.stringify({ level: 'warn', event: 'openrouter_key_missing', msg: 'OPENROUTER_API_KEY not set — AI image generation will return 503', timestamp: new Date().toISOString() }));
}

app.listen(config.editorPort, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'Admin editor backend started',
    port: config.editorPort,
    timestamp: new Date().toISOString(),
  }));
});
