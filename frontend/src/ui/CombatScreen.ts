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
} from '../../../shared/protocol/index';

// Border style constants
const BORDER_IDLE   = '3px solid #5a4a2a';
const BORDER_ACTIVE = '3px solid #f0c060';
const SHADOW_ACTIVE = '0 0 12px rgba(240,192,96,0.7)';
const SHADOW_IDLE   = 'none';

// Delay before player HP drops after enemy attacks (animation placeholder)
const ENEMY_ATTACK_LAND_MS = 900;

export class CombatScreen {
  private overlay: HTMLElement | null = null;
  private onTriggerActive: () => void;
  private onClose: (() => void) | null = null;

  /** When true, combat UI is rendered inside an external container (no backdrop) */
  private embedded = false;

  // State stored from combat:start
  private combatId: string | null = null;
  private playerMaxHp = 0;
  private playerMaxMana = 0;
  private enemyMaxHp = 0;

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

    this.embedded      = false;
    this.combatId      = payload.combat_id;
    this.playerMaxHp   = payload.player.max_hp;
    this.playerMaxMana = payload.player.max_mana;
    this.enemyMaxHp    = payload.monster.max_hp;

    this.ensureFlashStyles();
    this.buildOverlay(payload);
  }

  /** Render combat UI inside an external container (no backdrop overlay). */
  openEmbedded(payload: CombatStartPayload, container: HTMLElement): void {
    this.close();

    this.embedded      = true;
    this.combatId      = payload.combat_id;
    this.playerMaxHp   = payload.player.max_hp;
    this.playerMaxMana = payload.player.max_mana;
    this.enemyMaxHp    = payload.monster.max_hp;

    this.ensureFlashStyles();
    this.buildOverlay(payload, container);
  }

  applyTurnResult(payload: CombatTurnResultPayload): void {
    if (!this.overlay) return;

    this.updateAbilityStates(payload.ability_states);

    for (const evt of payload.events) {
      this.appendLogLine(this.formatEvent(evt));
    }

    // Flash auto-ability slots that fired this turn
    this.flashFiredAbilities(payload);

    // Spawn floating numbers for relevant events
    this.spawnFloatingNumbers(payload.events);

    const lastAttack = [...payload.events].reverse().find(
      (e) => e.kind === 'auto_attack' || e.kind === 'ability_fired',
    );

    if (lastAttack && lastAttack.source !== 'player') {
      // Enemy's turn: highlight enemy immediately, delay the HP drop so it feels
      // like the attack animation lands rather than being instant.
      this.setTurnIndicator('enemy');
      this.setEnemyHp(payload.enemy_hp);   // DoT / reflect on enemy can update now
      this.setPlayerMana(payload.player_mana);
      setTimeout(() => {
        if (!this.overlay) return;         // combat may have ended in the meantime
        this.setPlayerHp(payload.player_hp);
      }, ENEMY_ATTACK_LAND_MS);
    } else {
      // Player's turn: everything updates immediately
      this.setEnemyHp(payload.enemy_hp);
      this.setPlayerHp(payload.player_hp);
      this.setPlayerMana(payload.player_mana);
      if (lastAttack) this.setTurnIndicator('player');
    }
  }

  openActiveWindow(payload: CombatActiveWindowPayload): void {
    if (!this.overlay) return;

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
  }

  showOutcome(payload: CombatEndPayload): void {
    this.clearActiveWindowTimer();

    // Remove combat overlay entirely to avoid double-darkening
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    const win = payload.outcome === 'win';

    // Fresh overlay — single semi-transparent backdrop
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:300',
      'background:rgba(0,0,0,0.65)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:Cinzel,serif', 'color:#c9a55c',
    ].join(';');

    // Result modal — same styling as the combat modal
    const modal = document.createElement('div');
    modal.style.cssText = [
      'width:400px', 'max-width:90vw',
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.9)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:20px 16px 14px',
      'text-align:center',
      'background:#111008',
      'border-bottom:1px solid #3a2e1a',
    ].join(';');

    const title = document.createElement('div');
    title.style.cssText = [
      'font-size:1.8rem', 'font-weight:700',
      `color:${win ? '#f0c060' : '#c0392b'}`,
      'text-shadow:0 2px 8px rgba(0,0,0,0.8)',
      'letter-spacing:0.06em',
    ].join(';');
    title.textContent = win ? 'Victory!' : 'Defeated';
    header.appendChild(title);

    if (!win) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.75rem;color:#8a7050;margin-top:6px;';
      sub.textContent = 'You have fallen in battle.';
      header.appendChild(sub);
    }

    modal.appendChild(header);

    // ── Rewards body (win only) ──
    if (win) {
      const body = document.createElement('div');
      body.style.cssText = 'padding:14px 16px;display:flex;flex-direction:column;gap:8px;';

      // XP row
      if (payload.xp_gained > 0) {
        body.appendChild(this.buildRewardRow(
          this.buildTextIcon('✦', '#a78bfa'),
          `+${payload.xp_gained} XP`,
          '#a78bfa',
        ));
      }

      // Crowns row
      if (payload.crowns_gained > 0) {
        body.appendChild(this.buildRewardRow(
          this.buildTextIcon('♛', '#f0c060'),
          `+${payload.crowns_gained} Crowns`,
          '#f0c060',
        ));
      }

      // Item drops
      for (const item of payload.items_dropped) {
        const icon = item.icon_url
          ? this.buildImgIcon(item.icon_url, item.name)
          : this.buildTextIcon('◆', '#c9a55c');
        body.appendChild(this.buildRewardRow(icon, `${item.name} ×${item.quantity}`, '#c9a55c'));
      }

      // Ability drops
      for (const ability of payload.ability_drops) {
        const icon = ability.icon_url
          ? this.buildImgIcon(ability.icon_url, ability.name)
          : this.buildTextIcon('✦', '#6ab4e8');
        body.appendChild(this.buildRewardRow(icon, `New: ${ability.name}`, '#6ab4e8'));
      }

      // Nothing dropped
      if (payload.xp_gained === 0 && payload.crowns_gained === 0
        && payload.items_dropped.length === 0 && payload.ability_drops.length === 0) {
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
      'padding:12px 16px 16px',
      'display:flex', 'justify-content:center',
      'border-top:1px solid #2a2010',
      'background:#0a0806',
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Continue';
    closeBtn.style.cssText = [
      'padding:8px 36px', 'font-family:Cinzel,serif',
      'font-size:0.9rem', 'font-weight:600', 'color:#1a1510',
      'background:#d4a84b', 'border:1px solid #b8922e', 'cursor:pointer',
      'border-radius:3px', 'letter-spacing:0.05em',
      'transition:background 0.15s',
    ].join(';');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e8c060'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#d4a84b'; });
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

  getCombatId(): string | null {
    return this.combatId;
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

    const { bar: enemyHpBarWrap, fill: enemyHpFill, text: enemyHpText } =
      this.buildBar('#c0392b', payload.monster.max_hp, payload.monster.max_hp);
    this.enemyHpBar  = enemyHpFill;
    this.enemyHpText = enemyHpText;

    enemySide.appendChild(enemyNameplate);
    enemySide.appendChild(enemyIcon);
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

    playerSide.appendChild(playerNameplate);
    playerSide.appendChild(playerIcon);
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
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Floating combat numbers
  // ---------------------------------------------------------------------------

  private spawnFloatingNumbers(events: CombatEventDto[]): void {
    this.ensureFloatingStyles();

    let playerDelay = 0;
    let enemyDelay = 0;

    for (const evt of events) {
      if (evt.value === undefined || evt.value === 0) continue;

      if (evt.kind === 'auto_attack' || evt.kind === 'ability_fired') {
        // Damage dealt
        const targetEl = evt.target === 'player' ? this.playerIconEl : this.enemyIconEl;
        const delay = evt.target === 'player' ? (playerDelay += 150) - 150 : (enemyDelay += 150) - 150;
        if (evt.is_crit) {
          this.showFloating(targetEl, `-${evt.value}`, '#ff4444', delay, true);
        } else {
          this.showFloating(targetEl, `-${evt.value}`, '#e74c3c', delay, false);
        }
      } else if (evt.kind === 'mana_gained') {
        this.showFloating(this.playerIconEl, `+${evt.value} MP`, '#5dade2', playerDelay, false);
        playerDelay += 150;
      } else if (evt.kind === 'effect_tick') {
        // DoT damage
        const targetEl = evt.target === 'player' ? this.playerIconEl : this.enemyIconEl;
        const delay = evt.target === 'player' ? (playerDelay += 150) - 150 : (enemyDelay += 150) - 150;
        this.showFloating(targetEl, `-${evt.value}`, '#e67e22', delay, false);
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
        `font-size:${isCrit ? '1.3rem' : '1rem'}`,
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

  private ensureFloatingStyles(): void {
    if (document.getElementById('cs-floating-style')) return;
    const style = document.createElement('style');
    style.id = 'cs-floating-style';
    style.textContent = `
      @keyframes cs-float-up {
        0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
        70%  { opacity: 1; }
        100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
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
    const src = evt.source === 'player' ? 'You' : 'Enemy';
    const tgt = evt.target === 'player' ? 'you' : 'enemy';

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
}
