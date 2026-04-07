import type { AuthenticatedSession } from '../../websocket/server';
import type { Character } from '../../db/queries/characters';
import type { Monster } from '../../db/queries/monsters';
import { log } from '../../logger';
import { computeCombatStats } from './combat-stats-service';
import { getCharacterLoadout } from '../../db/queries/loadouts';
import { setCharacterInCombat } from '../../db/queries/loadouts';
import { CombatSession } from './combat-session';

export type CombatEndCallback = (characterId: string, outcome: 'win' | 'loss') => void;

class CombatSessionManagerImpl {
  private sessions = new Map<string, CombatSession>();
  private onEndCallbacks = new Map<string, CombatEndCallback>();

  async start(
    wsSession: AuthenticatedSession,
    character: Character,
    monster: Monster,
  ): Promise<void> {
    if (this.sessions.has(character.id)) {
      log('warn', 'combat', 'session_already_active', { characterId: character.id });
      return;
    }

    try {
      const stats = await computeCombatStats(character.id);
      const loadoutSlots = await getCharacterLoadout(character.id);
      await setCharacterInCombat(character.id, true);

      const session = new CombatSession(wsSession, character, monster, stats, loadoutSlots);
      this.sessions.set(character.id, session);
      await session.start();
    } catch (err) {
      log('error', 'combat', 'session_start_failed', { characterId: character.id, err });
      await setCharacterInCombat(character.id, false).catch(() => undefined);
    }
  }

  get(characterId: string): CombatSession | undefined {
    return this.sessions.get(characterId);
  }

  end(characterId: string, outcome?: 'win' | 'loss'): void {
    this.sessions.delete(characterId);
    const cb = this.onEndCallbacks.get(characterId);
    if (cb && outcome) {
      this.onEndCallbacks.delete(characterId);
      cb(characterId, outcome);
    } else if (cb) {
      this.onEndCallbacks.delete(characterId);
    }
  }

  /** Register a one-time callback that fires when combat ends for this character. */
  registerOnEnd(characterId: string, callback: CombatEndCallback): void {
    this.onEndCallbacks.set(characterId, callback);
  }

  has(characterId: string): boolean {
    return this.sessions.has(characterId);
  }
}

export const CombatSessionManager = new CombatSessionManagerImpl();
