// ---------------------------------------------------------------------------
// Elarion Map Editor — Toolbar UI
// ---------------------------------------------------------------------------

import type { EditorMode } from '../editor/modes';

// ---------------------------------------------------------------------------
// Mode definitions for button rendering
// ---------------------------------------------------------------------------

interface ModeEntry {
  mode: EditorMode;
  label: string;
}

const MODES: ModeEntry[] = [
  { mode: 'select', label: 'Select' },
  { mode: 'node', label: 'Node' },
  { mode: 'edge', label: 'Edge' },
  { mode: 'delete', label: 'Delete' },
  { mode: 'building', label: 'Building' },
];

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

export class Toolbar {
  private container: HTMLElement;
  private modeButtons: Map<EditorMode, HTMLButtonElement> = new Map();
  private activeMode: EditorMode = 'select';
  private saveButton!: HTMLButtonElement;

  // Callbacks
  private onModeSelect: ((mode: EditorMode) => void) | null = null;
  private onUploadImage: ((file: File) => void) | null = null;
  private onSetSpawn: (() => void) | null = null;
  private onSave: (() => void) | null = null;
  private onBack: (() => void) | null = null;
  private onConfiguration: (() => void) | null = null;
  private configButton!: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'toolbar';

    this.buildNavigation();
    this.buildModeGroup();
    this.buildActionsGroup();

    parent.appendChild(this.container);
  }

  // -------------------------------------------------------------------------
  // Section builders
  // -------------------------------------------------------------------------

  private buildNavigation(): void {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn toolbar-btn--back';
    btn.textContent = 'Back to Maps';
    btn.addEventListener('click', () => this.onBack?.());
    this.container.appendChild(btn);
  }

  private buildModeGroup(): void {
    const group = document.createElement('div');
    group.className = 'toolbar-group';

    const label = document.createElement('span');
    label.className = 'toolbar-group__label';
    label.textContent = 'Tools';
    group.appendChild(label);

    for (const { mode, label: text } of MODES) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-btn';
      btn.dataset.mode = mode;
      btn.textContent = text;

      if (mode === this.activeMode) {
        btn.classList.add('toolbar-btn--active');
      }

      btn.addEventListener('click', () => {
        this.setActiveMode(mode);
        this.onModeSelect?.(mode);
      });

      this.modeButtons.set(mode, btn);
      group.appendChild(btn);
    }

    this.container.appendChild(group);
  }

  private buildActionsGroup(): void {
    const group = document.createElement('div');
    group.className = 'toolbar-group';

    const label = document.createElement('span');
    label.className = 'toolbar-group__label';
    label.textContent = 'Actions';
    group.appendChild(label);

    // Upload Image -----------------------------------------------------------
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        this.onUploadImage?.(file);
      }
      // Reset so the same file can be re-selected
      fileInput.value = '';
    });

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'toolbar-btn';
    uploadBtn.textContent = 'Upload Image';
    uploadBtn.addEventListener('click', () => fileInput.click());

    group.appendChild(fileInput);
    group.appendChild(uploadBtn);

    // Set Spawn --------------------------------------------------------------
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'toolbar-btn';
    spawnBtn.textContent = 'Set Spawn';
    spawnBtn.addEventListener('click', () => this.onSetSpawn?.());
    group.appendChild(spawnBtn);

    // Configuration ----------------------------------------------------------
    this.configButton = document.createElement('button');
    this.configButton.className = 'toolbar-btn';
    this.configButton.textContent = 'Configuration';
    this.configButton.addEventListener('click', () => {
      this.configButton.classList.toggle('toolbar-btn--active');
      this.onConfiguration?.();
    });
    group.appendChild(this.configButton);

    // Save Map ---------------------------------------------------------------
    this.saveButton = document.createElement('button');
    this.saveButton.className = 'toolbar-btn toolbar-btn--save';
    this.saveButton.textContent = 'Save Map';
    this.saveButton.addEventListener('click', () => this.onSave?.());
    group.appendChild(this.saveButton);

    this.container.appendChild(group);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  setActiveMode(mode: EditorMode): void {
    this.activeMode = mode;
    for (const [m, btn] of this.modeButtons) {
      btn.classList.toggle('toolbar-btn--active', m === mode);
    }
  }

  setOnModeSelect(cb: (mode: EditorMode) => void): void {
    this.onModeSelect = cb;
  }

  setOnUploadImage(cb: (file: File) => void): void {
    this.onUploadImage = cb;
  }

  setOnSetSpawn(cb: () => void): void {
    this.onSetSpawn = cb;
  }

  setOnSave(cb: () => void): void {
    this.onSave = cb;
  }

  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  setOnConfiguration(cb: () => void): void {
    this.onConfiguration = cb;
  }

  setConfigurationActive(active: boolean): void {
    this.configButton.classList.toggle('toolbar-btn--active', active);
  }

  enableSave(enabled: boolean): void {
    this.saveButton.disabled = !enabled;
  }

  destroy(): void {
    this.container.remove();
  }
}
