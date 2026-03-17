import { query } from '../connection';

// ---------------------------------------------------------------------------
// Recipe types
// ---------------------------------------------------------------------------

export interface CraftingRecipe {
  id: number;
  npc_id: number;
  name: string;
  description: string | null;
  output_item_id: number;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  sort_order: number;
  created_at: Date;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  item_def_id: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export type CraftingSessionStatus = 'in_progress' | 'completed' | 'collected' | 'cancelled';

export interface CraftingSession {
  id: number;
  character_id: string;
  recipe_id: number;
  npc_id: number;
  quantity: number;
  started_at: Date;
  total_duration_seconds: number;
  cost_crowns: number;
  status: CraftingSessionStatus;
  created_at: Date;
}

export interface SessionCost {
  id: number;
  session_id: number;
  item_def_id: number;
  quantity_spent: number;
}

// ---------------------------------------------------------------------------
// Recipe queries
// ---------------------------------------------------------------------------

export async function getAllRecipes(): Promise<CraftingRecipe[]> {
  const result = await query<CraftingRecipe>(
    'SELECT * FROM crafting_recipes ORDER BY npc_id, sort_order, name',
  );
  return result.rows;
}

export async function getRecipesByNpcId(npcId: number): Promise<CraftingRecipe[]> {
  const result = await query<CraftingRecipe>(
    'SELECT * FROM crafting_recipes WHERE npc_id = $1 ORDER BY sort_order, name',
    [npcId],
  );
  return result.rows;
}

export async function getRecipeById(id: number): Promise<CraftingRecipe | null> {
  const result = await query<CraftingRecipe>(
    'SELECT * FROM crafting_recipes WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
  const result = await query<RecipeIngredient>(
    'SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY id',
    [recipeId],
  );
  return result.rows;
}

export async function createRecipe(data: {
  npc_id: number;
  name: string;
  description?: string | null;
  output_item_id: number;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  sort_order?: number;
}): Promise<CraftingRecipe> {
  const result = await query<CraftingRecipe>(
    `INSERT INTO crafting_recipes (npc_id, name, description, output_item_id, output_quantity, cost_crowns, craft_time_seconds, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.npc_id, data.name, data.description ?? null, data.output_item_id, data.output_quantity, data.cost_crowns, data.craft_time_seconds, data.sort_order ?? 0],
  );
  return result.rows[0]!;
}

export async function updateRecipe(
  id: number,
  data: {
    name?: string;
    description?: string | null;
    output_item_id?: number;
    output_quantity?: number;
    cost_crowns?: number;
    craft_time_seconds?: number;
    sort_order?: number;
  },
): Promise<CraftingRecipe | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(data.description); }
  if (data.output_item_id !== undefined) { fields.push(`output_item_id = $${paramIdx++}`); values.push(data.output_item_id); }
  if (data.output_quantity !== undefined) { fields.push(`output_quantity = $${paramIdx++}`); values.push(data.output_quantity); }
  if (data.cost_crowns !== undefined) { fields.push(`cost_crowns = $${paramIdx++}`); values.push(data.cost_crowns); }
  if (data.craft_time_seconds !== undefined) { fields.push(`craft_time_seconds = $${paramIdx++}`); values.push(data.craft_time_seconds); }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${paramIdx++}`); values.push(data.sort_order); }

  if (fields.length === 0) return getRecipeById(id);

  values.push(id);
  const result = await query<CraftingRecipe>(
    `UPDATE crafting_recipes SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteRecipe(id: number): Promise<void> {
  await query('DELETE FROM crafting_recipes WHERE id = $1', [id]);
}

// ---------------------------------------------------------------------------
// Ingredient queries
// ---------------------------------------------------------------------------

export async function addIngredient(recipeId: number, itemDefId: number, qty: number): Promise<RecipeIngredient> {
  const result = await query<RecipeIngredient>(
    `INSERT INTO recipe_ingredients (recipe_id, item_def_id, quantity) VALUES ($1, $2, $3) RETURNING *`,
    [recipeId, itemDefId, qty],
  );
  return result.rows[0]!;
}

export async function removeIngredient(id: number): Promise<void> {
  await query('DELETE FROM recipe_ingredients WHERE id = $1', [id]);
}

export async function replaceIngredients(recipeId: number, ingredients: { item_def_id: number; quantity: number }[]): Promise<void> {
  await query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
  for (const ing of ingredients) {
    await query(
      'INSERT INTO recipe_ingredients (recipe_id, item_def_id, quantity) VALUES ($1, $2, $3)',
      [recipeId, ing.item_def_id, ing.quantity],
    );
  }
}

// ---------------------------------------------------------------------------
// Session queries
// ---------------------------------------------------------------------------

export async function createSession(data: {
  character_id: string;
  recipe_id: number;
  npc_id: number;
  quantity: number;
  total_duration_seconds: number;
  cost_crowns: number;
}): Promise<CraftingSession> {
  const result = await query<CraftingSession>(
    `INSERT INTO crafting_sessions (character_id, recipe_id, npc_id, quantity, total_duration_seconds, cost_crowns)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.character_id, data.recipe_id, data.npc_id, data.quantity, data.total_duration_seconds, data.cost_crowns],
  );
  return result.rows[0]!;
}

