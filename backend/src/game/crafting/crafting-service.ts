import { config } from '../../config';
import { getItemDefinitionById } from '../../db/queries/inventory';
import type { CraftingSession, CraftingRecipe, RecipeIngredient } from '../../db/queries/crafting';
import type { CraftingRecipeDto, CraftingIngredientDto, CraftingSessionDto, ItemCategory, WeaponSubtype } from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Progress calculation (wall-clock model)
// ---------------------------------------------------------------------------

export interface ProgressInfo {
  percent: number;         // 0–100
  remainingSeconds: number; // 0 if complete
  isComplete: boolean;
}

export function calculateProgress(session: CraftingSession): ProgressInfo {
  const elapsedMs = Date.now() - new Date(session.started_at).getTime();
  const elapsedSeconds = elapsedMs / 1000;
  const total = session.total_duration_seconds;

  if (elapsedSeconds >= total) {
    return { percent: 100, remainingSeconds: 0, isComplete: true };
  }

  const percent = Math.min(100, Math.max(0, (elapsedSeconds / total) * 100));
  const remaining = Math.max(0, total - elapsedSeconds);
  return { percent: Math.round(percent * 100) / 100, remainingSeconds: Math.ceil(remaining), isComplete: false };
}

// ---------------------------------------------------------------------------
// DTO builders
// ---------------------------------------------------------------------------

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

export async function buildRecipeDto(
  recipe: CraftingRecipe,
  ingredients: RecipeIngredient[],
): Promise<CraftingRecipeDto | null> {
  const outputItem = await getItemDefinitionById(recipe.output_item_id);
  if (!outputItem) return null;

  const ingredientDtos: CraftingIngredientDto[] = [];
  for (const ing of ingredients) {
    const itemDef = await getItemDefinitionById(ing.item_def_id);
    if (!itemDef) continue;
    ingredientDtos.push({
      item_def_id: ing.item_def_id,
      item_name: itemDef.name,
      item_icon_url: buildIconUrl(itemDef.icon_filename),
      quantity: ing.quantity,
    });
  }

  return {
    id: recipe.id,
    npc_id: recipe.npc_id,
    name: recipe.name,
    description: recipe.description,
    output_item: {
      id: outputItem.id,
      name: outputItem.name,
      description: outputItem.description ?? '',
      category: outputItem.category as ItemCategory,
      weapon_subtype: (outputItem.weapon_subtype as WeaponSubtype) ?? null,
      attack: outputItem.attack,
      defence: outputItem.defence,
      heal_power: outputItem.heal_power,
      food_power: outputItem.food_power,
      stack_size: outputItem.stack_size,
      icon_url: buildIconUrl(outputItem.icon_filename),
      max_mana: outputItem.max_mana,
      mana_on_hit: outputItem.mana_on_hit,
      mana_on_damage_taken: outputItem.mana_on_damage_taken,
      mana_regen: outputItem.mana_regen,
      dodge_chance: outputItem.dodge_chance,
      crit_chance: outputItem.crit_chance,
      crit_damage: outputItem.crit_damage,
    },
    output_quantity: recipe.output_quantity,
    cost_crowns: recipe.cost_crowns,
    craft_time_seconds: recipe.craft_time_seconds,
    ingredients: ingredientDtos,
  };
}

export function buildSessionDto(session: CraftingSession): CraftingSessionDto {
  const progress = calculateProgress(session);
  return {
    id: session.id,
    recipe_id: session.recipe_id,
    npc_id: session.npc_id,
    quantity: session.quantity,
    started_at: new Date(session.started_at).toISOString(),
    total_duration_seconds: session.total_duration_seconds,
    status: session.status === 'in_progress' && progress.isComplete ? 'completed' : session.status as 'in_progress' | 'completed',
    progress_percent: Math.round(progress.percent),
    remaining_seconds: progress.remainingSeconds,
  };
}
