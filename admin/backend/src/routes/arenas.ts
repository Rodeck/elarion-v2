import { Router, Request, Response } from 'express';
import {
  getAllArenas,
  getArenaById,
  createArena,
  updateArena,
  deleteArena,
  getArenaMonstersWithDetails,
  addArenaMonster,
  removeArenaMonster,
  getParticipantsByArena,
  deleteParticipant,
  setCharacterArenaId,
  setCharacterArenaCooldown,
  type Arena,
} from '../../../../backend/src/db/queries/arenas';
import { query } from '../../../../backend/src/db/connection';

export const arenasRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

function arenaToResponse(a: Arena & { building_name?: string }) {
  return {
    id: a.id,
    name: a.name,
    building_id: a.building_id,
    building_name: (a as Arena & { building_name?: string }).building_name ?? null,
    min_stay_seconds: a.min_stay_seconds,
    reentry_cooldown_seconds: a.reentry_cooldown_seconds,
    winner_xp: a.winner_xp,
    loser_xp: a.loser_xp,
    winner_crowns: a.winner_crowns,
    loser_crowns: a.loser_crowns,
    level_bracket: a.level_bracket,
    is_active: a.is_active,
    created_at: a.created_at,
  };
}

// ── GET /api/arenas/buildings ────────────────────────────────────────────────
// Helper: list all buildings for building_id dropdown (must be before /:id)

