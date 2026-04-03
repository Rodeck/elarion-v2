/**
 * WebSocket Message Contracts: Skill Development System
 * Feature: 032-skill-development
 * Protocol version: v1
 *
 * All messages use the existing WebSocket envelope format.
 * Client→Server messages are sent via client.send(type, payload).
 * Server→Client messages are received via client.on(type, handler).
 */

// ─── Client → Server ────────────────────────────────────────────────────────

/**
 * Message type: 'skill-book.use'
 * Sent when a player clicks "Use" on a skill book item in their inventory.
 */
export interface SkillBookUsePayload {
  /** Inventory slot ID of the skill book item to consume */
  slot_id: number;
}

// ─── Server → Client ────────────────────────────────────────────────────────

/**
 * Message type: 'skill-book.result'
 * Sent after successful skill book usage.
 * Accompanied by 'inventory.state' and 'loadout:state' messages.
 */
export interface SkillBookResultPayload {
  ability_id: number;
  ability_name: string;
  points_gained: number;        // 10, 20, 30, or 50
  new_points: number;           // current points after gain (0-99)
  new_level: number;            // current level after gain (1-5)
  leveled_up: boolean;          // true if level increased
  cooldown_until: string;       // ISO 8601 timestamp when cooldown expires
}

/**
 * Message type: 'skill-book.error'
 * Sent when skill book usage is rejected.
 */
export interface SkillBookErrorPayload {
  message: string;
  // Possible messages:
  // - "You haven't learned {ability_name} yet."
  // - "{ability_name} is already at maximum level."
  // - "Cooldown: {hours}h {minutes}m remaining."
  // - "Cannot use skill books during combat."
  // - "Skill book references an unknown ability."
  // - "Item not found in inventory."
}

// ─── Extended Existing Messages ─────────────────────────────────────────────

/**
 * OwnedAbilityDto is extended with skill progress fields.
 * These fields are included in the 'loadout:state' payload's owned abilities.
 *
 * Existing fields remain unchanged. New fields added:
 */
export interface OwnedAbilityProgressExtension {
  /** Current skill level (1-5). Default: 1 for abilities without progress. */
  level: number;
  /** Points accumulated toward next level (0-99). Default: 0. */
  points: number;
  /** Points needed for next level. null if at max level (5). Always 100 when not null. */
  points_to_next: number | null;
  /** ISO 8601 timestamp when skill book cooldown expires. null if no cooldown active. */
  cooldown_until: string | null;
  /** Stats at current level */
  current_level_stats: AbilityLevelStatsDto;
  /** Stats at next level. null if at max level or next level not defined. */
  next_level_stats: AbilityLevelStatsDto | null;
}

/**
 * Stat values for a single ability level.
 * Used in skill detail modal and loadout display.
 */
export interface AbilityLevelStatsDto {
  level: number;
  effect_value: number;
  mana_cost: number;
  duration_turns: number;
  cooldown_turns: number;
}

// ─── Admin API Contracts (REST — non-game-state) ────────────────────────────

/**
 * GET /api/abilities/:id/levels
 * Response: AbilityLevelStatsDto[] (0-5 entries, sorted by level ASC)
 */

/**
 * PUT /api/abilities/:id/levels
 * Request body: { levels: AbilityLevelStatsDto[] }
 * Bulk upsert — replaces all level rows for the ability.
 * Response: AbilityLevelStatsDto[] (the saved rows)
 */
