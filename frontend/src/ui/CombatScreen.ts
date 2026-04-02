/**
 * CombatScreen.ts
 *
 * Pokemon-style combat modal.
 * Opens on combat:start, updates on each turn event, closes after combat:end.
 */

import type {
  CombatStartPayload,
  CombatTurnResultPayload,
  CombatActiveWindowPayload,
  CombatEndPayload,
  CombatEventDto,
  CombatAbilityStateDto,
  ActiveEffectDto,
  BossCombatStartPayload,
  BossCombatTurnResultPayload,
  BossCombatEndPayload,
  BossHpBracket,
} from '../../../shared/protocol/index';
import { getXpIconUrl, getCrownsIconUrl } from './ui-icons';

// Border style constants
const BORDER_IDLE   = '3px solid #5a4a2a';
const BORDER_ACTIVE = '3px solid #f0c060';
const SHADOW_ACTIVE = '0 0 12px rgba(240,192,96,0.7)';
const SHADOW_IDLE   = 'none';

// Timing sequence: turn indicator → pause → attack anims → floating numbers → HP update
const COMBAT_OPEN_SETTLE_MS = 1200;   // grace period after combat opens before processing turns
const TURN_INDICATOR_PAUSE_MS = 400;  // pause after turn indicator before attack plays
const ATTACK_ANIM_DURATION_MS = 450;  // how long the slash/shake takes before numbers show
const FLOAT_TO_HP_DELAY_MS = 300;     // extra delay after floating numbers before HP bar drops

export class CombatScreen {
  private overlay: HTMLElement | null = null;
  private onTriggerActive: () => void;
  private onClose: (() => void) | null = null;

  /** When true, combat UI is rendered inside an external container (no backdrop) */
  private embedded = false;

  /** 'normal' for regular monster combat, 'boss' for boss encounters */
  private variant: 'normal' | 'boss' = 'normal';

  // State stored from combat:start
  private combatId: string | null = null;
  private playerMaxHp = 0;
  private playerMaxMana = 0;
  private enemyMaxHp = 0;

  // Boss bracket segments (only used when variant === 'boss')
  private bossBracketSegments: HTMLElement[] = [];
  private currentBossHpBracket: BossHpBracket = 'full';
  private bossAbilitySlotsEl: HTMLElement | null = null;
  private bossName: string | null = null;

  // DOM refs
  private enemyIconEl: HTMLElement | null = null;
  private playerIconEl: HTMLElement | null = null;
  private enemyHpBar: HTMLElement | null = null;
  private enemyHpText: HTMLElement | null = null;
  private playerHpBar: HTMLElement | null = null;
  private playerHpText: HTMLElement | null = null;
  private playerManaBar: HTMLElement | null = null;
  private playerManaText: HTMLElement | null = null;
  private autoIndicatorsEl: HTMLElement | null = null;
  private activeButtonEl: HTMLButtonElement | null = null;
  private activeTimerEl: HTMLElement | null = null;
  private combatLogEl: HTMLElement | null = null;
  private activeTooltipEl: HTMLElement | null = null;

  // Buff/debuff indicator containers (flanking icons)
  private playerDebuffsEl: HTMLElement | null = null;
  private playerBuffsEl: HTMLElement | null = null;
  private enemyDebuffsEl: HTMLElement | null = null;
  private enemyBuffsEl: HTMLElement | null = null;
  private effectTooltipEl: HTMLElement | null = null;

  // Settle queue — buffers messages arriving before the player has focused on the UI
  private readyTime = 0;
  private pendingQueue: Array<{ type: 'turn'; payload: CombatTurnResultPayload } | { type: 'active'; payload: CombatActiveWindowPayload }> = [];
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  // Active window
  private activeWindowInterval: ReturnType<typeof setInterval> | null = null;
  private activeWindowEndTime = 0;
  private activeAbilityName: string | null = null;

  constructor(onTriggerActive: () => void) {
    this.onTriggerActive = onTriggerActive;
  }

  setOnClose(cb: () => void): void {
    this.onClose = cb;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  open(payload: CombatStartPayload): void {
    this.close();

    this.variant       = 'normal';
    this.embedded      = false;
    this.combatId      = payload.combat_id;
    this.playerMaxHp   = payload.player.max_hp;
    this.playerMaxMana = payload.player.max_mana;
    this.enemyMaxHp    = payload.monster.max_hp;

    this.ensureFlashStyles();
    this.buildOverlay(payload);
    this.readyTime = Date.now() + COMBAT_OPEN_SETTLE_MS;
  }

  /** Initialize boss combat variant. */
  showBoss(payload: BossCombatStartPayload): void {
    this.close();

    this.variant       = 'boss';
    this.embedded      = false;
    this.combatId      = payload.combat_id;
    this.playerMaxHp   = payload.player.max_hp;
    this.playerMaxMana = payload.player.max_mana;
    this.enemyMaxHp    = 0; // Boss HP is hidden
    this.currentBossHpBracket = payload.boss.hp_bracket;

    // Convert BossCombatStartPayload to CombatStartPayload shape for buildOverlay
    const asStartPayload: CombatStartPayload = {
      combat_id: payload.combat_id,
      monster: {
        id: payload.boss.id,
        name: payload.boss.name,
        icon_url: payload.boss.icon_url,
        max_hp: 0,
        attack: payload.boss.attack,
        defence: payload.boss.defense,
      },
      player: payload.player,
      loadout: payload.loadout,
      turn_timer_ms: payload.turn_timer_ms,
      active_effects: payload.active_effects ?? [],
    };

    this.bossName = payload.boss.name;

    this.ensureFlashStyles();
    this.buildOverlay(asStartPayload);

    // Replace enemy HP bar with boss bracket indicator
    this.replaceBossHpBar(payload.boss.hp_bracket);

    // Enlarge boss name
    this.enlargeBossName();

    // Add boss ability slots under the boss icon
    this.buildBossAbilitySlots(payload.boss.abilities);

    this.readyTime = Date.now() + COMBAT_OPEN_SETTLE_MS;
  }

  /** Handle boss turn result — same as regular but uses bracket instead of exact HP. */
  updateBossTurn(payload: BossCombatTurnResultPayload): void {
    if (!this.overlay) return;

    // If the UI hasn't settled yet, queue and drain later (reuse turn queue path)
    if (Date.now() < this.readyTime) {
      // Wrap as a normal turn payload for the queue with a sentinel enemy_hp
      const wrapped: CombatTurnResultPayload = {
        combat_id: payload.combat_id,
        turn: payload.turn,
        phase: payload.phase,
        events: payload.events,
        player_hp: payload.player_hp,
        player_mana: payload.player_mana,
        enemy_hp: -1, // sentinel — boss HP is handled via bracket
        ability_states: payload.ability_states,
        active_effects: payload.active_effects ?? [],
      };
      this.pendingQueue.push({ type: 'turn', payload: wrapped });
      this.currentBossHpBracket = payload.enemy_hp_bracket;
      this.scheduleDrain();
      return;
    }

    this.currentBossHpBracket = payload.enemy_hp_bracket;
    this.updateAbilityStates(payload.ability_states);
    this.updateActiveEffects(payload.active_effects ?? []);

    for (const evt of payload.events) {
      this.appendLogLine(this.formatEvent(evt));
    }

    const lastAttack = [...payload.events].reverse().find(
      (e) => e.kind === 'auto_attack' || e.kind === 'ability_fired',
    );

    const hasAttack = !!lastAttack;
    const isEnemyTurn = hasAttack && lastAttack.source !== 'player';

    if (isEnemyTurn) {
      this.setTurnIndicator('enemy');
    } else if (hasAttack) {
      this.setTurnIndicator('player');
    }

    const attackDelay = hasAttack ? TURN_INDICATOR_PAUSE_MS : 0;

    setTimeout(() => {
      if (!this.overlay) return;
      // Flash abilities — reuse the same payload shape
      const wrappedForFlash = {
        ...payload,
        enemy_hp: -1,
      } as unknown as CombatTurnResultPayload;
      this.flashFiredAbilities(wrappedForFlash);
      this.spawnCombatEffects(payload.events, hasAttack ? ATTACK_ANIM_DURATION_MS : 0);
    }, attackDelay);

    const hpDelay = attackDelay + (hasAttack ? ATTACK_ANIM_DURATION_MS + FLOAT_TO_HP_DELAY_MS : 0);

    if (isEnemyTurn) {
      this.setBossBracket(payload.enemy_hp_bracket);
      this.setPlayerMana(payload.player_mana);
      setTimeout(() => {
        if (!this.overlay) return;
        this.setPlayerHp(payload.player_hp);
      }, hpDelay);
    } else {
      setTimeout(() => {
        if (!this.overlay) return;
        this.setBossBracket(payload.enemy_hp_bracket);
        this.setPlayerHp(payload.player_hp);
        this.setPlayerMana(payload.player_mana);
      }, hpDelay);
    }
  }

  /** Show boss combat outcome screen. */
  showBossEnd(payload: BossCombatEndPayload): void {
    this.clearActiveWindowTimer();
    this.ensureFlashStyles();
    this.clearSettleTimer();
    this.pendingQueue = [];

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    const win = payload.outcome === 'win';

    const overlay = document.createElement('div');
    overlay.className = 'cs-victory-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:300',
      'background:rgba(0,0,0,0.65)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:Cinzel,serif', 'color:#c9a55c',
    ].join(';');

    const modal = document.createElement('div');
    modal.className = 'cs-victory-modal';
    modal.style.cssText = [
      'position:relative',
      'width:400px', 'max-width:90vw',
      'background:linear-gradient(170deg, #1a1810 0%, #252018 50%, #1a1810 100%)',
      'border:2px solid #5a4a2a',
      'border-radius:12px',
      'box-shadow:0 0 60px rgba(212,168,75,0.15), 0 0 120px rgba(212,168,75,0.05), 0 8px 40px rgba(0,0,0,0.9)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    const shimmer = document.createElement('div');
    shimmer.className = 'cs-shimmer-bar';
    shimmer.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'right:0', 'height:2px',
      `background:linear-gradient(90deg, transparent, ${win ? '#e8c870' : '#c0392b'}, ${win ? '#70e89a' : '#e74c3c'}, ${win ? '#e8c870' : '#c0392b'}, transparent)`,
      'background-size:200% 100%', 'z-index:1',
    ].join(';');
    modal.appendChild(shimmer);

    // Header
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:24px 16px 16px',
      'text-align:center',
      'background:#111008',
      'border-bottom:1px solid #3a2e1a',
    ].join(';');

