import { query, getClient } from '../connection';
import { config } from '../../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisassemblyRecipe {
  id: number;
  item_def_id: number;
  chance_percent: number;
  sort_order: number;
  created_at: Date;
}

export interface DisassemblyRecipeOutput {
  id: number;
  recipe_id: number;
  output_item_def_id: number;
  quantity: number;
}

/** Joined recipe + outputs for game logic */
export interface RecipeWithOutputs {
  id: number;
  item_def_id: number;
  chance_percent: number;
  sort_order: number;
  outputs: {
    output_item_def_id: number;
    output_item_name: string;
    output_icon_url: string | null;
    quantity: number;
  }[];
}

// ---------------------------------------------------------------------------
// Game queries (used by disassembly-service)
// ---------------------------------------------------------------------------

/** Get all recipes with outputs for a single item definition. */
export async function getRecipesByItemDefId(itemDefId: number): Promise<RecipeWithOutputs[]> {
  const recipesResult = await query<DisassemblyRecipe>(
    'SELECT * FROM disassembly_recipes WHERE item_def_id = $1 ORDER BY sort_order, id',
    [itemDefId],
  );

  const recipes: RecipeWithOutputs[] = [];
  for (const r of recipesResult.rows) {
    const outputsResult = await query<{
      output_item_def_id: number;
      quantity: number;
      name: string;
      icon_filename: string | null;
    }>(
      `SELECT o.output_item_def_id, o.quantity, d.name, d.icon_filename
       FROM disassembly_recipe_outputs o
       JOIN item_definitions d ON d.id = o.output_item_def_id
       WHERE o.recipe_id = $1
       ORDER BY o.id`,
      [r.id],
    );

    recipes.push({
      id: r.id,
      item_def_id: r.item_def_id,
      chance_percent: r.chance_percent,
      sort_order: r.sort_order,
      outputs: outputsResult.rows.map((o) => ({
        output_item_def_id: o.output_item_def_id,
        output_item_name: o.name,
        output_icon_url: o.icon_filename ? `${config.adminBaseUrl}/item-icons/${o.icon_filename}` : null,
        quantity: o.quantity,
      })),
    });
  }

  return recipes;
}

/** Batch: get recipes for multiple item def IDs at once. Returns a map keyed by item_def_id. */
export async function getRecipesForItemDefIds(
  itemDefIds: number[],
): Promise<Map<number, RecipeWithOutputs[]>> {
  const map = new Map<number, RecipeWithOutputs[]>();
  if (itemDefIds.length === 0) return map;

  // Fetch all recipes for the given item defs
  const recipesResult = await query<DisassemblyRecipe>(
    `SELECT * FROM disassembly_recipes
     WHERE item_def_id = ANY($1)
     ORDER BY item_def_id, sort_order, id`,
    [itemDefIds],
  );

  if (recipesResult.rows.length === 0) return map;

  const recipeIds = recipesResult.rows.map((r) => r.id);

  // Fetch all outputs for all recipes in one query
  const outputsResult = await query<{
    recipe_id: number;
    output_item_def_id: number;
    quantity: number;
    name: string;
    icon_filename: string | null;
  }>(
    `SELECT o.recipe_id, o.output_item_def_id, o.quantity, d.name, d.icon_filename
     FROM disassembly_recipe_outputs o
     JOIN item_definitions d ON d.id = o.output_item_def_id
     WHERE o.recipe_id = ANY($1)
     ORDER BY o.recipe_id, o.id`,
    [recipeIds],
  );

  // Group outputs by recipe_id
  const outputsByRecipe = new Map<number, typeof outputsResult.rows>();
  for (const o of outputsResult.rows) {
    const arr = outputsByRecipe.get(o.recipe_id) ?? [];
    arr.push(o);
    outputsByRecipe.set(o.recipe_id, arr);
  }

  // Build the map
  for (const r of recipesResult.rows) {
    const outputs = (outputsByRecipe.get(r.id) ?? []).map((o) => ({
      output_item_def_id: o.output_item_def_id,
      output_item_name: o.name,
      output_icon_url: o.icon_filename ? `${config.adminBaseUrl}/item-icons/${o.icon_filename}` : null,
      quantity: o.quantity,
    }));

    const arr = map.get(r.item_def_id) ?? [];
    arr.push({
      id: r.id,
      item_def_id: r.item_def_id,
      chance_percent: r.chance_percent,
      sort_order: r.sort_order,
      outputs,
    });
    map.set(r.item_def_id, arr);
  }

  return map;
}

/** Check if an item definition has any disassembly recipes. */
export async function hasDisassemblyRecipes(itemDefId: number): Promise<boolean> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM disassembly_recipes WHERE item_def_id = $1',
    [itemDefId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

/** Get the disassembly_cost for an item definition. */
export async function getDisassemblyCost(itemDefId: number): Promise<number> {
  const result = await query<{ disassembly_cost: number }>(
    'SELECT disassembly_cost FROM item_definitions WHERE id = $1',
    [itemDefId],
  );
  return result.rows[0]?.disassembly_cost ?? 0;
}

// ---------------------------------------------------------------------------
// Admin queries (used by admin routes)
// ---------------------------------------------------------------------------

/** Get full recipe tree for admin editing. */
export async function getRecipesWithOutputsForAdmin(
  itemDefId: number,
): Promise<{ id: number; chance_percent: number; sort_order: number; outputs: { output_item_def_id: number; quantity: number }[] }[]> {
  const recipesResult = await query<DisassemblyRecipe>(
    'SELECT * FROM disassembly_recipes WHERE item_def_id = $1 ORDER BY sort_order, id',
    [itemDefId],
  );

  const result: { id: number; chance_percent: number; sort_order: number; outputs: { output_item_def_id: number; quantity: number }[] }[] = [];

  for (const r of recipesResult.rows) {
    const outputsResult = await query<DisassemblyRecipeOutput>(
      'SELECT * FROM disassembly_recipe_outputs WHERE recipe_id = $1 ORDER BY id',
      [r.id],
    );
    result.push({
      id: r.id,
      chance_percent: r.chance_percent,
      sort_order: r.sort_order,
      outputs: outputsResult.rows.map((o) => ({
        output_item_def_id: o.output_item_def_id,
        quantity: o.quantity,
      })),
    });
  }

  return result;
}

/** Replace all recipes for an item definition (delete-then-reinsert in transaction). */
export async function saveRecipesForItem(
  itemDefId: number,
  recipes: { chance_percent: number; sort_order: number; outputs: { output_item_def_id: number; quantity: number }[] }[],
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Delete existing recipes (CASCADE deletes outputs)
    await client.query('DELETE FROM disassembly_recipes WHERE item_def_id = $1', [itemDefId]);

    // Insert new recipes
    for (const recipe of recipes) {
      const recipeResult = await client.query<{ id: number }>(
        `INSERT INTO disassembly_recipes (item_def_id, chance_percent, sort_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [itemDefId, recipe.chance_percent, recipe.sort_order],
      );
      const recipeId = recipeResult.rows[0].id;

      for (const output of recipe.outputs) {
        await client.query(
          `INSERT INTO disassembly_recipe_outputs (recipe_id, output_item_def_id, quantity)
           VALUES ($1, $2, $3)`,
          [recipeId, output.output_item_def_id, output.quantity],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Delete all recipes for an item definition. */
export async function deleteRecipesByItemDefId(itemDefId: number): Promise<void> {
  await query('DELETE FROM disassembly_recipes WHERE item_def_id = $1', [itemDefId]);
}
