# Arena System — WebSocket Protocol Contract

**Branch**: `029-arena-system` | **Date**: 2026-04-01 | **Protocol Version**: v1

## New Shared Types

All types added to `shared/protocol/index.ts`.

```typescript
// --- Arena DTOs ---

interface ArenaDto {
  id: number;
  name: string;
  building_id: number;
  min_stay_seconds: number;
  reentry_cooldown_seconds: number;
  level_bracket: number;
}

interface ArenaParticipantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  in_combat: boolean;
  entered_at: string;
}

interface ArenaCombatantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  max_hp: number;
  attack: number;
  defence: number;
}

interface ArenaBuildingActionDto {
  id: number;
  action_type: 'arena';
  sort_order: number;
  arena_id: number;
  arena_name: string;
}

// --- Arena Payloads ---

interface ArenaEnteredPayload {
  arena: ArenaDto;
  participants: ArenaParticipantDto[];
  monsters: MonsterCombatDto[];
  can_leave_at: string;
  current_hp: number;
  max_hp: number;
}

interface ArenaEnterRejectedPayload {
  reason: 'cooldown' | 'in_combat' | 'in_gathering' | 'already_in_arena' | 'inactive' | 'not_found';
  message: string;
  cooldown_until?: string;
}

interface ArenaLeftPayload {
  arena_id: number;
  cooldown_until: string;
}

interface ArenaLeaveRejectedPayload {
  reason: 'too_early' | 'in_combat';
  message: string;
  can_leave_at: string;
}

interface ArenaPlayerEnteredPayload {
  participant: ArenaParticipantDto;
}

interface ArenaPlayerLeftPayload {
  character_id: string;
}

interface ArenaChallengeRejectedPayload {
  reason: 'not_in_arena' | 'target_not_found' | 'target_in_combat' | 'self_in_combat' | 'level_bracket' | 'no_token' | 'monster_not_found';
  message: string;
}

interface ArenaCombatStartPayload {
  combat_id: string;
  opponent: ArenaCombatantDto;
  player: PlayerCombatStateDto;
  loadout: { slots: AbilityStateDto[] };
  is_pvp: boolean;
  turn_timer_ms: number;
}

interface ArenaCombatActiveWindowPayload {
  combat_id: string;
  timer_ms: number;
  ability: AbilityStateDto | null;
}

interface ArenaCombatTurnResultPayload {
  combat_id: string;
  turn: number;
  phase: 'player' | 'enemy';
  events: CombatEventDto[];
  player_hp: number;
  player_mana: number;
  opponent_hp: number;
  ability_states: AbilityStateDto[];
  active_effects: ActiveEffectDto[];
}

interface ArenaCombatEndPayload {
  combat_id: string;
  outcome: 'victory' | 'defeat';
  current_hp: number;
  xp_gained: number;
  crowns_gained: number;
  opponent_name: string;
  is_pvp: boolean;
}

interface ArenaParticipantUpdatedPayload {
  character_id: string;
  in_combat: boolean;
}

interface ArenaKickedPayload {
  reason: 'defeat' | 'admin' | 'arena_closed';
  message: string;
  cooldown_until: string;
}
```

## Message Catalog

### Client → Server Messages

---

#### `arena:enter`

**Direction**: Client → Server  
**Purpose**: Player requests to enter an arena via a building action  
**Trigger**: Player clicks the arena building action button

```typescript
{ action_id: number }
```

**Example**:
```json
{ "type": "arena:enter", "v": 1, "payload": { "action_id": 42 } }
```

**Responses**: `arena:entered` (success) or `arena:enter_rejected` (failure)

---

#### `arena:leave`

**Direction**: Client → Server  
**Purpose**: Player requests to voluntarily leave the arena  
**Trigger**: Player clicks Leave button after min stay time elapsed

```typescript
{ arena_id: number }
```

**Responses**: `arena:left` (success) or `arena:leave_rejected` (failure)

---

#### `arena:challenge_player`

**Direction**: Client → Server  
**Purpose**: Challenge another player in the arena to PvP combat  
**Trigger**: Player clicks Challenge button next to an arena participant

```typescript
{ target_character_id: string }
```

**Responses**: `arena:combat_start` (both players) or `arena:challenge_rejected` (challenger only)

---

#### `arena:challenge_npc`

**Direction**: Client → Server  
**Purpose**: Challenge an arena NPC fighter (consumes Arena Challenge Token)  
**Trigger**: Player clicks Challenge button next to a fighter

```typescript
{ monster_id: number }
```

**Responses**: `arena:combat_start` (success) or `arena:challenge_rejected` (failure)

---

#### `arena:combat_trigger_active`

**Direction**: Client → Server  
**Purpose**: Fire the active ability during the combat active window  
**Trigger**: Player clicks active ability button or it auto-fires on timer

```typescript
{ combat_id: string }
```

**Responses**: Incorporated into next `arena:combat_turn_result`

---

### Server → Client Messages

---

#### `arena:entered`

**Direction**: Server → Client (to entering player only)  
**Purpose**: Confirms arena entry with full arena state  
**Trigger**: Successful arena entry validation

**Payload**: `ArenaEnteredPayload`

---

#### `arena:enter_rejected`

