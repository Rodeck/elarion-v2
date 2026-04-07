import { registerSpellStateHandlers } from './spell-state-handler';
import { registerSpellBookHandlers } from './spell-book-handler';
import { registerSpellCastHandlers } from './spell-cast-handler';

/**
 * Register all spell system WebSocket handlers.
 * Called once during bootstrap.
 */
export function registerSpellHandlers(): void {
  registerSpellStateHandlers();
  registerSpellBookHandlers();
  registerSpellCastHandlers();
}
