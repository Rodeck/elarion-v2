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
import { questsRouter } from './routes/quests';
import { buildingItemsRouter } from './routes/building-items';
import { squireDefinitionsRouter } from './routes/squire-definitions';
import { fishingRouter } from './routes/fishing';
import { bossesRouter } from './routes/bosses';
import { arenasRouter } from './routes/arenas';

const app = express();

app.use(cors());
app.use((req, res, next) => {
  // Skip global JSON parser for batch-icons (handled by route-level parser with higher limit)
  if (req.path === '/api/items/batch-icons' || req.path === '/api/monsters/batch-icons') return next();
  express.json()(req, res, next);
});

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

// Serve squire icons statically
const squireIconsDir = path.resolve(__dirname, '../../../backend/assets/squires/icons');
app.use('/squire-icons', express.static(squireIconsDir));

// Serve boss icons and sprites statically
const bossIconsDir = path.resolve(__dirname, '../../../backend/assets/bosses/icons');
app.use('/boss-icons', express.static(bossIconsDir));
const bossSpritesDir = path.resolve(__dirname, '../../../backend/assets/bosses/sprites');
app.use('/boss-sprites', express.static(bossSpritesDir));

// Serve UI icons (XP, crowns) statically
const uiIconsDir = path.resolve(__dirname, '../../../backend/assets/ui-icons');
app.use('/ui-icons', express.static(uiIconsDir));

// Public auth routes (must be before requireAdmin middleware)
app.use(authRouter);

// All /api routes require admin authentication
app.use('/api', requireAdmin);

// Mount route modules
app.use('/api/maps', mapsRouter);
app.use('/api/maps', nodesRouter);
app.use('/api/maps', edgesRouter);
app.use('/api/maps', buildingsRouter);
app.use('/api/maps', buildingItemsRouter);
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
app.use('/api/quests', questsRouter);
app.use('/api/squire-definitions', squireDefinitionsRouter);
app.use('/api', fishingRouter);
app.use('/api/bosses', bossesRouter);
app.use('/api/arenas', arenasRouter);

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