**Direction**: Server → Client (to requesting player only)  
**Purpose**: Rejects arena entry with reason  

**Payload**: `ArenaEnterRejectedPayload`

---

#### `arena:left`

**Direction**: Server → Client (to leaving player only)  
**Purpose**: Confirms arena exit and applies cooldown  

**Payload**: `ArenaLeftPayload`

---

#### `arena:leave_rejected`

**Direction**: Server → Client (to requesting player only)  
**Purpose**: Rejects leave attempt (min stay time not reached or in combat)  

**Payload**: `ArenaLeaveRejectedPayload`

---

#### `arena:player_entered`

**Direction**: Server → Client (broadcast to all arena participants)  
**Purpose**: Notifies existing participants that a new player joined  

**Payload**: `ArenaPlayerEnteredPayload`

---

#### `arena:player_left`

**Direction**: Server → Client (broadcast to all arena participants)  
**Purpose**: Notifies participants that a player left or was kicked  

**Payload**: `ArenaPlayerLeftPayload`

---

#### `arena:combat_start`

**Direction**: Server → Client (to both combatants)  
**Purpose**: Combat begins — sends opponent info and player's combat state  

**Payload**: `ArenaCombatStartPayload`

Each player receives their own perspective: their stats as `player`, opponent as `opponent`.

---

#### `arena:combat_active_window`

**Direction**: Server → Client (to both combatants)  
**Purpose**: Opens the active ability window for both players simultaneously  

**Payload**: `ArenaCombatActiveWindowPayload`

---

#### `arena:combat_turn_result`

**Direction**: Server → Client (to both combatants)  
**Purpose**: Turn resolution results from each player's perspective  

**Payload**: `ArenaCombatTurnResultPayload`

Each player receives events from their own perspective (their attacks show as `source: 'player'`, opponent's as `source: 'enemy'`).

---

#### `arena:combat_end`

**Direction**: Server → Client (to both combatants)  
**Purpose**: Combat ended — outcome, rewards, and final HP  

**Payload**: `ArenaCombatEndPayload`

Winner receives `outcome: 'victory'`, loser receives `outcome: 'defeat'`.

---

#### `arena:participant_updated`

**Direction**: Server → Client (broadcast to all arena participants)  
**Purpose**: Combat status changed for a participant (started or ended fighting)  

**Payload**: `ArenaParticipantUpdatedPayload`

---

#### `arena:challenge_rejected`

**Direction**: Server → Client (to challenger only)  
**Purpose**: Challenge rejected with reason  

**Payload**: `ArenaChallengeRejectedPayload`

---

#### `arena:kicked`

**Direction**: Server → Client (to kicked player only)  
**Purpose**: Player was kicked from arena (lost fight, admin action, or arena closed)  

**Payload**: `ArenaKickedPayload`

---

## Message Flow Diagrams

### Arena Entry Flow

```
Player                    Server                    Zone Players
  │                         │                           │
  │── arena:enter ─────────►│                           │
  │                         │── validate ──►            │
  │                         │   (cooldown, combat,      │
  │                         │    gathering, already in)  │
  │◄── arena:entered ──────│                           │
  │                         │── player.left_zone ──────►│
  │                         │                           │
  │                         │── arena:player_entered ──►│ (arena participants)
```

### PvP Challenge Flow

```
Player A                  Server                    Player B
  │                         │                           │
  │── arena:challenge ─────►│                           │
  │     _player             │── validate ──►            │
  │                         │   (both in arena,         │
  │                         │    neither in combat,     │
  │                         │    level bracket)         │
  │◄── arena:combat ───────│── arena:combat ──────────►│
  │     _start              │     _start                │
  │                         │                           │
  │                         │── arena:participant ─────►│ (all participants)
  │                         │     _updated              │
  │                         │                           │
  │  ┌─── TURN LOOP ───────────────────────────────┐   │
  │  │                      │                       │   │
  │  │ Server resolves both sides simultaneously    │   │
  │  │                      │                       │   │
  │◄─┤ arena:combat ───────│── arena:combat ───────┤──►│
  │  │  _turn_result        │     _turn_result      │   │
  │  │                      │                       │   │
  │◄─┤ arena:combat ───────│── arena:combat ───────┤──►│
  │  │  _active_window      │     _active_window    │   │
  │  │                      │                       │   │
  │──┤ arena:combat ───────►│◄── arena:combat ─────┤───│
  │  │  _trigger_active     │     _trigger_active   │   │
  │  │                      │                       │   │
  │  └─── REPEAT ──────────────────────────────────┘   │
  │                         │                           │
  │◄── arena:combat ───────│── arena:combat ──────────►│
  │     _end (victory)      │     _end (defeat)         │
  │                         │                           │
  │                         │── arena:kicked ──────────►│ (to loser)
  │                         │── player.entered_zone ───►│ (zone players)
  │                         │── arena:player_left ─────►│ (arena participants)
  │                         │── arena:participant ─────►│ (arena participants)
  │                         │     _updated              │
```

## Protocol Compatibility

This is a new feature — no backward compatibility concerns. All message types use the `arena:` prefix namespace. Existing combat messages (`combat:*`, `boss:*`) are unmodified.