    const title = document.createElement('div');
    title.className = win ? 'cs-victory-title-glow' : 'cs-defeat-title-glow';
    title.style.cssText = [
      'font-size:2rem', 'font-weight:700',
      `color:${win ? '#f0c060' : '#c0392b'}`,
      'letter-spacing:0.08em',
    ].join(';');
    title.textContent = win ? 'Victory!' : 'Defeated';
    header.appendChild(title);

    // Boss icon + name
    const monsterRow = document.createElement('div');
    monsterRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;';

    if (payload.boss_icon_url) {
      const mIcon = document.createElement('div');
      mIcon.style.cssText = [
        'width:80px', 'height:80px', 'flex-shrink:0',
        'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:6px',
        'overflow:hidden', 'display:flex', 'align-items:center', 'justify-content:center',
      ].join(';');
      const mImg = document.createElement('img');
      mImg.src = payload.boss_icon_url;
      mImg.alt = payload.boss_name;
      mImg.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      mImg.onerror = () => { mImg.remove(); mIcon.textContent = '👹'; mIcon.style.color = '#c9a55c'; mIcon.style.fontSize = '1.2rem'; };
      mIcon.appendChild(mImg);
      monsterRow.appendChild(mIcon);
    }

    const mName = document.createElement('div');
    mName.style.cssText = 'font-size:1rem;color:#e8c870;font-family:Cinzel,serif;font-weight:700;';
    mName.textContent = payload.boss_name;
    monsterRow.appendChild(mName);
    header.appendChild(monsterRow);

    if (!win) {
      const bracketLabel = this.getBracketLabel(payload.enemy_hp_bracket);
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.75rem;color:#8a7050;margin-top:8px;';
      sub.textContent = `The guardian stands firm. It appears ${bracketLabel} wounded.`;
      header.appendChild(sub);
    }

    modal.appendChild(header);