export async function getSessionById(id: number): Promise<CraftingSession | null> {
  const result = await query<CraftingSession>(
    'SELECT * FROM crafting_sessions WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getActiveSessionsForCharacter(characterId: string): Promise<CraftingSession[]> {
  const result = await query<CraftingSession>(
    `SELECT * FROM crafting_sessions WHERE character_id = $1 AND status IN ('in_progress', 'completed') ORDER BY created_at`,
    [characterId],
  );
  return result.rows;
}

export async function getActiveSessionsForCharacterAtNpc(characterId: string, npcId: number): Promise<CraftingSession[]> {
  const result = await query<CraftingSession>(
    `SELECT * FROM crafting_sessions WHERE character_id = $1 AND npc_id = $2 AND status IN ('in_progress', 'completed') ORDER BY created_at`,
    [characterId, npcId],
  );
  return result.rows;
}

export async function getActiveSessionForRecipeAtNpc(characterId: string, recipeId: number, npcId: number): Promise<CraftingSession | null> {
  const result = await query<CraftingSession>(
    `SELECT * FROM crafting_sessions WHERE character_id = $1 AND recipe_id = $2 AND npc_id = $3 AND status = 'in_progress'`,
    [characterId, recipeId, npcId],
  );
  return result.rows[0] ?? null;
}

export async function getSessionCosts(sessionId: number): Promise<SessionCost[]> {
  const result = await query<SessionCost>(
    'SELECT * FROM crafting_session_costs WHERE session_id = $1',
    [sessionId],
  );
  return result.rows;
}

export async function insertSessionCost(sessionId: number, itemDefId: number, quantitySpent: number): Promise<void> {
  await query(
    'INSERT INTO crafting_session_costs (session_id, item_def_id, quantity_spent) VALUES ($1, $2, $3)',
    [sessionId, itemDefId, quantitySpent],
  );
}

export async function updateSessionStatus(id: number, status: CraftingSessionStatus): Promise<CraftingSession | null> {
  const result = await query<CraftingSession>(
    `UPDATE crafting_sessions SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status],
  );
  return result.rows[0] ?? null;
}

export async function completeExpiredSessions(characterId: string, npcId: number): Promise<number> {
  const result = await query(
    `UPDATE crafting_sessions
     SET status = 'completed'
     WHERE character_id = $1 AND npc_id = $2 AND status = 'in_progress'
       AND EXTRACT(EPOCH FROM (now() - started_at)) >= total_duration_seconds
     RETURNING id`,
    [characterId, npcId],
  );
  return result.rowCount ?? 0;
}

export async function completeAllSessionsForCharacter(characterId: string): Promise<number> {
  const result = await query(
    `UPDATE crafting_sessions SET status = 'completed' WHERE character_id = $1 AND status = 'in_progress' RETURNING id`,
    [characterId],
  );
  return result.rowCount ?? 0;
}
