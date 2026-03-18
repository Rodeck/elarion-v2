import { listMaps, createMap, deleteMap, login, type MapSummary } from '../editor/api';

export class MapListView {
  private container: HTMLElement;
  private onEditMap: ((mapId: number) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'map-list-view';
    parent.appendChild(this.container);
  }

  setOnEditMap(cb: (mapId: number) => void): void {
    this.onEditMap = cb;
  }

  async render(): Promise<void> {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      this.renderLogin();
      return;
    }

    try {
      const maps = await listMaps();
      this.renderMapList(maps);
    } catch (err) {
      if ((err as Error).message === 'Unauthorized') {
        this.renderLogin();
      } else {
        this.container.innerHTML = `<p class="error">Failed to load maps: ${(err as Error).message}</p>`;
      }
    }
  }

  private renderLogin(): void {
    this.container.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'login-form';
    form.innerHTML = `
      <h2>Admin Login</h2>
      <label for="username-input">Username</label>
      <input id="username-input" type="text" autocomplete="username" placeholder="Username" required />
      <label for="password-input">Password</label>
      <input id="password-input" type="password" autocomplete="current-password" placeholder="Password" required />
      <button type="submit" class="btn btn--primary" style="margin-top:1.25rem">Sign In</button>
      <p class="error" id="login-error" style="display:none"></p>
    `;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = form.querySelector<HTMLInputElement>('#username-input')!;
      const passwordInput = form.querySelector<HTMLInputElement>('#password-input')!;
      const errorEl = form.querySelector<HTMLElement>('#login-error')!;
      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';

      try {
        const token = await login(usernameInput.value.trim(), passwordInput.value);
        localStorage.setItem('admin_token', token);
        // Show the tab bar now that user is authenticated
        const tabBar = document.querySelector('.admin-tab-bar') as HTMLElement;
        if (tabBar) tabBar.style.display = '';
        await this.render();
      } catch (err) {
        passwordInput.value = '';
        errorEl.textContent = (err as Error).message;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });

    this.container.appendChild(form);
  }

  private renderMapList(maps: MapSummary[]): void {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'map-list-header';
    header.innerHTML = `<h1>City Maps</h1>`;

    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn--primary';
    newBtn.textContent = 'New Map';
    newBtn.addEventListener('click', () => this.showCreateForm());
    header.appendChild(newBtn);

    this.container.appendChild(header);

    if (maps.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No city maps yet. Create your first map!';
      this.container.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'map-grid';

    for (const map of maps) {
      const card = document.createElement('div');
      card.className = 'map-card';
      card.innerHTML = `
        <h3>${this.escapeHtml(map.name)}</h3>
        <p class="map-meta">${map.image_width_px}×${map.image_height_px}px</p>
        <p class="map-meta">${map.node_count} nodes · ${map.building_count} buildings</p>
      `;

      const actions = document.createElement('div');
      actions.className = 'map-card-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn--small';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onEditMap?.(map.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn--small btn--danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete map "${map.name}"? This cannot be undone.`)) return;
        try {
          await deleteMap(map.id);
          await this.render();
        } catch (err) {
          alert(`Failed to delete: ${(err as Error).message}`);
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);

      card.addEventListener('click', () => this.onEditMap?.(map.id));
      grid.appendChild(card);
    }

    this.container.appendChild(grid);
  }

  private showCreateForm(): void {
    this.container.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'create-map-form';
    form.innerHTML = `
      <h2>Create New Map</h2>
      <label for="map-name">Map Name</label>
      <input id="map-name" type="text" placeholder="e.g. Elarion City" required />
      <label for="map-width">Width (px)</label>
      <input id="map-width" type="number" min="100" max="10000" value="1920" required />
      <label for="map-height">Height (px)</label>
      <input id="map-height" type="number" min="100" max="10000" value="1080" required />
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-create">Cancel</button>
        <button type="submit" class="btn btn--primary">Create</button>
      </div>
      <p class="error" id="create-error" style="display:none"></p>
    `;

    form.querySelector('#cancel-create')!.addEventListener('click', () => this.render());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = form.querySelector<HTMLInputElement>('#map-name')!;
      const widthInput = form.querySelector<HTMLInputElement>('#map-width')!;
      const heightInput = form.querySelector<HTMLInputElement>('#map-height')!;
      const errorEl = form.querySelector<HTMLElement>('#create-error')!;

      const name = nameInput.value.trim();
      const width = parseInt(widthInput.value, 10);
      const height = parseInt(heightInput.value, 10);

      if (!name) {
        errorEl.textContent = 'Name is required';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const map = await createMap(name, width, height);
        this.onEditMap?.(map.id);
      } catch (err) {
        errorEl.textContent = (err as Error).message;
        errorEl.style.display = 'block';
      }
    });

    this.container.appendChild(form);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.container.remove();
  }
}
