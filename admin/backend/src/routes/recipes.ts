import { Router, Request, Response } from 'express';
import {
  getAllRecipes,
  getRecipesByNpcId,
  getRecipeById,
  getRecipeIngredients,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  replaceIngredients,
  type CraftingRecipe,
  type RecipeIngredient,
} from '../../../../backend/src/db/queries/crafting';
import { getItemDefinitionById } from '../../../../backend/src/db/queries/inventory';

export const recipesRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

interface IngredientResponse {
  id: number;
  recipe_id: number;
  item_def_id: number;
  quantity: number;
  item_name: string | null;
}

interface RecipeResponse {
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
  ingredients: IngredientResponse[];
}

async function enrichIngredients(ingredients: RecipeIngredient[]): Promise<IngredientResponse[]> {
  const result: IngredientResponse[] = [];
  for (const ing of ingredients) {
    const item = await getItemDefinitionById(ing.item_def_id);
    result.push({
      id: ing.id,
      recipe_id: ing.recipe_id,
      item_def_id: ing.item_def_id,
      quantity: ing.quantity,
      item_name: item?.name ?? null,
    });
  }
  return result;
}

async function buildRecipeResponse(recipe: CraftingRecipe): Promise<RecipeResponse> {
  const ingredients = await getRecipeIngredients(recipe.id);
  return {
    id: recipe.id,
    npc_id: recipe.npc_id,
    name: recipe.name,
    description: recipe.description,
    output_item_id: recipe.output_item_id,
    output_quantity: recipe.output_quantity,
    cost_crowns: recipe.cost_crowns,
    craft_time_seconds: recipe.craft_time_seconds,
    sort_order: recipe.sort_order,
    created_at: recipe.created_at,
    ingredients: await enrichIngredients(ingredients),
  };
}

// ─── GET /api/recipes ──────────────────────────────────────────────────────────

recipesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const npcIdParam = req.query['npc_id'] as string | undefined;
    let recipes: CraftingRecipe[];

    if (npcIdParam) {
      const npcId = parseInt(npcIdParam, 10);
      if (isNaN(npcId)) return res.status(400).json({ error: 'Invalid npc_id' });
      recipes = await getRecipesByNpcId(npcId);
    } else {
      recipes = await getAllRecipes();
    }

    const response: RecipeResponse[] = [];
    for (const recipe of recipes) {
      response.push(await buildRecipeResponse(recipe));
    }

    log('info', 'recipes_listed', { admin: req.username, npc_id: npcIdParam ?? 'all', count: recipes.length });
    return res.json(response);
  } catch (err) {
    log('error', 'recipes_list_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/recipes/:id ──────────────────────────────────────────────────────

recipesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid recipe id' });
  try {
    const recipe = await getRecipeById(id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    log('info', 'recipe_fetched', { admin: req.username, recipe_id: id });
    return res.json(await buildRecipeResponse(recipe));
  } catch (err) {
    log('error', 'recipe_fetch_failed', { admin: req.username, recipe_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/recipes ─────────────────────────────────────────────────────────

recipesRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const name = body['name'] as string | undefined;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const npcId = body['npc_id'] != null ? Number(body['npc_id']) : NaN;
  if (isNaN(npcId) || !Number.isInteger(npcId)) {
    return res.status(400).json({ error: 'npc_id is required and must be an integer' });
  }
  const outputItemId = body['output_item_id'] != null ? Number(body['output_item_id']) : NaN;
  if (isNaN(outputItemId) || !Number.isInteger(outputItemId)) {
    return res.status(400).json({ error: 'output_item_id is required and must be an integer' });
  }
  const outputQuantity = body['output_quantity'] != null ? Number(body['output_quantity']) : NaN;
  if (isNaN(outputQuantity) || !Number.isInteger(outputQuantity) || outputQuantity < 1) {
    return res.status(400).json({ error: 'output_quantity is required and must be a positive integer' });
  }
  const costCrowns = body['cost_crowns'] != null ? Number(body['cost_crowns']) : NaN;
  if (isNaN(costCrowns) || !Number.isInteger(costCrowns) || costCrowns < 0) {
    return res.status(400).json({ error: 'cost_crowns is required and must be a non-negative integer' });
  }
  const craftTimeSeconds = body['craft_time_seconds'] != null ? Number(body['craft_time_seconds']) : NaN;
  if (isNaN(craftTimeSeconds) || !Number.isInteger(craftTimeSeconds) || craftTimeSeconds < 0) {
    return res.status(400).json({ error: 'craft_time_seconds is required and must be a non-negative integer' });
  }

  const ingredients = body['ingredients'] as { item_def_id: number; quantity: number }[] | undefined;
  if (ingredients !== undefined && !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'ingredients must be an array' });
  }
  if (ingredients) {
    for (const ing of ingredients) {
      if (!ing.item_def_id || !Number.isInteger(ing.item_def_id)) {
        return res.status(400).json({ error: 'Each ingredient must have a valid item_def_id' });
      }
      if (!ing.quantity || !Number.isInteger(ing.quantity) || ing.quantity < 1) {
        return res.status(400).json({ error: 'Each ingredient must have a positive quantity' });
      }
    }
  }

  try {
    const recipe = await createRecipe({
      npc_id: npcId,
      name: name.trim(),
      description: body['description'] ? String(body['description']) : null,
      output_item_id: outputItemId,
      output_quantity: outputQuantity,
      cost_crowns: costCrowns,
      craft_time_seconds: craftTimeSeconds,
      sort_order: body['sort_order'] != null ? Number(body['sort_order']) : undefined,
    });

    if (ingredients && ingredients.length > 0) {
      await replaceIngredients(recipe.id, ingredients);
    }

    log('info', 'recipe_created', { admin: req.username, recipe_id: recipe.id, name: recipe.name });
    return res.status(201).json(await buildRecipeResponse(recipe));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Recipe name already exists for this NPC' });
    }
    log('error', 'recipe_create_failed', { admin: req.username, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/recipes/:id ──────────────────────────────────────────────────────

recipesRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid recipe id' });

  const existing = await getRecipeById(id);
  if (!existing) return res.status(404).json({ error: 'Recipe not found' });

  const body = req.body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (body['name'] !== undefined) {
    const name = body['name'] as string;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    updateData['name'] = name.trim();
  }
  if (body['description'] !== undefined) updateData['description'] = body['description'] || null;
  if (body['output_item_id'] !== undefined) {
    const v = Number(body['output_item_id']);
    if (!Number.isInteger(v)) return res.status(400).json({ error: 'output_item_id must be an integer' });
    updateData['output_item_id'] = v;
  }
  if (body['output_quantity'] !== undefined) {
    const v = Number(body['output_quantity']);
    if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: 'output_quantity must be a positive integer' });
    updateData['output_quantity'] = v;
  }
  if (body['cost_crowns'] !== undefined) {
    const v = Number(body['cost_crowns']);
    if (!Number.isInteger(v) || v < 0) return res.status(400).json({ error: 'cost_crowns must be a non-negative integer' });
    updateData['cost_crowns'] = v;
  }
  if (body['craft_time_seconds'] !== undefined) {
    const v = Number(body['craft_time_seconds']);
    if (!Number.isInteger(v) || v < 0) return res.status(400).json({ error: 'craft_time_seconds must be a non-negative integer' });
    updateData['craft_time_seconds'] = v;
  }
  if (body['sort_order'] !== undefined) {
    const v = Number(body['sort_order']);
    if (!Number.isInteger(v)) return res.status(400).json({ error: 'sort_order must be an integer' });
    updateData['sort_order'] = v;
  }

  try {
    const updated = await updateRecipe(id, updateData as Parameters<typeof updateRecipe>[1]);
    if (!updated) return res.status(404).json({ error: 'Recipe not found' });

    // Replace ingredients if provided
    if (body['ingredients'] !== undefined) {
      const ingredients = body['ingredients'] as { item_def_id: number; quantity: number }[];
      if (!Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'ingredients must be an array' });
      }
      for (const ing of ingredients) {
        if (!ing.item_def_id || !Number.isInteger(ing.item_def_id)) {
          return res.status(400).json({ error: 'Each ingredient must have a valid item_def_id' });
        }
        if (!ing.quantity || !Number.isInteger(ing.quantity) || ing.quantity < 1) {
          return res.status(400).json({ error: 'Each ingredient must have a positive quantity' });
        }
      }
      await replaceIngredients(id, ingredients);
    }

    log('info', 'recipe_updated', { admin: req.username, recipe_id: id, fields_changed: Object.keys(updateData) });
    return res.json(await buildRecipeResponse(updated));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Recipe name already exists for this NPC' });
    }
    log('error', 'recipe_update_failed', { admin: req.username, recipe_id: id, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/recipes/:id ───────────────────────────────────────────────────

recipesRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid recipe id' });

  try {
    const recipe = await getRecipeById(id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    await deleteRecipe(id);

    log('info', 'recipe_deleted', { admin: req.username, recipe_id: id });
    return res.status(204).send();
  } catch (err) {
    log('error', 'recipe_delete_failed', { admin: req.username, recipe_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
