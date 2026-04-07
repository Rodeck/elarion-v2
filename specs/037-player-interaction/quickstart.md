# Quickstart: Player Interaction Panel

**Feature**: 037-player-interaction | **Date**: 2026-04-07

## What This Feature Does

Replaces the Combat Log panel (bottom-right) with a Nearby Players panel that shows other players at the same city map node. Clicking a player name opens a detail modal with their name, level, and a placeholder icon. The modal live-updates if the target player leaves or returns.

## Scope

**Frontend only** — no backend, database, or protocol changes.

### Files to Create
- `frontend/src/ui/NearbyPlayersPanel.ts` — HTML panel component (replaces CombatLog)
- `frontend/src/ui/PlayerDetailModal.ts` — HTML modal component

### Files to Modify
- `frontend/src/scenes/GameScene.ts` — Replace CombatLog with NearbyPlayersPanel; track remote player node_ids; wire modal; redirect server.error to chat
- `frontend/src/ui/ChatBox.ts` — Add `addSystemMessage()` method (if not present) for server error display

### Files to Remove (from usage, not deleted)
- `frontend/src/ui/CombatLog.ts` — No longer imported or instantiated in GameScene

## Prerequisites

- Two browser sessions (or two accounts) to test player co-location
- Running backend with city map zone

## How to Test

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open two browser tabs, log in with different accounts
4. Navigate both characters to the same city map node (building or path)
5. Verify each sees the other in the Nearby Players panel
6. Click a player name → modal opens with name, level, placeholder icon
7. Move one character away → "player left" notice appears in the modal
8. Move them back → notice disappears
9. Close modal → normal behavior

## Architecture Notes

- NearbyPlayersPanel maintains a `Map<string, RemotePlayerInfo>` tracking all remote players' node_ids
- Co-located players = remote players where `remotePlayer.nodeId === myCharacter.current_node_id`
- Panel re-renders on: own movement, any remote player movement, player enter/leave zone
- Modal state tracks `targetId` and `isPresent` boolean; updates reactively
- On tile maps (non-city), panel shows empty state (no node-based tracking)