arenasRouter.get('/buildings', async (_req: Request, res: Response) => {
  try {
    const result = await query<{ id: number; name: string; zone_id: number }>(
      'SELECT id, name, zone_id FROM buildings ORDER BY name',
    );
    return res.json(result.rows);
  } catch (err) {
    log('error', 'Failed to list buildings', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/arenas/monsters-list ───────────────────────────────────────────
// Helper: list all monsters for assignment dropdown (must be before /:id)

arenasRouter.get('/monsters-list', async (_req: Request, res: Response) => {
  try {
    const result = await query<{ id: number; name: string; icon_filename: string | null; hp: number; attack: number; defense: number }>(
      'SELECT id, name, icon_filename, hp, attack, defense FROM monsters ORDER BY name',
    );
    return res.json(result.rows.map(m => ({
      ...m,
      icon_url: m.icon_filename ? `/monster-icons/${m.icon_filename}` : null,
    })));
  } catch (err) {
    log('error', 'Failed to list monsters', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/arenas ─────────────────────────────────────────────────────────

arenasRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const arenas = await getAllArenas();
    const enriched = [];
    for (const a of arenas) {
      let buildingName: string | null = null;
      if (a.building_id) {
        const bldg = await query<{ name: string }>('SELECT name FROM buildings WHERE id = $1', [a.building_id]);
        if (bldg.rows.length > 0) buildingName = bldg.rows[0]!.name;
      }
      enriched.push(arenaToResponse({ ...a, building_name: buildingName ?? undefined }));
    }
    return res.json(enriched);
  } catch (err) {
    log('error', 'Failed to list arenas', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/arenas/:id ─────────────────────────────────────────────────────

arenasRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid arena id' });

  try {
    const arena = await getArenaById(id);
    if (!arena) return res.status(404).json({ error: 'Arena not found' });

    let buildingName: string | null = null;
    if (arena.building_id) {
      const bldg = await query<{ name: string }>('SELECT name FROM buildings WHERE id = $1', [arena.building_id]);
      if (bldg.rows.length > 0) buildingName = bldg.rows[0]!.name;
    }

    const monsters = await getArenaMonstersWithDetails(id);
    const participants = await getParticipantsByArena(id);

    return res.json({
      ...arenaToResponse({ ...arena, building_name: buildingName ?? undefined }),
      monsters: monsters.map(m => ({
        id: m.id,
        monster_id: m.monster_id,
        sort_order: m.sort_order,
        name: m.name,
        icon_url: m.icon_filename ? `/monster-icons/${m.icon_filename}` : null,
        hp: m.hp,
        attack: m.attack,
        defense: m.defense,
        xp_reward: m.xp_reward,
      })),
      participants: participants.map(p => ({
        id: p.id,
        character_id: p.character_id,
        name: p.name,
        level: p.level,
        entered_at: p.entered_at,
        current_hp: p.current_hp,
        in_combat: p.in_combat,
        fighting_character_id: p.fighting_character_id,
        can_leave_at: p.can_leave_at,
      })),
    });
  } catch (err) {
    log('error', 'Failed to get arena', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/arenas ────────────────────────────────────────────────────────

arenasRouter.post('/', async (req: Request, res: Response) => {
  const {
    name, building_id, min_stay_seconds, reentry_cooldown_seconds,
    winner_xp, loser_xp, winner_crowns, loser_crowns,
    level_bracket, is_active,
  } = req.body as Record<string, unknown>;

  if (!name || !(name as string).trim()) return res.status(400).json({ error: 'name is required' });

  const buildingIdNum = Number(building_id);
  if (isNaN(buildingIdNum) || buildingIdNum < 1) return res.status(400).json({ error: 'building_id must be a positive integer' });
  // Verify building exists
  const bldg = await query<{ id: number }>('SELECT id FROM buildings WHERE id = $1', [buildingIdNum]);
  if (bldg.rows.length === 0) return res.status(400).json({ error: 'building_id references a non-existent building' });

  const minStay = Number(min_stay_seconds ?? 3600);
  if (isNaN(minStay) || minStay < 0) return res.status(400).json({ error: 'min_stay_seconds must be a non-negative integer' });

  const cooldown = Number(reentry_cooldown_seconds ?? 1800);
  if (isNaN(cooldown) || cooldown < 0) return res.status(400).json({ error: 'reentry_cooldown_seconds must be a non-negative integer' });

  const wXp = Number(winner_xp ?? 50);
  if (isNaN(wXp) || wXp < 0) return res.status(400).json({ error: 'winner_xp must be a non-negative integer' });

  const lXp = Number(loser_xp ?? 10);
  if (isNaN(lXp) || lXp < 0) return res.status(400).json({ error: 'loser_xp must be a non-negative integer' });

  const wCrowns = Number(winner_crowns ?? 25);
  if (isNaN(wCrowns) || wCrowns < 0) return res.status(400).json({ error: 'winner_crowns must be a non-negative integer' });

  const lCrowns = Number(loser_crowns ?? 0);
  if (isNaN(lCrowns) || lCrowns < 0) return res.status(400).json({ error: 'loser_crowns must be a non-negative integer' });

  const bracket = Number(level_bracket ?? 5);
  if (isNaN(bracket) || bracket < 1) return res.status(400).json({ error: 'level_bracket must be a positive integer' });

  try {
    const arena = await createArena({
      name: (name as string).trim(),
      building_id: buildingIdNum,
      min_stay_seconds: minStay,
      reentry_cooldown_seconds: cooldown,
      winner_xp: wXp,
      loser_xp: lXp,
      winner_crowns: wCrowns,
      loser_crowns: lCrowns,
      level_bracket: bracket,
      is_active: is_active === true || is_active === 'true',
    });
    log('info', 'Created arena', { id: arena.id, name: arena.name, admin: req.username });
    return res.status(201).json(arenaToResponse(arena));
  } catch (err) {
    log('error', 'Failed to create arena', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/arenas/:id ─────────────────────────────────────────────────────

arenasRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid arena id' });

  const existing = await getArenaById(id);
  if (!existing) return res.status(404).json({ error: 'Arena not found' });

  const {
    name, building_id, min_stay_seconds, reentry_cooldown_seconds,
    winner_xp, loser_xp, winner_crowns, loser_crowns,
    level_bracket, is_active,
  } = req.body as Record<string, unknown>;

  const data: Partial<Omit<Arena, 'id' | 'created_at'>> = {};

  if (name !== undefined) {
    if (!(name as string).trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = (name as string).trim();
  }
  if (building_id !== undefined) {
    const v = Number(building_id);
    if (isNaN(v) || v < 1) return res.status(400).json({ error: 'building_id must be a positive integer' });
    const bldg = await query<{ id: number }>('SELECT id FROM buildings WHERE id = $1', [v]);
    if (bldg.rows.length === 0) return res.status(400).json({ error: 'building_id references a non-existent building' });
    data.building_id = v;
  }
  if (min_stay_seconds !== undefined) {
    const v = Number(min_stay_seconds);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'min_stay_seconds must be a non-negative integer' });
    data.min_stay_seconds = v;
  }
  if (reentry_cooldown_seconds !== undefined) {
    const v = Number(reentry_cooldown_seconds);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'reentry_cooldown_seconds must be a non-negative integer' });
    data.reentry_cooldown_seconds = v;
  }
  if (winner_xp !== undefined) {
    const v = Number(winner_xp);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'winner_xp must be a non-negative integer' });
    data.winner_xp = v;
  }
  if (loser_xp !== undefined) {
    const v = Number(loser_xp);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'loser_xp must be a non-negative integer' });
    data.loser_xp = v;
  }
  if (winner_crowns !== undefined) {
    const v = Number(winner_crowns);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'winner_crowns must be a non-negative integer' });
    data.winner_crowns = v;
  }
  if (loser_crowns !== undefined) {
    const v = Number(loser_crowns);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'loser_crowns must be a non-negative integer' });
    data.loser_crowns = v;
  }
  if (level_bracket !== undefined) {
    const v = Number(level_bracket);
    if (isNaN(v) || v < 1) return res.status(400).json({ error: 'level_bracket must be a positive integer' });
    data.level_bracket = v;
  }
  if (is_active !== undefined) {
    data.is_active = is_active === true || is_active === 'true';
  }

  try {
    const updated = await updateArena(id, data);
    if (!updated) return res.status(404).json({ error: 'Arena not found' });
    log('info', 'Updated arena', { id, admin: req.username });
    return res.json(arenaToResponse(updated));
  } catch (err) {
    log('error', 'Failed to update arena', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/arenas/:id ──────────────────────────────────────────────────

arenasRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid arena id' });

  try {
    const arena = await getArenaById(id);
    if (!arena) return res.status(404).json({ error: 'Arena not found' });

    // Clear arena_id on any characters still referencing this arena
    await query('UPDATE characters SET arena_id = NULL WHERE arena_id = $1', [id]);

    await deleteArena(id);
    log('info', 'Deleted arena', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete arena', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/arenas/:id/monsters ────────────────────────────────────────────

arenasRouter.get('/:id/monsters', async (req: Request, res: Response) => {
  const arenaId = parseInt(req.params.id!, 10);
  if (isNaN(arenaId)) return res.status(400).json({ error: 'Invalid arena id' });

  try {
    const monsters = await getArenaMonstersWithDetails(arenaId);
    return res.json(monsters.map(m => ({
      id: m.id,
      monster_id: m.monster_id,
      sort_order: m.sort_order,
      name: m.name,
      icon_url: m.icon_filename ? `/monster-icons/${m.icon_filename}` : null,
      hp: m.hp,
      attack: m.attack,
      defense: m.defense,
      xp_reward: m.xp_reward,
    })));
  } catch (err) {
    log('error', 'Failed to get arena monsters', { arenaId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/arenas/:id/monsters ───────────────────────────────────────────

arenasRouter.post('/:id/monsters', async (req: Request, res: Response) => {
  const arenaId = parseInt(req.params.id!, 10);
  if (isNaN(arenaId)) return res.status(400).json({ error: 'Invalid arena id' });

  const { monster_id, sort_order } = req.body as Record<string, unknown>;

  if (!Number.isInteger(monster_id) || (monster_id as number) <= 0) {
    return res.status(400).json({ error: 'monster_id must be a positive integer' });
  }
  const sortOrd = Number(sort_order ?? 0);
  if (!Number.isInteger(sortOrd) || sortOrd < 0) {
    return res.status(400).json({ error: 'sort_order must be a non-negative integer' });
  }

  // Validate monster exists
  const monsterRow = await query<{ id: number }>('SELECT id FROM monsters WHERE id = $1', [monster_id]);
  if (monsterRow.rows.length === 0) {
    return res.status(400).json({ error: 'monster_id references a non-existent monster' });
  }

  // Validate arena exists
  const arena = await getArenaById(arenaId);
  if (!arena) return res.status(404).json({ error: 'Arena not found' });

  try {
    await addArenaMonster(arenaId, monster_id as number, sortOrd);
    // Re-fetch with joined data
    const monsters = await getArenaMonstersWithDetails(arenaId);
    const added = monsters.find(m => m.monster_id === (monster_id as number));
    log('info', 'Added arena monster', { arenaId, monster_id, admin: req.username });
    return res.status(201).json(added ? {
      id: added.id,
      monster_id: added.monster_id,
      sort_order: added.sort_order,
      name: added.name,
      icon_url: added.icon_filename ? `/monster-icons/${added.icon_filename}` : null,
      hp: added.hp,
      attack: added.attack,
      defense: added.defense,
      xp_reward: added.xp_reward,
    } : { monster_id, sort_order: sortOrd });
  } catch (err) {
    log('error', 'Failed to add arena monster', { arenaId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/arenas/:id/monsters/:monsterId ──────────────────────────────

arenasRouter.delete('/:id/monsters/:monsterId', async (req: Request, res: Response) => {
  const arenaId = parseInt(req.params.id!, 10);
  const monsterId = parseInt(req.params.monsterId!, 10);
  if (isNaN(arenaId) || isNaN(monsterId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await removeArenaMonster(arenaId, monsterId);
    log('info', 'Removed arena monster', { arenaId, monsterId, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to remove arena monster', { arenaId, monsterId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/arenas/:id/participants ────────────────────────────────────────

arenasRouter.get('/:id/participants', async (req: Request, res: Response) => {
  const arenaId = parseInt(req.params.id!, 10);
  if (isNaN(arenaId)) return res.status(400).json({ error: 'Invalid arena id' });

  try {
    const participants = await getParticipantsByArena(arenaId);
    return res.json(participants.map(p => ({
      id: p.id,
      character_id: p.character_id,
      name: p.name,
      level: p.level,
      entered_at: p.entered_at,
      current_hp: p.current_hp,
      in_combat: p.in_combat,
      fighting_character_id: p.fighting_character_id,
      can_leave_at: p.can_leave_at,
    })));
  } catch (err) {
    log('error', 'Failed to get arena participants', { arenaId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/arenas/:id/kick/:characterId ──────────────────────────────────

arenasRouter.post('/:id/kick/:characterId', async (req: Request, res: Response) => {
  const arenaId = parseInt(req.params.id!, 10);
  const characterId = req.params.characterId!;
  if (isNaN(arenaId)) return res.status(400).json({ error: 'Invalid arena id' });
  if (!characterId) return res.status(400).json({ error: 'Invalid character id' });

  try {
    const arena = await getArenaById(arenaId);
    if (!arena) return res.status(404).json({ error: 'Arena not found' });

    // Get participant to retrieve current_hp before deletion
    const participants = await getParticipantsByArena(arenaId);
    const participant = participants.find(p => p.character_id === characterId);
    if (!participant) return res.status(404).json({ error: 'Participant not found in this arena' });

    // Restore character HP from participant's current_hp
    await query('UPDATE characters SET current_hp = $1 WHERE id = $2', [participant.current_hp, characterId]);

    // Delete participant row
    await deleteParticipant(characterId);

    // Clear character arena_id
    await setCharacterArenaId(characterId, null);

    // Set cooldown (use arena's reentry_cooldown_seconds from now)
    const cooldownUntil = new Date(Date.now() + arena.reentry_cooldown_seconds * 1000);
    await setCharacterArenaCooldown(characterId, cooldownUntil);

    log('info', 'Force-kicked player from arena', { arenaId, characterId, admin: req.username });
    return res.json({ success: true, message: `Kicked ${participant.name} from arena` });
  } catch (err) {
    log('error', 'Failed to kick player from arena', { arenaId, characterId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
