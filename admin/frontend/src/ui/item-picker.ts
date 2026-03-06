import { getItems, type ItemDefinitionResponse } from '../editor/api';

// Module-level cache — shared across all picker invocations
let cachedItems: ItemDefinitionResponse[] | null = null;

async function loadItems(): Promise<ItemDefinitionResponse[]> {
  if (cachedItems !== null) return cachedItems;
  cachedItems = await getItems();
  return cachedItems;
}

/** Call this when items have been created/updated so the picker re-fetches next time. */
export function invalidateItemPickerCache(): void {
  cachedItems = null;
}

export type ItemPickerCallback = (item: ItemDefinitionResponse) => void;

/**
 * Opens a modal item picker. Resolves the selected item via `onSelect` callback.
 * The modal is self-managing — it appends itself to document.body and removes
 * itself on selection or close.
 */
export async function openItemPicker(onSelect: ItemPickerCallback): Promise<void> {
  // Remove any existing picker
  document.querySelector('.item-picker-overlay')?.remove();

  let items: ItemDefinitionResponse[];
  try {
    items = await loadItems();
  } catch {
    alert('Failed to load items.');
    return;
  }

  // ── Overlay ──────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'item-picker-overlay';

  const modal = document.createElement('div');
  modal.className = 'item-picker-modal';
  overlay.appendChild(modal);

  const close = (): void => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // ── Header ───────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'item-picker-header';

  const title = document.createElement('h3');
  title.textContent = 'Select Item';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn--small';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);

  modal.appendChild(header);

  // ── Filters ──────────────────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'item-picker-filters';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by name…';
  searchInput.className = 'item-picker-search';
  filterBar.appendChild(searchInput);

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category))).sort()];
  const catSelect = document.createElement('select');
  catSelect.className = 'item-picker-cat-select';
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'all' ? 'All categories' : cat;
    catSelect.appendChild(opt);
  }
  filterBar.appendChild(catSelect);

  modal.appendChild(filterBar);

  // ── Grid ─────────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'item-picker-grid';
  modal.appendChild(grid);

  // ── Render ────────────────────────────────────────────────────────────────
  const render = (): void => {
    const search = searchInput.value.toLowerCase().trim();
    const cat = catSelect.value;

    const filtered = items.filter((item) => {
      if (cat !== 'all' && item.category !== cat) return false;
      if (search && !item.name.toLowerCase().includes(search)) return false;
      return true;
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'item-picker-empty';
      empty.textContent = 'No items match your search.';
      grid.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const card = document.createElement('button');
      card.className = 'item-picker-card';
      card.type = 'button';

      const iconEl = document.createElement('div');
      iconEl.className = 'item-picker-card-icon';
      if (item.icon_url) {
        const img = document.createElement('img');
        img.src = item.icon_url;
        img.alt = '';
        iconEl.appendChild(img);
      } else {
        iconEl.textContent = (item.name[0] ?? '?').toUpperCase();
      }
      card.appendChild(iconEl);

      const info = document.createElement('div');
      info.className = 'item-picker-card-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'item-picker-card-name';
      nameEl.textContent = item.name;

      const metaEl = document.createElement('span');
      metaEl.className = 'item-picker-card-meta';
      metaEl.textContent = `${item.category} · #${item.id}`;

      info.appendChild(nameEl);
      info.appendChild(metaEl);
      card.appendChild(info);

      card.addEventListener('click', () => {
        onSelect(item);
        close();
      });

      grid.appendChild(card);
    }
  };

  searchInput.addEventListener('input', render);
  catSelect.addEventListener('change', render);
  render();

  document.body.appendChild(overlay);
  setTimeout(() => searchInput.focus(), 50);
}

/**
 * Resolves an item name by ID from the cache (or fetches if needed).
 * Returns "#<id>" if not found.
 */
export async function resolveItemName(itemDefId: number): Promise<string> {
  const items = await loadItems().catch(() => [] as ItemDefinitionResponse[]);
  return items.find((i) => i.id === itemDefId)?.name ?? `#${itemDefId}`;
}
