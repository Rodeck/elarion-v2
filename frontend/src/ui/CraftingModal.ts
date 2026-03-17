import type {
  CraftingRecipeDto,
  CraftingSessionDto,
  CraftingStatePayload,
  CraftingStartedPayload,
  CraftingCancelledPayload,
  CraftingCollectedPayload,
  CraftingRejectedPayload,
} from '@elarion/protocol';

type SendFn = <T>(type: string, payload: T) => void;

export class CraftingModal {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;
  private sendFn: SendFn | null = null;
  private npcId: number = 0;
  private recipes: CraftingRecipeDto[] = [];
  private activeSessions: CraftingSessionDto[] = [];
  private progressIntervals: number[] = [];
  private feedbackEl: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  open(npcId: number): void {
    this.npcId = npcId;
    this.close();
    this.buildOverlay();
    this.renderLoading();
  }

  close(): void {
    this.clearIntervals();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  getNpcId(): number {
    return this.npcId;
  }

  // ---------------------------------------------------------------------------
  // State updates from server messages
  // ---------------------------------------------------------------------------

  handleState(payload: CraftingStatePayload): void {
    this.npcId = payload.npc_id;
    this.recipes = payload.recipes;
    this.activeSessions = payload.active_sessions;
    if (!this.overlay) {
      this.open(payload.npc_id);
    }
    this.renderRecipes();
  }

  handleStarted(payload: CraftingStartedPayload): void {
    this.activeSessions.push(payload.session);
    this.renderRecipes();
  }

  handleCancelled(payload: CraftingCancelledPayload): void {
    this.activeSessions = this.activeSessions.filter((s) => s.id !== payload.session_id);
    this.renderRecipes();
    this.showFeedback(`Crafting cancelled. Refunded ${payload.refunded_crowns} Crowns.`, '#b8e870');
  }

  handleCollected(payload: CraftingCollectedPayload): void {
    this.activeSessions = this.activeSessions.filter((s) => s.id !== payload.session_id);
    this.renderRecipes();
    const items = payload.items_received.map((i) => `${i.quantity}x items`).join(', ');
    this.showFeedback(`Collected ${items}!`, '#b8e870');
  }

  handleRejected(payload: CraftingRejectedPayload): void {
    const messages: Record<string, string> = {
      NOT_AT_NPC: 'You are not near this NPC.',
      NPC_NOT_CRAFTER: 'This NPC does not offer crafting.',
      RECIPE_NOT_FOUND: 'Recipe not found.',
      INSUFFICIENT_MATERIALS: payload.details ?? 'Not enough materials.',
      INSUFFICIENT_CROWNS: payload.details ?? 'Not enough Crowns.',
      ALREADY_CRAFTING: 'Already crafting this recipe.',
      INVALID_QUANTITY: 'Invalid quantity.',
      SESSION_NOT_FOUND: 'Session not found.',
      SESSION_NOT_IN_PROGRESS: 'This session is not in progress.',
      SESSION_NOT_COMPLETED: payload.details ?? 'Crafting not yet complete.',
      INVENTORY_FULL: payload.details ?? 'Inventory is full.',
      ITEM_DEF_NOT_FOUND: 'Item definition not found.',
    };
    this.showFeedback(messages[payload.reason] ?? 'Crafting failed.', '#c0504a');
    this.enableAllButtons();
  }

  // ---------------------------------------------------------------------------
  // Overlay structure
  // ---------------------------------------------------------------------------

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.72)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:200',
    ].join(';');

    const modal = document.createElement('div');
    modal.id = 'crafting-modal';
    modal.style.cssText = [
      'background:#1a1510',
      'border:1px solid #5a4a2a',
      'width:480px',
      'max-height:85vh',
      'display:flex',
      'flex-direction:column',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'box-sizing:border-box',
      'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:14px 18px 10px;border-bottom:1px solid #3a2e1a;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';

    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:15px;letter-spacing:0.08em;color:#e8c870;';
    title.textContent = 'Crafting';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#7a6a4a;font-size:18px;cursor:pointer;padding:0 4px;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#e8c870'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#7a6a4a'; });
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.id = 'crafting-body';
    body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:14px;';
    modal.appendChild(body);

    // Feedback area
    const feedback = document.createElement('div');
    feedback.id = 'crafting-feedback';
    feedback.style.cssText = 'padding:0 18px 10px;flex-shrink:0;display:none;';
    modal.appendChild(feedback);
    this.feedbackEl = feedback;

    overlay.appendChild(modal);
    this.parent.appendChild(overlay);
    this.overlay = overlay;
  }

  private getBody(): HTMLElement {
    return this.overlay!.querySelector('#crafting-body') as HTMLElement;
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  private renderLoading(): void {
    const body = this.getBody();
    body.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = 'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#7a6a4a;font-style:italic;';
    p.textContent = 'Loading recipes...';
    body.appendChild(p);
  }

  private clearIntervals(): void {
    for (const id of this.progressIntervals) window.clearInterval(id);
    this.progressIntervals = [];
  }

  private renderRecipes(): void {
    this.clearIntervals();
    const body = this.getBody();
    body.innerHTML = '';

    if (this.recipes.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#7a6a4a;font-style:italic;';
      p.textContent = 'No recipes available.';
      body.appendChild(p);
      return;
    }

    for (const recipe of this.recipes) {
      const activeSession = this.activeSessions.find((s) => s.recipe_id === recipe.id);
      body.appendChild(this.renderRecipeCard(recipe, activeSession));
    }
  }

  private renderRecipeCard(recipe: CraftingRecipeDto, session: CraftingSessionDto | undefined): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = [
      'border:1px solid #3a2e1a',
      'border-radius:4px',
      'padding:12px',
      'background:rgba(20,16,8,0.7)',
    ].join(';');

    // ── Recipe header (output item) ──
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    if (recipe.output_item.icon_url) {
      const icon = document.createElement('img');
      icon.src = recipe.output_item.icon_url;
      icon.alt = recipe.output_item.name;
      icon.style.cssText = 'width:36px;height:36px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;';
      headerRow.appendChild(icon);
    }

    const nameCol = document.createElement('div');
    nameCol.style.cssText = 'flex:1;';

    const nameEl = document.createElement('p');
    nameEl.style.cssText = 'margin:0;font-size:13px;color:#e8c870;letter-spacing:0.04em;';
    nameEl.textContent = recipe.name;
    nameCol.appendChild(nameEl);

    const outputEl = document.createElement('p');
    outputEl.style.cssText = 'margin:2px 0 0;font-family:"Crimson Text",serif;font-size:12px;color:#a89060;';
    outputEl.textContent = `Produces: ${recipe.output_quantity}x ${recipe.output_item.name}`;
    nameCol.appendChild(outputEl);

    headerRow.appendChild(nameCol);
    card.appendChild(headerRow);

    // ── Ingredients ──
    const ingRow = document.createElement('div');
    ingRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;';

    for (const ing of recipe.ingredients) {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:3px',
        'padding:2px 6px',
        'background:rgba(90,74,42,0.3)',
        'border:1px solid #3a2e1a',
        'font-family:"Crimson Text",serif',
        'font-size:11px',
        'color:#a89060',
      ].join(';');

      if (ing.item_icon_url) {
        const icon = document.createElement('img');
        icon.src = ing.item_icon_url;
        icon.style.cssText = 'width:14px;height:14px;object-fit:contain;image-rendering:pixelated;';
        chip.appendChild(icon);
      }

      chip.appendChild(document.createTextNode(`${ing.quantity}x ${ing.item_name}`));
      ingRow.appendChild(chip);
    }

    if (recipe.cost_crowns > 0) {
      const crownChip = document.createElement('span');
      crownChip.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:3px',
        'padding:2px 6px',
        'background:rgba(90,74,42,0.3)',
        'border:1px solid #3a2e1a',
        'font-family:"Crimson Text",serif',
        'font-size:11px',
        'color:#d4a84b',
      ].join(';');
      crownChip.textContent = `${recipe.cost_crowns} Crowns`;
      ingRow.appendChild(crownChip);
    }

    card.appendChild(ingRow);

    // ── Time info ──
    const timeEl = document.createElement('p');
    timeEl.style.cssText = 'margin:0 0 8px;font-family:"Crimson Text",serif;font-size:11px;color:#6a5a3a;';
    timeEl.textContent = `Craft time: ${this.formatDuration(recipe.craft_time_seconds)} per unit`;
    card.appendChild(timeEl);

    // ── Active session (progress bar + cancel/collect) ──
    if (session) {
      card.appendChild(this.renderSessionProgress(session));
    } else {
      // ── Quantity selection + Start button ──
      card.appendChild(this.renderQuantitySelector(recipe));
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // Quantity selector
  // ---------------------------------------------------------------------------

  private renderQuantitySelector(recipe: CraftingRecipeDto): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    let selectedQty = 1;

    const qtyLabel = document.createElement('span');
    qtyLabel.style.cssText = 'font-family:"Crimson Text",serif;font-size:12px;color:#7a6a4a;';
    qtyLabel.textContent = 'Qty:';
    container.appendChild(qtyLabel);

    const presets = [1, 5, 20];
    const presetBtns: HTMLButtonElement[] = [];

    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.min = '1';
    customInput.value = '';
    customInput.placeholder = 'n';
    customInput.style.cssText = [
      'width:42px',
      'padding:4px 6px',
      'background:rgba(20,16,8,0.9)',
      'border:1px solid #3a2e1a',
      'color:#e8c870',
      'font-family:"Crimson Text",serif',
      'font-size:12px',
      'text-align:center',
    ].join(';');

    const updateSelected = (qty: number, fromPreset: boolean): void => {
      selectedQty = qty;
      for (const btn of presetBtns) {
        btn.style.background = parseInt(btn.dataset['qty'] ?? '0', 10) === qty ? 'rgba(90,74,42,0.7)' : 'rgba(90,74,42,0.3)';
      }
      if (fromPreset) customInput.value = '';
    };

    for (const n of presets) {
      const btn = document.createElement('button');
      btn.dataset['qty'] = String(n);
      btn.style.cssText = [
        'padding:4px 10px',
        n === 1 ? 'background:rgba(90,74,42,0.7)' : 'background:rgba(90,74,42,0.3)',
        'border:1px solid #5a4a2a',
        'color:#e8c870',
        'font-family:Cinzel,serif',
        'font-size:11px',
        'cursor:pointer',
      ].join(';');
      btn.textContent = `${n}x`;
      btn.addEventListener('click', () => updateSelected(n, true));
      presetBtns.push(btn);
      container.appendChild(btn);
    }

    customInput.addEventListener('input', () => {
      const val = parseInt(customInput.value, 10);
      if (val > 0) updateSelected(val, false);
    });
    container.appendChild(customInput);

    const startBtn = document.createElement('button');
    startBtn.style.cssText = [
      'margin-left:auto',
      'padding:6px 14px',
      'background:rgba(60,90,40,0.6)',
      'border:1px solid #5a8a3a',
      'color:#b8e870',
      'font-family:Cinzel,serif',
      'font-size:11px',
      'letter-spacing:0.04em',
      'cursor:pointer',
    ].join(';');
    startBtn.textContent = 'Craft';
    startBtn.addEventListener('mouseenter', () => { startBtn.style.background = 'rgba(60,90,40,0.9)'; });
    startBtn.addEventListener('mouseleave', () => { startBtn.style.background = 'rgba(60,90,40,0.6)'; });
    startBtn.addEventListener('click', () => {
      const qty = customInput.value ? parseInt(customInput.value, 10) : selectedQty;
      if (qty < 1 || !Number.isInteger(qty)) return;
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      this.sendFn?.('crafting.start', {
        npc_id: this.npcId,
        recipe_id: recipe.id,
        quantity: qty,
      });
    });
    container.appendChild(startBtn);

    return container;
  }

  // ---------------------------------------------------------------------------
  // Session progress
  // ---------------------------------------------------------------------------

  private renderSessionProgress(session: CraftingSessionDto): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    if (session.status === 'completed' || session.progress_percent >= 100) {
      // Collect button
      const collectBtn = document.createElement('button');
      collectBtn.style.cssText = [
        'width:100%',
        'padding:8px',
        'background:rgba(60,90,40,0.6)',
        'border:1px solid #5a8a3a',
        'color:#b8e870',
        'font-family:Cinzel,serif',
        'font-size:12px',
        'cursor:pointer',
      ].join(';');
      collectBtn.textContent = 'Collect Items';
      collectBtn.addEventListener('mouseenter', () => { collectBtn.style.background = 'rgba(60,90,40,0.9)'; });
      collectBtn.addEventListener('mouseleave', () => { collectBtn.style.background = 'rgba(60,90,40,0.6)'; });
      collectBtn.addEventListener('click', () => {
        collectBtn.disabled = true;
        collectBtn.style.opacity = '0.5';
        this.sendFn?.('crafting.collect', { session_id: session.id });
      });
      container.appendChild(collectBtn);
    } else {
      // Progress bar
      const startedAt = new Date(session.started_at).getTime();
      const totalMs = session.total_duration_seconds * 1000;

      const track = document.createElement('div');
      track.style.cssText = 'width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;background:#b8860b;border-radius:4px;transition:width 1s linear;';
      track.appendChild(fill);
      container.appendChild(track);

      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'display:flex;justify-content:space-between;';

      const pctLabel = document.createElement('span');
      pctLabel.style.cssText = 'font-family:"Crimson Text",serif;font-size:11px;color:#a89060;';

      const timeLabel = document.createElement('span');
      timeLabel.style.cssText = 'font-family:"Crimson Text",serif;font-size:11px;color:#7a6a4a;';

      infoRow.appendChild(pctLabel);
      infoRow.appendChild(timeLabel);
      container.appendChild(infoRow);

      const update = (): void => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(100, (elapsed / totalMs) * 100);
        fill.style.width = `${pct}%`;
        pctLabel.textContent = `${Math.round(pct)}%`;

        const remaining = Math.max(0, totalMs - elapsed);
        timeLabel.textContent = this.formatDuration(Math.ceil(remaining / 1000)) + ' left';

        if (pct >= 100) {
          // Auto-switch to collect
          this.clearIntervals();
          session.status = 'completed';
          session.progress_percent = 100;
          this.renderRecipes();
        }
      };

      update();
      const interval = window.setInterval(update, 1000);
      this.progressIntervals.push(interval);

      // Cancel button
      const cancelBtn = document.createElement('button');
      cancelBtn.style.cssText = [
        'width:100%',
        'padding:6px',
        'background:rgba(90,40,40,0.4)',
        'border:1px solid #8a4a3a',
        'color:#c08060',
        'font-family:"Crimson Text",serif',
        'font-size:11px',
        'cursor:pointer',
      ].join(';');
      cancelBtn.textContent = 'Cancel (50% refund)';
      cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = 'rgba(90,40,40,0.7)'; });
      cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'rgba(90,40,40,0.4)'; });
      cancelBtn.addEventListener('click', () => {
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        this.sendFn?.('crafting.cancel', { session_id: session.id });
      });
      container.appendChild(cancelBtn);
    }

    return container;
  }

  // ---------------------------------------------------------------------------
  // Button state
  // ---------------------------------------------------------------------------

  private enableAllButtons(): void {
    if (!this.overlay) return;
    this.overlay.querySelectorAll<HTMLButtonElement>('button[disabled]').forEach((btn) => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  private showFeedback(text: string, color: string): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.style.display = 'block';
    this.feedbackEl.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = `margin:0;font-family:"Crimson Text",serif;font-size:12px;color:${color};`;
    p.textContent = text;
    this.feedbackEl.appendChild(p);

    setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 5000);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
}
