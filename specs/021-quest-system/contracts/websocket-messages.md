# WebSocket Message Contract: Quest System

**Feature**: 021-quest-system | **Protocol Version**: v1 | **Date**: 2026-03-24

All messages follow the existing envelope: `{ type: string, v: 1, payload: T }`

## Client → Server Messages

### quest.list_available

Request available quests from an NPC quest giver.

```typescript
{
  type: 'quest.list_available',
  v: 1,
  payload: {
    npc_id: number;  // NPC the player is talking to
  }
}
```

**Preconditions**: Player must be at the NPC's building (validated server-side).

---

### quest.accept

Accept a quest from an NPC.

```typescript
{
  type: 'quest.accept',
  v: 1,
  payload: {
    npc_id: number;   // NPC offering the quest
    quest_id: number;  // Quest to accept
  }
}
```

**Preconditions**: Quest must be available, all prerequisites met, quest log not full.

---

### quest.complete

Turn in a completed quest at an NPC.

```typescript
{
  type: 'quest.complete',
  v: 1,
  payload: {
    character_quest_id: number;  // Player's quest instance
  }
}
```

**Preconditions**: All objectives complete, player at a valid NPC for this quest, inventory has space for item rewards.

---

### quest.abandon

Abandon an active quest.

```typescript
{
  type: 'quest.abandon',
  v: 1,
  payload: {
    character_quest_id: number;  // Player's quest instance
  }
}
```

**Preconditions**: Quest must be in 'active' status.

---

### quest.log

Request the full quest log (all active quests with progress).

```typescript
{
  type: 'quest.log',
  v: 1,
  payload: {}
}
```

---

## Server → Client Messages

### quest.available_list

Response to `quest.list_available`. Contains categorized quest lists for the NPC.

```typescript
{
  type: 'quest.available_list',
  v: 1,
  payload: {
    npc_id: number;
    available_quests: QuestDefinitionDto[];    // Can be accepted
    active_quests: CharacterQuestDto[];        // Already in progress from this NPC
    completable_quests: CharacterQuestDto[];   // Ready to turn in at this NPC
  }
}
```

---

### quest.accepted

Confirms quest was accepted.

```typescript
{
  type: 'quest.accepted',
  v: 1,
  payload: {
    quest: CharacterQuestDto;  // Full quest with 0-progress objectives
  }
}
```

---

### quest.progress

Real-time progress update for a quest objective.

```typescript
{
  type: 'quest.progress',
  v: 1,
  payload: {
    character_quest_id: number;
    objective_id: number;
    current_progress: number;
    target_quantity: number;
    is_complete: boolean;
    quest_complete: boolean;  // All objectives now done
  }
}
```

---

### quest.completed

Confirms quest turned in and rewards granted.

```typescript
{
  type: 'quest.completed',
  v: 1,
  payload: {
    character_quest_id: number;
    rewards_granted: QuestRewardDto[];
    new_crowns: number;
    updated_slots: InventorySlotDto[];  // Refreshed inventory state
  }
}
```

---

### quest.abandoned

Confirms quest was abandoned.

```typescript
{
  type: 'quest.abandoned',
  v: 1,
  payload: {
    character_quest_id: number;
  }
}
```

---

### quest.log

Full quest log response.

```typescript
{
  type: 'quest.log',
  v: 1,
  payload: {
    active_quests: CharacterQuestDto[];
  }
}
```

---

### quest.rejected

Server rejected a quest action.

```typescript
{
  type: 'quest.rejected',
  v: 1,
  payload: {
    action: string;  // 'accept' | 'complete' | 'abandon' | 'list_available'
    reason: QuestRejectionReason;
    details?: string;
  }
}
```

**Rejection reasons**:
- `NOT_AT_NPC` — Player not at the NPC's building
- `QUEST_NOT_FOUND` — Quest ID does not exist or is inactive
- `PREREQUISITES_NOT_MET` — Player doesn't meet quest prerequisites
- `QUEST_ALREADY_ACTIVE` — Player already has this quest active for current period
- `QUEST_LOG_FULL` — 25 active quest limit reached
- `QUEST_NOT_COMPLETABLE` — Not all objectives complete
- `INVENTORY_FULL` — No space for item rewards
- `INVALID_REQUEST` — Malformed payload

---

## Shared DTO Types

### QuestDefinitionDto

```typescript
interface QuestDefinitionDto {
  id: number;
  name: string;
  description: string;
  quest_type: 'main' | 'side' | 'daily' | 'weekly' | 'monthly' | 'repeatable';
  chain_id: string | null;
  chain_step: number | null;
  objectives: QuestObjectiveDto[];
  rewards: QuestRewardDto[];
  prerequisites: QuestPrerequisiteDto[];
}
```

### QuestObjectiveDto

```typescript
interface QuestObjectiveDto {
  id: number;
  objective_type: 'kill_monster' | 'collect_item' | 'craft_item' | 'spend_crowns' | 'gather_resource' | 'reach_level' | 'visit_location' | 'talk_to_npc';
  target_id: number | null;
  target_name: string | null;      // Resolved name (monster/item/NPC/zone name)
  target_icon_url: string | null;  // Resolved icon URL
  target_quantity: number;
  target_duration: number | null;  // Seconds, gather_resource only
  description: string | null;      // Optional override
  current_progress: number;        // 0 for definition DTOs, actual for character DTOs
  is_complete: boolean;
}
```

### QuestRewardDto

```typescript
interface QuestRewardDto {
  reward_type: 'item' | 'xp' | 'crowns';
  target_id: number | null;       // item_definitions.id for items
  target_name: string | null;     // Resolved item name
  target_icon_url: string | null; // Resolved icon URL
  quantity: number;
}
```

### QuestPrerequisiteDto

```typescript
interface QuestPrerequisiteDto {
  prereq_type: 'min_level' | 'has_item' | 'completed_quest' | 'class_required';
  target_id: number | null;
  target_value: number;
  description: string;  // Human-readable: "Reach level 5", "Complete 'Iron Harvest'"
}
```

### CharacterQuestDto

```typescript
interface CharacterQuestDto {
  character_quest_id: number;
  quest: QuestDefinitionDto;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  accepted_at: string;        // ISO 8601
  completed_at: string | null;
  objectives: QuestObjectiveDto[];  // With current_progress filled in
}
```

## Backward Compatibility

- All new message types — no existing messages modified
- NpcDto extended with `is_quest_giver: boolean` (additive, non-breaking)
- Protocol version remains v1