    // Rewards body (win only)
    if (win) {
      const body = document.createElement('div');
      body.style.cssText = 'padding:16px 20px;display:flex;flex-direction:column;gap:10px;';

      const hasRewards = payload.xp_gained > 0 || payload.crowns_gained > 0
        || payload.items_dropped.length > 0;

      if (hasRewards) {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';

        let tileIndex = 0;
        const addTile = (iconUrl: string | null, fallback: string, color: string, qty: number, tooltip: string) => {
          const tile = this.buildLootTile(iconUrl, fallback, color, qty, tooltip);
          tile.className = 'cs-loot-slide-in';
          tile.style.animationDelay = `${0.2 + tileIndex * 0.1}s`;
          grid.appendChild(tile);
          tileIndex++;
        };

        if (payload.xp_gained > 0) {
          addTile(getXpIconUrl(), '✦', '#a78bfa', payload.xp_gained, `+${payload.xp_gained} XP`);
        }
        if (payload.crowns_gained > 0) {
          addTile(getCrownsIconUrl(), '♛', '#f0c060', payload.crowns_gained, `+${payload.crowns_gained} Crowns`);
        }
        for (const item of payload.items_dropped) {
          addTile(item.icon_url ?? null, '◆', '#c9a55c', item.quantity, item.name);
        }

        body.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;font-size:0.8rem;color:#5a4a2a;padding:8px 0;';
        empty.textContent = 'No drops this time.';
        body.appendChild(empty);
      }

      modal.appendChild(body);
    }

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = [
      'padding:14px 16px 18px',
      'display:flex', 'justify-content:center',
      'border-top:1px solid #2a2010',
      'background:#0a0806',
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Continue';
    closeBtn.style.cssText = [
      'padding:10px 40px', 'font-family:Cinzel,serif',
      'font-size:0.95rem', 'font-weight:600', 'color:#1a1510',
      'background:#d4a84b', 'border:1px solid #b8922e', 'cursor:pointer',
      'border-radius:4px', 'letter-spacing:0.05em',
      'transition:background 0.15s, transform 0.1s',
    ].join(';');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e8c060'; closeBtn.style.transform = 'scale(1.03)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#d4a84b'; closeBtn.style.transform = 'scale(1)'; });
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      this.onClose?.();
    });
    footer.appendChild(closeBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /** Render combat UI inside an external container (no backdrop overlay). */
  openEmbedded(payload: CombatStartPayload, container: HTMLElement): void {
    this.close();

    this.variant       = 'normal';
    this.embedded      = true;
    this.combatId      = payload.combat_id;
    this.playerMaxHp   = payload.player.max_hp;
    this.playerMaxMana = payload.player.max_mana;
    this.enemyMaxHp    = payload.monster.max_hp;

    this.ensureFlashStyles();
    this.buildOverlay(payload, container);
    this.readyTime = Date.now() + COMBAT_OPEN_SETTLE_MS;
  }

  applyTurnResult(payload: CombatTurnResultPayload): void {
    if (!this.overlay) return;

    // If the UI hasn't settled yet, queue and drain later
    if (Date.now() < this.readyTime) {
      this.pendingQueue.push({ type: 'turn', payload });
      this.scheduleDrain();
      return;
    }

    this.updateAbilityStates(payload.ability_states);
    this.updateActiveEffects(payload.active_effects ?? []);

    for (const evt of payload.events) {
      this.appendLogLine(this.formatEvent(evt));
    }

    const lastAttack = [...payload.events].reverse().find(
      (e) => e.kind === 'auto_attack' || e.kind === 'ability_fired',
    );

    const hasAttack = !!lastAttack;
    const isEnemyTurn = hasAttack && lastAttack.source !== 'player';

    // 1) Turn indicator — shows immediately
    if (isEnemyTurn) {
      this.setTurnIndicator('enemy');
    } else if (hasAttack) {
      this.setTurnIndicator('player');
    }

    // 2) After a pause, play attack animations + ability flashes
    const attackDelay = hasAttack ? TURN_INDICATOR_PAUSE_MS : 0;

    setTimeout(() => {
      if (!this.overlay) return;
      this.flashFiredAbilities(payload);
      // Attack impacts fire at attackDelay, floating numbers stagger after ATTACK_ANIM_DURATION_MS
      this.spawnCombatEffects(payload.events, hasAttack ? ATTACK_ANIM_DURATION_MS : 0);
    }, attackDelay);

    // 3) HP/MP bar updates — after attack anim + floating numbers have landed
    const hpDelay = attackDelay + (hasAttack ? ATTACK_ANIM_DURATION_MS + FLOAT_TO_HP_DELAY_MS : 0);

    if (isEnemyTurn) {
      // Enemy DoT / reflect on enemy can update sooner
      this.setEnemyHp(payload.enemy_hp);
      this.setPlayerMana(payload.player_mana);
      setTimeout(() => {
        if (!this.overlay) return;
        this.setPlayerHp(payload.player_hp);
      }, hpDelay);
    } else {
      setTimeout(() => {
        if (!this.overlay) return;
        this.setEnemyHp(payload.enemy_hp);
        this.setPlayerHp(payload.player_hp);
        this.setPlayerMana(payload.player_mana);
      }, hpDelay);
    }
  }

  openActiveWindow(payload: CombatActiveWindowPayload): void {
    if (!this.overlay) return;

    // If the UI hasn't settled yet, queue and drain later
    if (Date.now() < this.readyTime) {
      this.pendingQueue.push({ type: 'active', payload });
      this.scheduleDrain();
      return;
    }

    this.activeAbilityName = payload.ability?.name ?? null;
    const canUse = payload.ability !== null;

    if (this.activeButtonEl) {
      this.activeButtonEl.disabled = !canUse;
      this.activeButtonEl.style.opacity = canUse ? '1' : '0.4';
      if (canUse) {
        this.activeButtonEl.style.boxShadow = '0 0 8px #d4a84b';
      }
    }

    // Active window = player's turn
    this.setTurnIndicator('player');

    this.clearActiveWindowTimer();
    this.activeWindowEndTime = Date.now() + payload.timer_ms;

    if (this.activeTimerEl) {
      this.activeTimerEl.style.visibility = 'visible';
    }

    this.activeWindowInterval = setInterval(() => {
      const remaining = Math.max(0, this.activeWindowEndTime - Date.now());
      if (this.activeTimerEl) {
        this.activeTimerEl.textContent = (remaining / 1000).toFixed(1) + 's';
      }
      if (remaining === 0) {
        this.clearActiveWindowTimer();
        this.lockActiveButton();
      }
    }, 100);
  }

  close(): void {
    this.clearActiveWindowTimer();
    this.clearSettleTimer();
    this.removeActiveTooltip();
    if (this.overlay) {
      if (this.embedded) {
        // In embedded mode, just empty the container content
        this.overlay.innerHTML = '';
      } else {
        this.overlay.remove();
      }
      this.overlay = null;
      this.onClose?.();
    }
    this.embedded = false;
    this.enemyIconEl = null;
    this.playerIconEl = null;
    this.enemyHpBar = null;
    this.enemyHpText = null;
    this.playerHpBar = null;
    this.playerHpText = null;
    this.playerManaBar = null;
    this.playerManaText = null;
    this.autoIndicatorsEl = null;
    this.activeButtonEl = null;
    this.activeTimerEl = null;
    this.combatLogEl = null;
    this.combatId = null;
    this.activeAbilityName = null;
    this.pendingQueue = [];
    this.readyTime = 0;
    this.variant = 'normal';
    this.bossBracketSegments = [];
    this.currentBossHpBracket = 'full';
    this.bossAbilitySlotsEl = null;
    this.bossName = null;
    this.playerDebuffsEl = null;
    this.playerBuffsEl = null;
    this.enemyDebuffsEl = null;
    this.enemyBuffsEl = null;
    this.removeEffectTooltip();
  }

  // ---------------------------------------------------------------------------
  // Settle queue — buffer messages that arrive before the player has focused
  // ---------------------------------------------------------------------------

  private scheduleDrain(): void {
    if (this.settleTimer) return;
    const wait = Math.max(0, this.readyTime - Date.now());
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.drainQueue();
    }, wait);
  }

  private drainQueue(): void {
    const queue = this.pendingQueue;
    this.pendingQueue = [];
    for (const msg of queue) {
      if (msg.type === 'turn') {
        this.applyTurnResult(msg.payload);
      } else {
        this.openActiveWindow(msg.payload);
      }
    }
  }

  private clearSettleTimer(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  showOutcome(payload: CombatEndPayload): void {
    this.clearActiveWindowTimer();
    this.ensureFlashStyles();
    this.clearSettleTimer();
    this.pendingQueue = [];

    // Remove combat overlay entirely to avoid double-darkening
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    const win = payload.outcome === 'win';

    // Fresh overlay — single semi-transparent backdrop with fade-in
    const overlay = document.createElement('div');
    overlay.className = 'cs-victory-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:300',
      'background:rgba(0,0,0,0.65)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:Cinzel,serif', 'color:#c9a55c',
    ].join(';');

    // Result modal — animated scale-in like disassembly popup
    const modal = document.createElement('div');
    modal.className = 'cs-victory-modal';
    modal.style.cssText = [
      'position:relative',
      'width:400px', 'max-width:90vw',
      'background:linear-gradient(170deg, #1a1810 0%, #252018 50%, #1a1810 100%)',
      'border:2px solid #5a4a2a',
      'border-radius:12px',
      'box-shadow:0 0 60px rgba(212,168,75,0.15), 0 0 120px rgba(212,168,75,0.05), 0 8px 40px rgba(0,0,0,0.9)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // Shimmer bar at the top
    const shimmer = document.createElement('div');
    shimmer.className = 'cs-shimmer-bar';
    shimmer.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'right:0', 'height:2px',
      `background:linear-gradient(90deg, transparent, ${win ? '#e8c870' : '#c0392b'}, ${win ? '#70e89a' : '#e74c3c'}, ${win ? '#e8c870' : '#c0392b'}, transparent)`,
      'background-size:200% 100%', 'z-index:1',
    ].join(';');
    modal.appendChild(shimmer);

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:24px 16px 16px',
      'text-align:center',
      'background:#111008',
      'border-bottom:1px solid #3a2e1a',
    ].join(';');

    const title = document.createElement('div');
    title.className = win ? 'cs-victory-title-glow' : 'cs-defeat-title-glow';
    title.style.cssText = [
      'font-size:2rem', 'font-weight:700',
      `color:${win ? '#f0c060' : '#c0392b'}`,
      'letter-spacing:0.08em',
    ].join(';');
    title.textContent = win ? 'Victory!' : 'Defeated';
    header.appendChild(title);

    // Monster icon + name under title
    const monsterRow = document.createElement('div');
    monsterRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;';

    if (payload.monster_icon_url) {
      const mIcon = document.createElement('div');
      mIcon.style.cssText = [
        'width:80px', 'height:80px', 'flex-shrink:0',
        'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:6px',
        'overflow:hidden', 'display:flex', 'align-items:center', 'justify-content:center',
      ].join(';');
      const mImg = document.createElement('img');
      mImg.src = payload.monster_icon_url;
      mImg.alt = payload.monster_name;
      mImg.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      mImg.onerror = () => { mImg.remove(); mIcon.textContent = '👹'; mIcon.style.color = '#c9a55c'; mIcon.style.fontSize = '1.2rem'; };
      mIcon.appendChild(mImg);
      monsterRow.appendChild(mIcon);
    }

    const mName = document.createElement('div');
    mName.style.cssText = 'font-size:0.85rem;color:#8a7a5a;font-family:"Crimson Text",serif;';
    mName.textContent = payload.monster_name;
    monsterRow.appendChild(mName);
    header.appendChild(monsterRow);

    if (!win) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.75rem;color:#8a7050;margin-top:8px;';
      sub.textContent = 'You have fallen in battle.';
      header.appendChild(sub);
    }

    modal.appendChild(header);

    // ── Rewards body (win only) ──
    if (win) {
      const body = document.createElement('div');
      body.style.cssText = 'padding:16px 20px;display:flex;flex-direction:column;gap:10px;';

      const hasRewards = payload.xp_gained > 0 || payload.crowns_gained > 0
        || payload.items_dropped.length > 0 || payload.ability_drops.length > 0
        || (payload.squires_dropped?.length ?? 0) > 0;

      if (hasRewards) {
        // Loot grid — icon tiles with quantity badges, staggered reveal
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';

        let tileIndex = 0;
        const addTile = (iconUrl: string | null, fallback: string, color: string, qty: number, tooltip: string) => {
          const tile = this.buildLootTile(iconUrl, fallback, color, qty, tooltip);
          tile.className = 'cs-loot-slide-in';
          tile.style.animationDelay = `${0.2 + tileIndex * 0.1}s`;
          grid.appendChild(tile);
          tileIndex++;
        };

        if (payload.xp_gained > 0) {
          addTile(getXpIconUrl(), '✦', '#a78bfa', payload.xp_gained, `+${payload.xp_gained} XP`);
        }
        if (payload.crowns_gained > 0) {
          addTile(getCrownsIconUrl(), '♛', '#f0c060', payload.crowns_gained, `+${payload.crowns_gained} Crowns`);
        }
        for (const item of payload.items_dropped) {
          addTile(item.icon_url ?? null, '◆', '#c9a55c', item.quantity, item.name);
        }
        for (const ability of payload.ability_drops) {
          addTile(ability.icon_url ?? null, '✦', '#6ab4e8', 1, `New: ${ability.name}`);
        }
        for (const squire of payload.squires_dropped ?? []) {
          addTile(squire.icon_url ?? null, '⚔', '#d4a84b', 1, `${squire.name} (${squire.rank})`);
        }

        body.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;font-size:0.8rem;color:#5a4a2a;padding:8px 0;';
        empty.textContent = 'No drops this time.';
        body.appendChild(empty);
      }

      modal.appendChild(body);
    }

    // ── Footer with button ──
    const footer = document.createElement('div');
    footer.style.cssText = [
      'padding:14px 16px 18px',
      'display:flex', 'justify-content:center',
      'border-top:1px solid #2a2010',
      'background:#0a0806',
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Continue';
    closeBtn.style.cssText = [
      'padding:10px 40px', 'font-family:Cinzel,serif',
      'font-size:0.95rem', 'font-weight:600', 'color:#1a1510',
      'background:#d4a84b', 'border:1px solid #b8922e', 'cursor:pointer',
      'border-radius:4px', 'letter-spacing:0.05em',
      'transition:background 0.15s, transform 0.1s',
    ].join(';');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e8c060'; closeBtn.style.transform = 'scale(1.03)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#d4a84b'; closeBtn.style.transform = 'scale(1)'; });
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      this.onClose?.();
    });
    footer.appendChild(closeBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Keep this.overlay null — combat is done, close() shouldn't double-remove
  }

  // ---------------------------------------------------------------------------
  // Outcome modal helpers
  // ---------------------------------------------------------------------------

  private buildRewardRow(iconEl: HTMLElement, label: string, color: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:6px 10px',
      'background:#161210', 'border:1px solid #2a2010', 'border-radius:4px',
    ].join(';');
    row.appendChild(iconEl);

    const text = document.createElement('span');
    text.style.cssText = `font-size:0.85rem;color:${color};font-weight:600;`;
    text.textContent = label;
    row.appendChild(text);
    return row;
  }

  private buildTextIcon(char: string, color: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'width:32px', 'height:32px', 'flex-shrink:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      `font-size:1.2rem`, `color:${color}`,
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
    ].join(';');
    el.textContent = char;
    return el;
  }

  private buildImgIcon(url: string, alt: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'width:32px', 'height:32px', 'flex-shrink:0',
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
      'overflow:hidden', 'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';');
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
    img.onerror = () => { img.remove(); wrap.textContent = '◆'; wrap.style.color = '#c9a55c'; wrap.style.fontSize = '1rem'; };
    wrap.appendChild(img);
    return wrap;
  }

  private buildLootTile(
    iconUrl: string | null,
    fallbackSymbol: string,
    color: string,
    quantity: number,
    tooltipText: string,
  ): HTMLElement {
    const tile = document.createElement('div');
    tile.style.cssText = [
      'position:relative',
      'width:48px', 'height:48px',
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'overflow:visible', 'cursor:default', 'flex-shrink:0',
    ].join(';');
    tile.title = tooltipText;

    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => { img.remove(); tile.textContent = fallbackSymbol; tile.style.color = color; tile.style.fontSize = '1.4rem'; };
      tile.appendChild(img);
    } else {
      tile.textContent = fallbackSymbol;
      tile.style.color = color;
      tile.style.fontSize = '1.4rem';
    }

    // Quantity badge
    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute', 'bottom:-2px', 'right:-2px',
      'min-width:16px', 'height:16px', 'padding:0 3px',
      'background:#0d0b08', 'border:1px solid #5a4a2a', 'border-radius:3px',
      'font-size:0.6rem', 'font-family:Rajdhani,sans-serif', 'font-weight:700',
      'color:#e8c870', 'text-align:center', 'line-height:16px',
    ].join(';');
    badge.textContent = quantity > 1 ? String(quantity) : '+1';
    tile.appendChild(badge);

    return tile;
  }

  getCombatId(): string | null {
    return this.combatId;
  }

  getVariant(): 'normal' | 'boss' {
    return this.variant;
  }

  // ---------------------------------------------------------------------------
  // Build layout
  // ---------------------------------------------------------------------------

  private buildOverlay(payload: CombatStartPayload, externalContainer?: HTMLElement): void {
    let overlay: HTMLElement;

    if (externalContainer) {
      // Embedded mode: render directly into the provided container
      overlay = externalContainer;
      overlay.innerHTML = '';
      overlay.style.cssText = [
        'display:flex', 'flex-direction:column',
        'font-family:Cinzel,serif', 'color:#c9a55c',
        'width:100%', 'height:100%',
      ].join(';');
    } else {
      // Normal mode: full-screen backdrop overlay
      overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:300',
        'background:rgba(0,0,0,0.72)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-family:Cinzel,serif', 'color:#c9a55c',
      ].join(';');
    }

    // Modal panel
    const modal = document.createElement('div');
    modal.className = 'cs-modal';
    modal.style.cssText = [
      'position:relative',
      externalContainer ? 'width:100%' : 'width:728px',
      'max-width:95vw',
      externalContainer ? 'flex:1;min-height:0' : 'max-height:90vh',
      'display:flex', 'flex-direction:column',
      'background:#0d0b08',
      externalContainer ? '' : 'border:1px solid #5a4a2a',
      externalContainer ? '' : 'border-radius:6px',
      'overflow:hidden',
      externalContainer ? '' : 'box-shadow:0 8px 40px rgba(0,0,0,0.9)',
    ].filter(Boolean).join(';');

    // ── Combatants row ────────────────────────────────────────────────────
    const battleRow = document.createElement('div');
    battleRow.style.cssText = [
      'display:flex', 'align-items:stretch',
      'background:#111008',
      'border-bottom:1px solid #3a2e1a',
    ].join(';');

    // Enemy side
    const enemySide = document.createElement('div');
    enemySide.style.cssText = [
      'flex:1', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:10px',
      'padding:16px 12px', 'background:#111008',
      'border-right:1px solid #3a2e1a',
    ].join(';');

    const enemyNameplate = document.createElement('div');
    enemyNameplate.style.cssText = 'font-size:0.85rem;font-weight:700;letter-spacing:0.06em;color:#e8c870;text-align:center;';
    enemyNameplate.textContent = payload.monster.name;

    // Monster icon
    const enemyIcon = document.createElement('div');
    enemyIcon.style.cssText = [
      'width:140px', 'height:140px',
      'background:#2a1e10',
      `border:${BORDER_IDLE}`,
      'border-radius:4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:3rem', 'overflow:hidden', 'flex-shrink:0',
      'transition:border 0.15s,box-shadow 0.15s',
    ].join(';');
    if (payload.monster.icon_url) {
      const img = document.createElement('img');
      img.src = payload.monster.icon_url;
      img.alt = payload.monster.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => { img.remove(); enemyIcon.textContent = '👹'; };
      enemyIcon.appendChild(img);
    } else {
      enemyIcon.textContent = '👹';
    }
    this.enemyIconEl = enemyIcon;

    const initialEnemyHp = (payload as { initial_enemy_hp?: number }).initial_enemy_hp ?? payload.monster.max_hp;
    const { bar: enemyHpBarWrap, fill: enemyHpFill, text: enemyHpText } =
      this.buildBar('#c0392b', payload.monster.max_hp, initialEnemyHp);
    this.enemyHpBar  = enemyHpFill;
    this.enemyHpText = enemyHpText;

    // Wrap enemy icon with debuff (left) and buff (right) columns
    const enemyIconRow = document.createElement('div');
    enemyIconRow.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:center;';

    this.enemyDebuffsEl = document.createElement('div');
    this.enemyDebuffsEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:28px;align-items:flex-end;';
    this.enemyBuffsEl = document.createElement('div');
    this.enemyBuffsEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:28px;align-items:flex-start;';

    enemyIconRow.appendChild(this.enemyDebuffsEl);
    enemyIconRow.appendChild(enemyIcon);
    enemyIconRow.appendChild(this.enemyBuffsEl);

    enemySide.appendChild(enemyNameplate);
    enemySide.appendChild(enemyIconRow);
    enemySide.appendChild(enemyHpBarWrap);

    // Player side
    const playerSide = document.createElement('div');
    playerSide.style.cssText = [
      'flex:1', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:10px',
      'padding:16px 12px', 'background:#0d0b08',
    ].join(';');

    const playerNameplate = document.createElement('div');
    playerNameplate.style.cssText = 'font-size:0.85rem;font-weight:700;letter-spacing:0.06em;color:#e8c870;text-align:center;';
    playerNameplate.textContent = 'You';

    // Player icon
    const playerIcon = document.createElement('div');
    playerIcon.style.cssText = [
      'width:140px', 'height:140px',
      'background:#1a2a1e',
      `border:${BORDER_IDLE}`,
      'border-radius:4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:3rem', 'overflow:hidden', 'flex-shrink:0',
      'transition:border 0.15s,box-shadow 0.15s',
    ].join(';');
    const playerImg = document.createElement('img');
    playerImg.src = '/assets/player_icons/player_1.png';
    playerImg.alt = 'Player';
    playerImg.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
    playerImg.onerror = () => { playerImg.remove(); playerIcon.textContent = '🧙'; };
    playerIcon.appendChild(playerImg);
    this.playerIconEl = playerIcon;

    const { bar: playerHpBarWrap, fill: playerHpFill, text: playerHpText } =
      this.buildBar('#27ae60', payload.player.max_hp, payload.player.max_hp, 'HP');
    this.playerHpBar  = playerHpFill;
    this.playerHpText = playerHpText;

    const { bar: playerManaBarWrap, fill: playerManaFill, text: playerManaText } =
      this.buildBar('#2980b9', payload.player.max_mana, 0, 'MP');
    this.playerManaBar  = playerManaFill;
    this.playerManaText = playerManaText;

    // Skill slots section (under mana bar)
    const skillsSection = document.createElement('div');
    skillsSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;width:100%;margin-top:4px;';

    const skillsLabel = document.createElement('span');
    skillsLabel.style.cssText = 'font-size:0.6rem;color:#5a4a2a;letter-spacing:0.08em;text-transform:uppercase;';
    skillsLabel.textContent = 'Skills';
    skillsSection.appendChild(skillsLabel);

    const skillsRow = document.createElement('div');
    skillsRow.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:center;';

    // Auto indicators
    this.autoIndicatorsEl = document.createElement('div');
    this.autoIndicatorsEl.style.cssText = 'display:flex;gap:6px;';
    this.buildAutoIndicators(payload.loadout.slots);
    skillsRow.appendChild(this.autoIndicatorsEl);

    // Active ability button + timer
    const activeSlot = payload.loadout.slots.find((s) => s.slot_name === 'active');
    this.activeButtonEl = document.createElement('button');
    this.activeButtonEl.disabled = true;
    this.activeButtonEl.style.cssText = [
      'width:48px', 'height:48px', 'border-radius:4px',
      'font-family:Cinzel,serif', 'font-size:0.55rem',
      'color:#c9a55c', 'background:#1a2a1e',
      'border:2px solid #3a6e3a', 'cursor:pointer',
      'opacity:0.4', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'overflow:hidden', 'position:relative',
    ].join(';');
    this.buildActiveSlotContent(activeSlot ?? null);
    this.activeButtonEl.addEventListener('click', () => {
      if (!this.activeButtonEl?.disabled) {
        this.lockActiveButton();
        this.onTriggerActive();
      }
    });

    this.activeTimerEl = document.createElement('span');
    this.activeTimerEl.style.cssText = 'font-size:0.65rem;color:#c9a55c;width:32px;text-align:center;visibility:hidden;';

    skillsRow.appendChild(this.activeButtonEl);
    skillsRow.appendChild(this.activeTimerEl);
    skillsSection.appendChild(skillsRow);

    // Wrap player icon with debuff (left) and buff (right) columns
    const playerIconRow = document.createElement('div');
    playerIconRow.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:center;';

    this.playerDebuffsEl = document.createElement('div');
    this.playerDebuffsEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:28px;align-items:flex-end;';
    this.playerBuffsEl = document.createElement('div');
    this.playerBuffsEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:28px;align-items:flex-start;';

    playerIconRow.appendChild(this.playerDebuffsEl);
    playerIconRow.appendChild(playerIcon);
    playerIconRow.appendChild(this.playerBuffsEl);

    playerSide.appendChild(playerNameplate);
    playerSide.appendChild(playerIconRow);
    playerSide.appendChild(playerHpBarWrap);
    playerSide.appendChild(playerManaBarWrap);
    playerSide.appendChild(skillsSection);

    battleRow.appendChild(enemySide);
    battleRow.appendChild(playerSide);

    // ── Combat log ────────────────────────────────────────────────────────
    const logZone = document.createElement('div');
    logZone.style.cssText = [
      'display:flex', 'flex-direction:column',
      'height:140px', 'min-height:120px',
      'border-top:1px solid #2a2010', 'background:#0a0806',
    ].join(';');

    const logHeader = document.createElement('div');
    logHeader.style.cssText = 'font-size:0.65rem;color:#5a4a2a;padding:3px 10px;border-bottom:1px solid #1e1a10;flex-shrink:0;';
    logHeader.textContent = 'COMBAT LOG';

    this.combatLogEl = document.createElement('div');
    this.combatLogEl.className = 'cs-combat-log';
    this.combatLogEl.style.cssText = [
      'flex:1', 'overflow-y:auto', 'padding:5px 10px',
      'font-size:0.72rem', 'line-height:1.6', 'color:#9a8a60',
    ].join(';');

    // Inject scrollbar styles if not already present
    if (!document.getElementById('cs-scrollbar-style')) {
      const style = document.createElement('style');
      style.id = 'cs-scrollbar-style';
      style.textContent = `
        .cs-combat-log::-webkit-scrollbar { width: 8px; }
        .cs-combat-log::-webkit-scrollbar-track { background: #1a1510; border-left: 1px solid #2a2010; }
        .cs-combat-log::-webkit-scrollbar-thumb { background: #5a4a2a; border-radius: 4px; border: 1px solid #3a2e1a; }
        .cs-combat-log::-webkit-scrollbar-thumb:hover { background: #8a7050; }
        .cs-combat-log { scrollbar-width: thin; scrollbar-color: #5a4a2a #1a1510; }
      `;
      document.head.appendChild(style);
    }

    logZone.appendChild(logHeader);
    logZone.appendChild(this.combatLogEl);

    modal.appendChild(battleRow);
    modal.appendChild(logZone);
    overlay.appendChild(modal);

    if (!externalContainer) {
      document.body.appendChild(overlay);
    }
    this.overlay = overlay;

    this.appendLogLine(`⚔ Combat started vs ${payload.monster.name}`);
  }

  // ---------------------------------------------------------------------------
  // Turn indicator
  // ---------------------------------------------------------------------------

  private setTurnIndicator(party: 'player' | 'enemy' | null): void {
    if (!this.playerIconEl || !this.enemyIconEl) return;

    const applyActive = (el: HTMLElement) => {
      el.style.border  = BORDER_ACTIVE;
      el.style.boxShadow = SHADOW_ACTIVE;
    };
    const applyIdle = (el: HTMLElement) => {
      el.style.border  = BORDER_IDLE;
      el.style.boxShadow = SHADOW_IDLE;
    };

    if (party === 'player') {
      applyActive(this.playerIconEl);
      applyIdle(this.enemyIconEl);
    } else if (party === 'enemy') {
      applyActive(this.enemyIconEl);
      applyIdle(this.playerIconEl);
    } else {
      applyIdle(this.playerIconEl);
      applyIdle(this.enemyIconEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Bar helper
  // ---------------------------------------------------------------------------

  private buildBar(
    color: string,
    max: number,
    current: number,
    label = 'HP',
  ): { bar: HTMLElement; fill: HTMLElement; text: HTMLElement } {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;width:200px;max-width:90%;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.6rem;color:#8a7050;width:18px;text-align:right;flex-shrink:0;';
    lbl.textContent = label;

    const track = document.createElement('div');
    track.style.cssText = [
      'flex:1', 'height:8px', 'background:#2a2010',
      'border:1px solid #3a2e1a', 'border-radius:2px', 'overflow:hidden',
    ].join(';');

    const fill = document.createElement('div');
    const pct = max > 0 ? (current / max) * 100 : 0;
    fill.style.cssText = `height:100%;width:${pct}%;background:${color};transition:width 0.3s ease;border-radius:1px;`;
    track.appendChild(fill);

    const text = document.createElement('span');
    text.style.cssText = 'font-size:0.6rem;color:#8a7050;width:52px;text-align:left;flex-shrink:0;';
    text.textContent = `${current}/${max}`;

    wrap.appendChild(lbl);
    wrap.appendChild(track);
    wrap.appendChild(text);

    return { bar: wrap, fill, text };
  }

  // ---------------------------------------------------------------------------
  // Auto-ability indicators
  // ---------------------------------------------------------------------------

  private buildAutoIndicators(slots: CombatAbilityStateDto[]): void {
    if (!this.autoIndicatorsEl) return;
    this.autoIndicatorsEl.innerHTML = '';

    const autoSlots = ['auto_1', 'auto_2', 'auto_3'] as const;
    for (const slotName of autoSlots) {
      const slot = slots.find((s) => s.slot_name === slotName);
      const chip = document.createElement('div');
      chip.className = 'cs-ability-slot';
      chip.dataset['slot'] = slotName;
      if (slot) chip.dataset['abilityName'] = slot.name;
      chip.style.cssText = [
        'width:48px', 'height:48px', 'border-radius:4px', 'font-size:0.55rem',
        'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
        'cursor:default', 'overflow:hidden', 'position:relative',
        `background:${slot ? '#2a1e10' : '#1a1510'}`,
        `color:${slot ? '#c9a55c' : '#5a4a2a'}`,
      ].join(';');

      this.fillSlotContent(chip, slot ?? null);
      if (slot) this.attachTooltip(chip, slot);

      this.autoIndicatorsEl.appendChild(chip);
    }
  }

  private fillSlotContent(chip: HTMLElement, slot: CombatAbilityStateDto | null): void {
    // Preserve the tooltip element if present
    const existingTooltip = chip.querySelector('.cs-tooltip');
    chip.innerHTML = '';
    if (existingTooltip) chip.appendChild(existingTooltip);

    if (slot?.icon_url) {
      const img = document.createElement('img');
      img.src = slot.icon_url;
      img.alt = slot.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;position:absolute;inset:0;';
      img.onerror = () => { img.remove(); this.fillSlotText(chip, slot); };
      chip.appendChild(img);
      const costBadge = document.createElement('span');
      costBadge.style.cssText = 'position:absolute;bottom:1px;right:2px;font-size:0.5rem;color:#6ab4e8;text-shadow:0 0 3px #000,0 0 3px #000;z-index:1;';
      costBadge.textContent = `${slot.mana_cost}`;
      chip.appendChild(costBadge);
    } else if (slot) {
      this.fillSlotText(chip, slot);
    } else {
      const dash = document.createElement('span');
      dash.style.cssText = 'font-size:0.8rem;color:#3a2e1a;';
      dash.textContent = '—';
      chip.appendChild(dash);
    }
  }

  private fillSlotText(chip: HTMLElement, slot: CombatAbilityStateDto): void {
    // Don't clear — called after chip is already cleared or as fallback
    const name = document.createElement('span');
    name.style.cssText = 'font-size:0.6rem;font-weight:600;overflow:hidden;max-width:42px;white-space:nowrap;text-overflow:ellipsis;text-align:center;';
    name.textContent = slot.name.slice(0, 5);
    const cost = document.createElement('span');
    cost.style.cssText = 'font-size:0.5rem;color:#6ab4e8;';
    cost.textContent = `${slot.mana_cost}`;
    chip.appendChild(name);
    chip.appendChild(cost);
  }

  private buildActiveSlotContent(slot: CombatAbilityStateDto | null): void {
    if (!this.activeButtonEl) return;
    this.activeButtonEl.innerHTML = '';
    if (!slot) {
      this.activeButtonEl.innerHTML = '<span style="font-size:0.55rem;color:#5a4a2a;">Empty</span>';
      return;
    }
    if (slot.icon_url) {
      const img = document.createElement('img');
      img.src = slot.icon_url;
      img.alt = slot.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;position:absolute;inset:0;';
      img.onerror = () => { img.remove(); this.activeButtonEl!.innerHTML = `<span style="font-size:0.6rem;font-weight:600;">${slot.name.slice(0, 5)}</span><span style="font-size:0.5rem;color:#6ab4e8;">${slot.mana_cost}</span>`; };
      this.activeButtonEl.appendChild(img);
      const costBadge = document.createElement('span');
      costBadge.style.cssText = 'position:absolute;bottom:1px;right:2px;font-size:0.5rem;color:#6ab4e8;text-shadow:0 0 3px #000,0 0 3px #000;z-index:1;';
      costBadge.textContent = `${slot.mana_cost}`;
      this.activeButtonEl.appendChild(costBadge);
    } else {
      this.activeButtonEl.innerHTML = `<span style="font-size:0.6rem;font-weight:600;">${slot.name.slice(0, 5)}</span><span style="font-size:0.5rem;color:#6ab4e8;">${slot.mana_cost}</span>`;
    }
    this.attachTooltip(this.activeButtonEl, slot);
  }

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------

  private attachTooltip(el: HTMLElement, slot: CombatAbilityStateDto): void {
    let activeTip: HTMLElement | null = null;

    el.addEventListener('mouseenter', () => {
      this.removeActiveTooltip();

      const rect = el.getBoundingClientRect();

      const tip = document.createElement('div');
      tip.className = 'cs-tooltip';
      tip.style.cssText = [
        'position:fixed', 'z-index:9999', 'pointer-events:none',
        'background:linear-gradient(180deg, #1e1a12 0%, #141008 100%)',
        'border:1px solid #5a4a2a', 'border-radius:4px',
        'padding:8px 12px', 'min-width:140px', 'max-width:220px',
        'box-shadow:0 4px 16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(212,168,75,0.1)',
        'font-family:Cinzel,serif',
      ].join(';');

      // Position above the element, centered
      tip.style.left = `${rect.left + rect.width / 2}px`;
      tip.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      tip.style.transform = 'translateX(-50%)';

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:0.8rem;font-weight:700;color:#e8c870;border-bottom:1px solid #3a2e1a;padding-bottom:4px;margin-bottom:4px;';
      nameEl.textContent = slot.name;
      tip.appendChild(nameEl);

      if (slot.description) {
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:0.68rem;color:#b0a070;line-height:1.5;white-space:normal;margin-bottom:4px;font-family:Crimson Text,serif;';
        descEl.textContent = slot.description;
        tip.appendChild(descEl);
      }

      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'display:flex;gap:10px;align-items:center;font-size:0.6rem;';

      const manaEl = document.createElement('span');
      manaEl.style.cssText = 'color:#6ab4e8;';
      manaEl.textContent = `💧 ${slot.mana_cost} MP`;
      infoRow.appendChild(manaEl);

      if (slot.status === 'cooldown') {
        const cdEl = document.createElement('span');
        cdEl.style.cssText = 'color:#c0392b;';
        cdEl.textContent = `⏳ ${slot.cooldown_turns_remaining}t`;
        infoRow.appendChild(cdEl);
      } else if (slot.status === 'ready') {
        const rdyEl = document.createElement('span');
        rdyEl.style.cssText = 'color:#5a8a3a;';
        rdyEl.textContent = 'Ready';
        infoRow.appendChild(rdyEl);
      }

      tip.appendChild(infoRow);

      document.body.appendChild(tip);
      activeTip = tip;
      this.activeTooltipEl = tip;
    });

    el.addEventListener('mouseleave', () => {
      if (activeTip) {
        activeTip.remove();
        activeTip = null;
      }
      if (this.activeTooltipEl === activeTip) this.activeTooltipEl = null;
    });
  }

  private removeActiveTooltip(): void {
    if (this.activeTooltipEl) {
      this.activeTooltipEl.remove();
      this.activeTooltipEl = null;
    }
  }

  // ---------------------------------------------------------------------------
  // State updates
  // ---------------------------------------------------------------------------

  private setEnemyHp(hp: number): void {
    // In boss variant, HP is handled via bracket segments, not exact numbers
    if (this.variant === 'boss') {
      this.setBossBracket(this.currentBossHpBracket);
      return;
    }
    if (this.enemyHpBar) {
      this.enemyHpBar.style.width = `${Math.max(0, (hp / this.enemyMaxHp) * 100)}%`;
    }
    if (this.enemyHpText) {
      this.enemyHpText.textContent = `${hp}/${this.enemyMaxHp}`;
    }
  }

  private setPlayerHp(hp: number): void {
    if (this.playerHpBar) {
      this.playerHpBar.style.width = `${Math.max(0, (hp / this.playerMaxHp) * 100)}%`;
    }
    if (this.playerHpText) {
      this.playerHpText.textContent = `${hp}/${this.playerMaxHp}`;
    }
  }

  private setPlayerMana(mana: number): void {
    if (this.playerManaBar) {
      this.playerManaBar.style.width = `${Math.max(0, (mana / this.playerMaxMana) * 100)}%`;
    }
    if (this.playerManaText) {
      this.playerManaText.textContent = `${mana}/${this.playerMaxMana}`;
    }
  }

  private updateAbilityStates(states: CombatAbilityStateDto[]): void {
    this.buildAutoIndicators(states);
    const activeSlot = states.find((s) => s.slot_name === 'active');
    if (activeSlot) {
      this.buildActiveSlotContent(activeSlot);
    }
  }

  // ---------------------------------------------------------------------------
  // Boss HP bracket helpers
  // ---------------------------------------------------------------------------

  private static readonly BRACKET_COLORS: Record<BossHpBracket, string> = {
    full: '#4ade80',
    high: '#4ade80',
    medium: '#facc15',
    low: '#fb923c',
    critical: '#ef4444',
  };

  private static readonly BRACKET_ORDER: BossHpBracket[] = ['critical', 'low', 'medium', 'high', 'full'];

  /** Replace the standard enemy HP bar + text with a 5-segment bracket indicator. */
  private replaceBossHpBar(bracket: BossHpBracket): void {
    // Find the HP bar wrapper (parent of enemyHpBar) and replace its content
    const hpBarParent = this.enemyHpBar?.parentElement?.parentElement;
    if (!hpBarParent) return;

    hpBarParent.innerHTML = '';
    // Center the bracket bar by matching icon width and removing the label offset
    hpBarParent.style.width = '140px';
    hpBarParent.style.justifyContent = 'center';

    const segContainer = document.createElement('div');
    segContainer.style.cssText = 'width:100%;display:flex;gap:3px;height:10px;';

    this.bossBracketSegments = [];
    for (let i = 0; i < CombatScreen.BRACKET_ORDER.length; i++) {
      const seg = document.createElement('div');
      seg.style.cssText = [
        'flex:1', 'height:100%', 'border-radius:2px',
        'border:1px solid #3a2e1a',
        'transition:background 0.3s ease',
      ].join(';');
      this.bossBracketSegments.push(seg);
      segContainer.appendChild(seg);
    }

    hpBarParent.appendChild(segContainer);

    // Hide the HP text ref
    this.enemyHpBar = null;
    this.enemyHpText = null;

    this.setBossBracket(bracket);
  }

  /** Update boss bracket segment colors based on current bracket. */
  private setBossBracket(bracket: BossHpBracket): void {
    this.currentBossHpBracket = bracket;
    const bracketIdx = CombatScreen.BRACKET_ORDER.indexOf(bracket);

    for (let i = 0; i < this.bossBracketSegments.length; i++) {
      const seg = this.bossBracketSegments[i];
      if (!seg) continue;
      if (i <= bracketIdx) {
        // Filled segment — color matches the current bracket level
        seg.style.background = CombatScreen.BRACKET_COLORS[bracket];
      } else {
        // Empty segment
        seg.style.background = '#2a2010';
      }
    }
  }

  /** Enlarge the boss nameplate to distinguish from regular monsters. */
  private enlargeBossName(): void {
    if (!this.overlay) return;
    const nameplate = this.overlay.querySelector('.cs-modal')?.querySelector('div[style*="letter-spacing"]') as HTMLElement | null;
    // Find the enemy nameplate — first one in the battle row
    const modal = this.overlay.querySelector('.cs-modal') as HTMLElement;
    if (!modal) return;
    const battleRow = modal.children[0] as HTMLElement | undefined;
    if (!battleRow) return;
    const enemySide = battleRow.children[0] as HTMLElement | undefined;
    if (!enemySide) return;
    const nameplateEl = enemySide.children[0] as HTMLElement | undefined;
    if (nameplateEl) {
      nameplateEl.style.fontSize = '1.05rem';
      nameplateEl.style.color = '#f0c060';
      nameplateEl.style.textShadow = '0 0 8px rgba(240,192,96,0.4)';
    }
  }

  /** Build boss ability slots under the boss icon on the enemy side. */
  private buildBossAbilitySlots(abilities: { name: string; icon_url: string | null }[]): void {
    if (!this.overlay || abilities.length === 0) return;

    const modal = this.overlay.querySelector('.cs-modal') as HTMLElement | null;
    if (!modal) return;
    const battleRow = modal.children[0] as HTMLElement | undefined;
    if (!battleRow) return;
    const enemySide = battleRow.children[0] as HTMLElement | undefined;
    if (!enemySide) return;

    // Create abilities section
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:2px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.6rem;color:#8a6a3a;letter-spacing:0.08em;text-transform:uppercase;';
    label.textContent = 'Boss Skills';
    section.appendChild(label);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:5px;';

    for (const ability of abilities) {
      const chip = document.createElement('div');
      chip.className = 'cs-boss-ability-slot';
      chip.dataset['abilityName'] = ability.name;
      chip.style.cssText = [
        'width:40px', 'height:40px', 'border-radius:4px',
        'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
        'overflow:hidden', 'position:relative',
        'background:#2a1010', 'border:2px solid #5a2020',
        'cursor:default', 'transition:border 0.2s,box-shadow 0.2s',
      ].join(';');

      if (ability.icon_url) {
        const img = document.createElement('img');
        img.src = ability.icon_url;
        img.alt = ability.name;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;position:absolute;inset:0;';
        img.onerror = () => { img.remove(); this.fillBossSlotText(chip, ability.name); };
        chip.appendChild(img);
      } else {
        this.fillBossSlotText(chip, ability.name);
      }

      // Tooltip on hover
      const tooltip = document.createElement('div');
      tooltip.className = 'cs-tooltip';
      tooltip.style.cssText = [
        'display:none', 'position:absolute', 'bottom:calc(100% + 6px)', 'left:50%',
        'transform:translateX(-50%)', 'background:#1a1208', 'border:1px solid #5a4a2a',
        'border-radius:3px', 'padding:4px 8px', 'white-space:nowrap',
        'font-size:0.6rem', 'color:#e8c870', 'z-index:10', 'pointer-events:none',
      ].join(';');
      tooltip.textContent = ability.name;
      chip.appendChild(tooltip);
      chip.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; });
      chip.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

      row.appendChild(chip);
    }

    section.appendChild(row);
    this.bossAbilitySlotsEl = row;
    enemySide.appendChild(section);
  }

  private fillBossSlotText(chip: HTMLElement, name: string): void {
    const abbr = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const txt = document.createElement('span');
    txt.style.cssText = 'font-size:0.5rem;color:#cc6666;text-align:center;line-height:1.2;';
    txt.textContent = abbr;
    chip.appendChild(txt);
  }

  /** Flash a boss ability slot when the boss uses that ability. */
  private flashBossAbilitySlot(abilityName: string): void {
    if (!this.bossAbilitySlotsEl) return;
    const chips = this.bossAbilitySlotsEl.querySelectorAll<HTMLElement>('.cs-boss-ability-slot');
    for (const chip of chips) {
      if (chip.dataset['abilityName'] === abilityName) {
        chip.style.border = '2px solid #ff4444';
        chip.style.boxShadow = '0 0 10px rgba(255,68,68,0.6)';
        setTimeout(() => {
          chip.style.border = '2px solid #5a2020';
          chip.style.boxShadow = 'none';
        }, 800);
        break;
      }
    }
  }

  /** Convert bracket enum to human-readable label for defeat messages. */
  private getBracketLabel(bracket: BossHpBracket): string {
    switch (bracket) {
      case 'full': return 'barely';
      case 'high': return 'slightly';
      case 'medium': return 'moderately';
      case 'low': return 'heavily';
      case 'critical': return 'critically';
    }
  }

  // ---------------------------------------------------------------------------
  // Ability flash effect
  // ---------------------------------------------------------------------------

  private flashFiredAbilities(payload: CombatTurnResultPayload): void {
    if (!this.autoIndicatorsEl) return;

    // Inject styles once
    this.ensureFlashStyles();

    // Collect ability names used by the player this turn
    // Check ability_fired, mana_spent, and effect_applied — different ability
    // types emit different event kinds.
    const firedNames = new Set<string>();
    for (const evt of payload.events) {
      if (evt.source === 'player' && evt.ability_name) {
        if (evt.kind === 'ability_fired' || evt.kind === 'mana_spent' || evt.kind === 'effect_applied') {
          firedNames.add(evt.ability_name);
        }
      }
    }
    if (firedNames.size === 0) return;

    // Apply flash to matching chips by data-ability-name
    const chips = this.autoIndicatorsEl.querySelectorAll<HTMLElement>('.cs-ability-slot');
    for (const chip of chips) {
      const abilityName = chip.dataset['abilityName'];
      if (abilityName && firedNames.has(abilityName)) {
        chip.classList.remove('cs-flash');
        // Force reflow to restart animation
        void chip.offsetWidth;
        chip.classList.add('cs-flash');
      }
    }
  }

  private ensureFlashStyles(): void {
    if (document.getElementById('cs-ability-flash-style')) return;
    const style = document.createElement('style');
    style.id = 'cs-ability-flash-style';
    style.textContent = `
      .cs-ability-slot {
        border: 2px solid #3a2e1a;
        box-shadow: none;
      }
      .cs-ability-slot.cs-flash {
        animation: cs-slot-flash 0.8s ease-out forwards;
      }
      @keyframes cs-slot-flash {
        0%   { box-shadow: 0 0 0 0 rgba(240,192,96,0); border-color: #f0c060; }
        15%  { box-shadow: 0 0 16px 4px rgba(240,192,96,0.9); border-color: #f0c060; }
        40%  { box-shadow: 0 0 10px 2px rgba(240,192,96,0.5); border-color: #d4a84b; }
        100% { box-shadow: 0 0 0 0 rgba(240,192,96,0); border-color: #3a2e1a; }
      }
      /* Attack impact — shake the target icon */
      .cs-icon-shake {
        animation: cs-shake 0.4s ease-out;
      }
      @keyframes cs-shake {
        0%   { transform: translate(0, 0); }
        15%  { transform: translate(-6px, 2px); }
        30%  { transform: translate(5px, -3px); }
        45%  { transform: translate(-4px, 1px); }
        60%  { transform: translate(3px, -1px); }
        75%  { transform: translate(-2px, 1px); }
        100% { transform: translate(0, 0); }
      }
      /* Red flash overlay on damaged icon */
      .cs-icon-hit-flash {
        animation: cs-hit-flash 0.5s ease-out forwards;
      }
      @keyframes cs-hit-flash {
        0%   { opacity: 0.6; }
        100% { opacity: 0; }
      }
      /* Slash overlay across the icon */
      .cs-slash-effect {
        animation: cs-slash 0.45s ease-out forwards;
      }
      @keyframes cs-slash {
        0%   { opacity: 0; transform: translate(-50%, -50%) rotate(-45deg) scaleX(0); }
        20%  { opacity: 1; transform: translate(-50%, -50%) rotate(-45deg) scaleX(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) rotate(-45deg) scaleX(1.3); }
      }
      /* Victory modal entrance */
      .cs-victory-modal {
        animation: cs-victory-scale-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
      }
      @keyframes cs-victory-scale-in {
        from { opacity: 0; transform: scale(0.7); }
        to   { opacity: 1; transform: scale(1); }
      }
      /* Victory title glow */
      .cs-victory-title-glow {
        animation: cs-victory-glow 2s ease-in-out infinite;
      }
      @keyframes cs-victory-glow {
        0%, 100% { text-shadow: 0 0 8px rgba(240,192,96,0.4), 0 2px 8px rgba(0,0,0,0.8); }
        50%      { text-shadow: 0 0 20px rgba(240,192,96,0.8), 0 0 40px rgba(212,168,75,0.3), 0 2px 8px rgba(0,0,0,0.8); }
      }
      /* Defeat title pulse */
      .cs-defeat-title-glow {
        animation: cs-defeat-glow 2s ease-in-out infinite;
      }
      @keyframes cs-defeat-glow {
        0%, 100% { text-shadow: 0 0 8px rgba(192,57,43,0.4), 0 2px 8px rgba(0,0,0,0.8); }
        50%      { text-shadow: 0 0 20px rgba(192,57,43,0.8), 0 0 40px rgba(192,57,43,0.3), 0 2px 8px rgba(0,0,0,0.8); }
      }
      /* Shimmer bar */
      .cs-shimmer-bar {
        animation: cs-shimmer 2s linear infinite;
        background-size: 200% 100%;
      }
      @keyframes cs-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      /* Loot item slide-in */
      .cs-loot-slide-in {
        opacity: 0;
        animation: cs-loot-slide 0.35s ease-out forwards;
      }
      @keyframes cs-loot-slide {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      /* Victory overlay fade-in */
      .cs-victory-overlay {
        animation: cs-victory-fade 0.3s ease-out forwards;
      }
      @keyframes cs-victory-fade {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Floating combat numbers
  // ---------------------------------------------------------------------------

  /**
   * Plays attack impacts immediately, then floating numbers after `numberDelay` ms.
   */
  private spawnCombatEffects(events: CombatEventDto[], numberDelay: number): void {
    this.ensureFloatingStyles();

    let playerStagger = 0;
    let enemyStagger = 0;

    for (const evt of events) {
      if (evt.value === undefined || evt.value === 0) continue;

      if (evt.kind === 'auto_attack' || evt.kind === 'ability_fired') {
        const targetEl = evt.target === 'player' ? this.playerIconEl : this.enemyIconEl;
        const stagger = evt.target === 'player' ? (playerStagger += 150) - 150 : (enemyStagger += 150) - 150;
        const slashColor = evt.source === 'player' ? '#f0c060' : '#e74c3c';

        // Attack impact plays immediately (within this timeout context)
        this.showAttackImpact(targetEl, slashColor, stagger);

        // Floating number appears after the slash animation finishes
        if (evt.is_crit) {
          this.showFloating(targetEl, `-${evt.value}`, '#ff4444', stagger + numberDelay, true);
        } else {
          this.showFloating(targetEl, `-${evt.value}`, '#e74c3c', stagger + numberDelay, false);
        }
      } else if (evt.kind === 'mana_gained') {
        this.showFloating(this.playerIconEl, `+${evt.value} MP`, '#5dade2', playerStagger + numberDelay, false);
        playerStagger += 150;
      } else if (evt.kind === 'effect_tick') {
        const targetEl = evt.target === 'player' ? this.playerIconEl : this.enemyIconEl;
        const stagger = evt.target === 'player' ? (playerStagger += 150) - 150 : (enemyStagger += 150) - 150;
        this.showFloating(targetEl, `-${evt.value}`, '#e67e22', stagger + numberDelay, false);
      }
    }
  }

  private showFloating(
    anchor: HTMLElement | null,
    text: string,
    color: string,
    delay: number,
    isCrit: boolean,
  ): void {
    if (!anchor) return;

    setTimeout(() => {
      const rect = anchor.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'cs-floating-num';
      el.textContent = text;
      el.style.cssText = [
        'position:fixed', 'z-index:9999', 'pointer-events:none',
        'font-family:Cinzel,serif', 'font-weight:700',
        `font-size:${isCrit ? '1.8rem' : '1.3rem'}`,
        `color:${color}`,
        `text-shadow:0 0 6px ${color}80, 0 2px 4px rgba(0,0,0,0.9)`,
        `left:${rect.left + rect.width / 2}px`,
        `top:${rect.top + rect.height * 0.3}px`,
        'transform:translateX(-50%)',
        'animation:cs-float-up 1.2s ease-out forwards',
      ].join(';');
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }, delay);
  }

  private showAttackImpact(
    anchor: HTMLElement | null,
    slashColor: string,
    delay: number,
  ): void {
    if (!anchor) return;

    setTimeout(() => {
      // 1) Shake the icon
      anchor.classList.remove('cs-icon-shake');
      void anchor.offsetWidth;
      anchor.classList.add('cs-icon-shake');
      anchor.addEventListener('animationend', () => anchor.classList.remove('cs-icon-shake'), { once: true });

      // 2) Red/gold flash overlay on the icon
      const flash = document.createElement('div');
      flash.className = 'cs-icon-hit-flash';
      flash.style.cssText = [
        'position:absolute', 'inset:0', 'pointer-events:none',
        `background:${slashColor}`, 'border-radius:4px', 'z-index:2',
      ].join(';');
      anchor.style.position = 'relative';
      anchor.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());

      // 3) Slash streak across the icon
      const rect = anchor.getBoundingClientRect();
      const slash = document.createElement('div');
      slash.className = 'cs-slash-effect';
      slash.style.cssText = [
        'position:fixed', 'pointer-events:none', 'z-index:9998',
        `left:${rect.left + rect.width / 2}px`,
        `top:${rect.top + rect.height / 2}px`,
        `width:${rect.width * 1.2}px`, 'height:3px',
        `background:linear-gradient(90deg, transparent, ${slashColor}, white, ${slashColor}, transparent)`,
        'border-radius:2px',
        `box-shadow:0 0 8px ${slashColor}`,
      ].join(';');
      document.body.appendChild(slash);
      slash.addEventListener('animationend', () => slash.remove());
    }, delay);
  }

  private ensureFloatingStyles(): void {
    if (document.getElementById('cs-floating-style')) return;
    const style = document.createElement('style');
    style.id = 'cs-floating-style';
    style.textContent = `
      @keyframes cs-float-up {
        0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
        15%  { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1); }
        70%  { opacity: 1; }
        100% { opacity: 0; transform: translateX(-50%) translateY(-80px); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Active window helpers
  // ---------------------------------------------------------------------------

  private lockActiveButton(): void {
    if (this.activeButtonEl) {
      this.activeButtonEl.disabled = true;
      this.activeButtonEl.style.opacity = '0.4';
      this.activeButtonEl.style.boxShadow = '';
    }
    if (this.activeTimerEl) {
      this.activeTimerEl.style.visibility = 'hidden';
    }
  }

  private clearActiveWindowTimer(): void {
    if (this.activeWindowInterval !== null) {
      clearInterval(this.activeWindowInterval);
      this.activeWindowInterval = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Combat log
  // ---------------------------------------------------------------------------

  private appendLogLine(text: string): void {
    if (!this.combatLogEl) return;
    const line = document.createElement('div');
    line.textContent = text;
    this.combatLogEl.appendChild(line);
    this.combatLogEl.scrollTop = this.combatLogEl.scrollHeight;
  }

  private formatEvent(evt: CombatEventDto): string {
    const enemyLabel = this.bossName ?? 'Enemy';
    const src = evt.source === 'player' ? 'You' : enemyLabel;
    const tgt = evt.target === 'player' ? 'you' : enemyLabel.toLowerCase();

    // Flash boss ability slot when boss fires an ability
    if (this.variant === 'boss' && evt.source === 'enemy' &&
        (evt.kind === 'ability_fired' || evt.kind === 'effect_applied') && evt.ability_name) {
      this.flashBossAbilitySlot(evt.ability_name);
    }

    switch (evt.kind) {
      case 'auto_attack':
        if (evt.is_crit) return `💥 ${src} crit ${tgt} for ${evt.value ?? 0} dmg!`;
        return `⚔ ${src} attacked ${tgt} for ${evt.value ?? 0} dmg`;
      case 'ability_fired':
        return `✨ ${src} used ${evt.ability_name ?? 'ability'} on ${tgt} (${evt.value ?? 0})`;
      case 'mana_gained':
        return `💧 +${evt.value ?? 0} mana`;
      case 'mana_spent':
        return `💧 -${evt.value ?? 0} mana (${evt.ability_name ?? ''})`;
      case 'dodge':
        return `🌀 ${tgt} dodged the attack`;
      case 'crit':
        return `💥 Critical hit!`;
      case 'effect_applied':
        return `🔮 ${evt.ability_name ?? 'Effect'} applied to ${tgt}`;
      case 'effect_tick':
        return `🔥 ${evt.effect_name ?? 'DoT'} deals ${evt.value ?? 0} to ${tgt}`;
      case 'effect_expired':
        return `✅ ${evt.effect_name ?? 'Effect'} on ${tgt} expired`;
      default:
        return `• ${evt.kind}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Active effect indicators (buff/debuff icons flanking combatant icons)
  // ---------------------------------------------------------------------------

  /** Classify an effect as buff (positive for target) or debuff (negative for target). */
  private static classifyEffect(e: ActiveEffectDto): 'buff' | 'debuff' {
    if (e.effect_type === 'buff') return 'buff';
    // reflect and shield are positive for the entity that owns them
    if (e.effect_type === 'reflect' || e.effect_type === 'shield') return 'buff';
    return 'debuff'; // debuff, dot
  }

  /** Human-readable label for effect type. */
  private static effectLabel(e: ActiveEffectDto): string {
    switch (e.effect_type) {
      case 'buff': return e.stat === 'defence' ? 'DEF Up' : 'ATK Up';
      case 'debuff': return e.stat === 'defence' ? 'DEF Down' : 'Weakened';
      case 'dot': return 'Poison';
      case 'reflect': return 'Reflect';
      case 'shield': return 'Shield';
      default: return e.effect_type;
    }
  }

  /** Short abbreviation for effect chip when no icon available. */
  private static effectAbbrev(e: ActiveEffectDto): string {
    switch (e.effect_type) {
      case 'buff': return e.stat === 'defence' ? 'DEF' : 'ATK';
      case 'debuff': return e.stat === 'defence' ? 'DEF' : 'WKN';
      case 'dot': return 'DOT';
      case 'reflect': return 'RFL';
      case 'shield': return 'SHL';
      default: return '?';
    }
  }

  /** Update all four effect containers based on the latest active_effects array. */
  private updateActiveEffects(effects: ActiveEffectDto[]): void {
    // Separate effects by target
    const playerEffects = effects.filter((e) => e.target === 'player');
    const enemyEffects = effects.filter((e) => e.target === 'enemy');

    // Player side
    const playerBuffs = playerEffects.filter((e) => CombatScreen.classifyEffect(e) === 'buff');
    const playerDebuffs = playerEffects.filter((e) => CombatScreen.classifyEffect(e) === 'debuff');
    this.renderEffectColumn(this.playerBuffsEl, playerBuffs, 'buff');
    this.renderEffectColumn(this.playerDebuffsEl, playerDebuffs, 'debuff');

    // Enemy side
    const enemyBuffs = enemyEffects.filter((e) => CombatScreen.classifyEffect(e) === 'buff');
    const enemyDebuffs = enemyEffects.filter((e) => CombatScreen.classifyEffect(e) === 'debuff');
    this.renderEffectColumn(this.enemyBuffsEl, enemyBuffs, 'buff');
    this.renderEffectColumn(this.enemyDebuffsEl, enemyDebuffs, 'debuff');
  }

  private renderEffectColumn(container: HTMLElement | null, effects: ActiveEffectDto[], kind: 'buff' | 'debuff'): void {
    if (!container) return;
    container.innerHTML = '';

    for (const effect of effects) {
      const chip = document.createElement('div');
      const borderColor = kind === 'buff' ? '#3a8a3a' : '#8a3a3a';
      const bgColor = kind === 'buff' ? '#1a2a1a' : '#2a1a1a';
      chip.style.cssText = [
        'width:26px', 'height:26px', 'border-radius:3px',
        `border:2px solid ${borderColor}`,
        `background:${bgColor}`,
        'display:flex', 'align-items:center', 'justify-content:center',
        'position:relative', 'cursor:default', 'overflow:hidden',
        'transition:border-color 0.2s,box-shadow 0.2s',
      ].join(';');

      // Skill icon or abbreviation fallback
      if (effect.icon_url) {
        const img = document.createElement('img');
        img.src = effect.icon_url;
        img.alt = effect.ability_name;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;border-radius:1px;';
        img.onerror = () => {
          img.remove();
          const abbr = document.createElement('span');
          abbr.style.cssText = 'font-size:0.45rem;font-weight:700;color:#c0b080;letter-spacing:0.02em;text-transform:uppercase;line-height:1;';
          abbr.textContent = CombatScreen.effectAbbrev(effect);
          chip.insertBefore(abbr, chip.firstChild);
        };
        chip.appendChild(img);
      } else {
        const abbr = document.createElement('span');
        abbr.style.cssText = 'font-size:0.45rem;font-weight:700;color:#c0b080;letter-spacing:0.02em;text-transform:uppercase;line-height:1;';
        abbr.textContent = CombatScreen.effectAbbrev(effect);
        chip.appendChild(abbr);
      }

      // Turn counter badge
      const badge = document.createElement('span');
      badge.style.cssText = [
        'position:absolute', 'bottom:-3px', 'right:-3px',
        'min-width:12px', 'height:12px', 'border-radius:6px',
        'font-size:0.4rem', 'font-weight:700', 'color:#fff',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:0 2px',
        `background:${kind === 'buff' ? '#2d7a2d' : '#7a2d2d'}`,
        'border:1px solid #0a0a0a',
      ].join(';');
      badge.textContent = `${effect.turns_remaining}`;
      chip.appendChild(badge);

      // Hover tooltip
      chip.addEventListener('mouseenter', (ev) => this.showEffectTooltip(ev as MouseEvent, effect, kind));
      chip.addEventListener('mouseleave', () => this.removeEffectTooltip());

      // Hover glow
      chip.addEventListener('mouseenter', () => {
        chip.style.borderColor = kind === 'buff' ? '#5ada5a' : '#da5a5a';
        chip.style.boxShadow = kind === 'buff' ? '0 0 6px rgba(90,218,90,0.5)' : '0 0 6px rgba(218,90,90,0.5)';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.borderColor = borderColor;
        chip.style.boxShadow = 'none';
      });

      container.appendChild(chip);
    }
  }

  private showEffectTooltip(ev: MouseEvent, effect: ActiveEffectDto, kind: 'buff' | 'debuff'): void {
    this.removeEffectTooltip();

    const tip = document.createElement('div');
    tip.style.cssText = [
      'position:fixed', 'z-index:9999', 'pointer-events:none',
      'background:linear-gradient(180deg,#1e1a12 0%,#141008 100%)',
      'border:1px solid #5a4a2a', 'border-radius:4px',
      'padding:8px 12px', 'min-width:140px', 'max-width:220px',
      'font-family:Cinzel,serif',
    ].join(';');

    // Name
    const nameEl = document.createElement('div');
    const accentColor = kind === 'buff' ? '#5ade5a' : '#de5a5a';
    nameEl.style.cssText = `font-size:0.72rem;font-weight:700;color:${accentColor};margin-bottom:4px;border-bottom:1px solid #2a2010;padding-bottom:3px;`;
    nameEl.textContent = effect.ability_name;
    tip.appendChild(nameEl);

    // Effect type label
    const typeEl = document.createElement('div');
    typeEl.style.cssText = 'font-size:0.62rem;color:#b0a070;margin-bottom:3px;';
    typeEl.textContent = CombatScreen.effectLabel(effect);
    if (effect.value) {
      typeEl.textContent += ` (${effect.value}%)`;
    }
    tip.appendChild(typeEl);

    // Turns remaining
    const turnsEl = document.createElement('div');
    turnsEl.style.cssText = 'font-size:0.6rem;color:#8a7a50;';
    turnsEl.textContent = effect.turns_remaining === 1
      ? '1 turn remaining'
      : `${effect.turns_remaining} turns remaining`;
    tip.appendChild(turnsEl);

    document.body.appendChild(tip);

    // Position near cursor
    const rect = tip.getBoundingClientRect();
    let x = ev.clientX + 12;
    let y = ev.clientY - rect.height - 8;
    if (y < 4) y = ev.clientY + 12;
    if (x + rect.width > window.innerWidth - 4) x = ev.clientX - rect.width - 12;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;

    this.effectTooltipEl = tip;
  }

  private removeEffectTooltip(): void {
    if (this.effectTooltipEl) {
      this.effectTooltipEl.remove();
      this.effectTooltipEl = null;
    }
  }
}
