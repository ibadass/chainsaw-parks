import {
  EXPORT_FILE_PREFIX,
  STORAGE_KEY,
  buildExport,
  loadPrefs,
  loadVisited,
  parseImport,
  savePrefs,
  saveVisited,
} from './storage.js';
import { launchFireworks, shake, stopFireworks } from './fireworks.js';
import { FLAG_COLORS } from './flags.js';
import { playChainsaw, playChime, setSoundEnabled } from './sound.js';

const DATA_URL = './data/parks.json';
const PARTY_SIZE = 2;
const VIEWS = ['parcs', 'recap'];
const MILESTONES = [10, 25, 50, 75, 100];
const CHAINSAW_PALETTES = [
  ['#e10600', '#ff7a00', '#ffd000'],
  ['#e10600', '#ffffff'],
  ['#ff7a00', '#ffd000'],
];
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const PRICE_BRACKETS = [
  { label: 'Moins de 50 €', max: 50 },
  { label: '50 à 100 €', max: 100 },
  { label: '100 à 150 €', max: 150 },
  { label: '150 à 200 €', max: 200 },
  { label: '200 € et plus', max: Infinity },
];

const $ = (selector) => document.querySelector(selector);
const els = {
  main: $('#main'),
  tabs: document.querySelectorAll('.tabs__link'),
  views: document.querySelectorAll('[data-view-panel]'),
  search: $('#search'),
  country: $('#country'),
  sort: $('#sort'),
  visitButtons: document.querySelectorAll('.segmented__btn'),
  list: $('#parks'),
  empty: $('#empty'),
  emptyText: $('#empty-text'),
  clearFilters: $('#clear-filters'),
  recap: {
    empty: $('#recap-empty'),
    content: $('#recap-content'),
    total: $('#recap-total'),
    count: $('#recap-count'),
    average: $('#recap-average'),
    max: $('#recap-max'),
    min: $('#recap-min'),
    brackets: $('#recap-brackets'),
  },
  resultsCount: $('#results-count'),
  progressBar: $('.progress__bar'),
  progressFill: $('#progress-fill'),
  progressLabel: $('#progress-label'),
  globalLabel: $('#global-label'),
  exportBtn: $('#export'),
  importTrigger: $('#import-trigger'),
  importInput: $('#import'),
  resetBtn: $('#reset'),
  status: $('#status'),
  announcer: $('#announcer'),
  toggleAnimations: $('#toggle-animations'),
  toggleSound: $('#toggle-sound'),
  install: $('#install'),
  installHelp: $('#install-help'),
};

const state = {
  parks: [],
  knownIds: new Set(),
  visited: new Set(),
  query: '',
  countryCode: '',
  visitFilter: 'all',
  sort: 'country',
  view: 'parcs',
  prefs: loadPrefs(),
};

const EMPTY_MESSAGES = {
  search: 'Aucun parc ne correspond à ta recherche. Essaie un autre nom, une ville ou un pays.',
  visited: 'Aucun parc visité pour l\'instant. En route pour le premier looping !',
  todo: 'Tu as tout visité ! Légende des montagnes russes.',
};

const normalize = (text) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const flagFor = (code) =>
  [...code].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join('');

const plural = (count, singular, pluralForm) => (count > 1 ? pluralForm : singular);

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Estimated one-day price for the whole party, or null when unknown. */
const priceFor = (park) => (Number.isFinite(park.priceEur) ? park.priceEur * PARTY_SIZE : null);

function priceLabel(park) {
  if (park.closed) return 'Fermé définitivement';
  const price = priceFor(park);
  if (price === null) return 'Prix inconnu';
  if (price === 0) return 'Entrée libre';
  return `≈ ${euro.format(price)} pour ${PARTY_SIZE}`;
}

const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

// Unknown prices always go last, whatever the direction.
function byPrice(direction) {
  return (a, b) => {
    const pa = priceFor(a);
    const pb = priceFor(b);
    if (pa === pb) return byName(a, b);
    if (pa === null) return 1;
    if (pb === null) return -1;
    return (pa - pb) * direction;
  };
}

const SORTERS = {
  country: (a, b) => a.country.localeCompare(b.country, 'fr') || byName(a, b),
  name: byName,
  'price-asc': byPrice(1),
  'price-desc': byPrice(-1),
};

function filteredParks() {
  const tokens = normalize(state.query).split(/\s+/).filter(Boolean);
  return state.parks
    .filter((park) => {
      if (state.countryCode && park.countryCode !== state.countryCode) return false;
      const isVisited = state.visited.has(park.id);
      if (state.visitFilter === 'visited' && !isVisited) return false;
      if (state.visitFilter === 'todo' && isVisited) return false;
      if (!tokens.length) return true;
      const haystack = normalize(`${park.name} ${park.city} ${park.country}`);
      return tokens.every((token) => haystack.includes(token));
    })
    .sort(SORTERS[state.sort] ?? SORTERS.country);
}

const hasActiveFilters = () => Boolean(state.query || state.countryCode || state.visitFilter !== 'all');

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('status--error', isError);
}

function persist() {
  if (!saveVisited(state.visited)) {
    showStatus('Sauvegarde impossible : le stockage du navigateur est indisponible.', true);
  }
}

function setVisited(id, value) {
  if (value) state.visited.add(id);
  else state.visited.delete(id);
  persist();
}

// An explicit choice in the app wins over the system "reduce motion" setting.
const animationsOn = () => state.prefs.animations ?? !reducedMotion.matches;

function applyPrefs() {
  els.toggleAnimations.setAttribute('aria-pressed', String(animationsOn()));
  els.toggleSound.setAttribute('aria-pressed', String(state.prefs.sound));
  setSoundEnabled(state.prefs.sound);
}

function updatePrefs(changes) {
  state.prefs = { ...state.prefs, ...changes };
  savePrefs(state.prefs);
  applyPrefs();
  if (!animationsOn()) stopFireworks();
}

// Clearing first makes screen readers repeat identical consecutive messages.
function announce(message) {
  els.announcer.textContent = '';
  setTimeout(() => {
    els.announcer.textContent = message;
  }, 50);
}

/** Highest milestone (in %) crossed when the visited count goes from `before` to `after`, if any. */
function crossedMilestone(before, after) {
  const total = state.parks.length;
  return MILESTONES.filter((m) => before * 100 < m * total && after * 100 >= m * total).at(-1) ?? null;
}

function celebrate(park, item, anchor, milestone) {
  if (!animationsOn()) {
    playChime(Boolean(milestone));
    return;
  }
  item.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 300 },
  );
  const rect = anchor.getBoundingClientRect();
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const palette = FLAG_COLORS[park.countryCode];

  if (milestone) {
    launchFireworks({
      origin,
      palette,
      rockets: 40,
      duration: 5500,
      finale: 12,
      stamp: { title: `${milestone} %`, subtitle: milestone === 100 ? 'Tous les parcs conquis !' : 'Palier atteint !' },
    });
  } else {
    launchFireworks({ origin, palette, stamp: { title: 'Visité !', subtitle: park.name } });
  }
}

function chainsawMode() {
  showStatus('🪚 Mode tronçonneuse activé ! Vrrrrr !');
  playChainsaw();
  if (!animationsOn()) return;
  shake(10, 900);
  launchFireworks({
    palettes: CHAINSAW_PALETTES,
    rockets: 70,
    duration: 6500,
    finale: 16,
    stamp: { title: 'Vrrrrr !', subtitle: 'Mode tronçonneuse' },
  });
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// iPadOS reports itself as a Mac, hence the touch check.
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "Install" button: native prompt on Chrome/Edge/Android, step-by-step help on iOS (no prompt API there). */
function setupInstall() {
  if (isStandalone()) return;
  let deferredPrompt = null;
  if (isIos) els.install.hidden = false;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.install.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    els.install.hidden = true;
    showStatus('LizParKs est installée ! Retrouve-la avec tes autres applis. 🎉');
    if (animationsOn()) launchFireworks({ stamp: { title: 'Installée !', subtitle: 'LizParKs' } });
  });

  els.install.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      // A prompt event can only be used once.
      deferredPrompt = null;
      els.install.hidden = true;
    } else if (isIos) {
      els.installHelp.showModal();
    }
  });
}

function countKnownVisited() {
  let count = 0;
  for (const park of state.parks) if (state.visited.has(park.id)) count += 1;
  return count;
}

function updateSummary(parks) {
  const visitedInSelection = parks.filter((park) => state.visited.has(park.id)).length;
  const percent = parks.length ? Math.round((visitedInSelection / parks.length) * 100) : 0;
  const visitedCount = countKnownVisited();

  els.progressFill.style.width = `${percent}%`;
  els.progressBar.setAttribute('aria-valuenow', String(percent));
  els.progressLabel.textContent = `${visitedInSelection} / ${parks.length} parcs visités dans cette sélection`;
  els.globalLabel.textContent = `Total : ${visitedCount} / ${state.parks.length} (${
    state.parks.length ? Math.round((visitedCount / state.parks.length) * 100) : 0
  } %)`;

  const n = parks.length;
  els.resultsCount.textContent = `${n} ${plural(n, 'parc affiché', 'parcs affichés')}`;
  els.empty.hidden = n > 0;
  if (!n) {
    els.emptyText.textContent = emptyMessage();
    els.clearFilters.hidden = !hasActiveFilters();
  }

  const counts = {
    all: state.parks.length,
    visited: visitedCount,
    todo: state.parks.length - visitedCount,
    recap: visitedCount,
  };
  for (const [key, value] of Object.entries(counts)) {
    document.querySelector(`[data-count="${key}"]`).textContent = value;
  }
}

function emptyMessage() {
  if (state.query || state.countryCode) return EMPTY_MESSAGES.search;
  return EMPTY_MESSAGES[state.visitFilter] ?? EMPTY_MESSAGES.search;
}

function setVisitFilter(filter) {
  state.visitFilter = filter;
  for (const button of els.visitButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  render();
}

function createCard(park) {
  const visited = state.visited.has(park.id);

  const item = document.createElement('li');
  item.className = visited ? 'park park--visited' : 'park';

  const label = document.createElement('label');
  label.className = 'park__label';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'park__check';
  input.checked = visited;
  input.addEventListener('change', () => {
    const before = countKnownVisited();
    setVisited(park.id, input.checked);
    const after = countKnownVisited();
    item.classList.toggle('park--visited', input.checked);
    announce(
      `${park.name} ${input.checked ? 'marqué comme visité' : 'retiré des parcs visités'}. ` +
        `${after} sur ${state.parks.length}.`,
    );
    if (input.checked) {
      const milestone = crossedMilestone(before, after);
      if (milestone) {
        showStatus(milestone === 100 ? '🏆 Incroyable : tous les parcs sont visités !' : `🎆 Palier atteint : ${milestone} % des parcs visités !`);
      }
      celebrate(park, item, input, milestone);
    }
    // The card no longer matches the "visited"/"todo" filter: drop it and keep keyboard focus nearby.
    if (state.visitFilter !== 'all') {
      const neighbour = item.nextElementSibling ?? item.previousElementSibling;
      item.remove();
      neighbour?.querySelector('.park__check').focus();
    }
    updateSummary(filteredParks());
  });

  const stamp = document.createElement('span');
  stamp.className = 'park__stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.textContent = 'Visité';

  const country = document.createElement('span');
  country.className = 'park__country';
  country.textContent = `${flagFor(park.countryCode)} ${park.country}`;

  const name = document.createElement('span');
  name.className = 'park__name';
  name.textContent = park.name;

  const city = document.createElement('span');
  city.className = 'park__city';
  city.textContent = park.city;

  const price = document.createElement('span');
  price.className = park.closed ? 'park__price park__price--closed' : 'park__price';
  price.textContent = priceLabel(park);

  label.append(input, stamp, country, name, city, price);
  item.append(label);
  return item;
}

function render() {
  const parks = filteredParks();
  els.list.replaceChildren(...parks.map(createCard));
  updateSummary(parks);
  if (state.view === 'recap') renderRecap();
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createBracket(label, parks, total) {
  const subtotal = parks.reduce((sum, park) => sum + (priceFor(park) ?? 0), 0);
  const share = total ? Math.round((subtotal / total) * 100) : 0;

  const item = createElement('li', 'bracket');
  const details = createElement('details');
  const summary = createElement('summary', 'bracket__summary');
  summary.append(
    createElement('span', 'bracket__label', label),
    createElement('span', 'bracket__count', `${parks.length} ${plural(parks.length, 'parc', 'parcs')}`),
    createElement('span', 'bracket__subtotal', euro.format(subtotal)),
  );

  const bar = createElement('span', 'bracket__bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = createElement('span', 'bracket__fill');
  fill.style.width = `${share}%`;
  bar.append(fill);

  const list = createElement('ol', 'bracket__parks');
  for (const park of parks) {
    const row = createElement('li', 'bracket__park');
    row.append(
      createElement('span', 'bracket__park-name', `${flagFor(park.countryCode)} ${park.name}`),
      createElement('span', 'bracket__park-price', priceLabel(park)),
    );
    list.append(row);
  }

  details.append(summary, bar, list);
  item.append(details);
  return item;
}

function renderRecap() {
  const visited = state.parks.filter((park) => state.visited.has(park.id));
  els.recap.empty.hidden = visited.length > 0;
  els.recap.content.hidden = !visited.length;
  if (!visited.length) return;

  const priced = visited.filter((park) => priceFor(park) !== null).sort(SORTERS['price-desc']);
  const unpriced = visited.filter((park) => priceFor(park) === null);
  const total = priced.reduce((sum, park) => sum + priceFor(park), 0);
  const [mostExpensive] = priced;
  const cheapest = priced.at(-1);

  els.recap.total.textContent = euro.format(total);
  els.recap.count.textContent = String(visited.length);
  els.recap.average.textContent = priced.length ? euro.format(Math.round(total / priced.length)) : '—';
  els.recap.max.textContent = mostExpensive ? `${mostExpensive.name} · ${euro.format(priceFor(mostExpensive))}` : '—';
  els.recap.min.textContent = cheapest ? `${cheapest.name} · ${euro.format(priceFor(cheapest))}` : '—';

  const groups = PRICE_BRACKETS.map((bracket) => ({ ...bracket, parks: [] }));
  for (const park of priced) groups.find((group) => priceFor(park) < group.max).parks.push(park);

  const items = groups
    .filter((group) => group.parks.length)
    .reverse()
    .map((group) => createBracket(group.label, group.parks, total));
  if (unpriced.length) items.push(createBracket('Prix inconnu', unpriced, total));
  els.recap.brackets.replaceChildren(...items);
}

function showView({ scroll = false } = {}) {
  const requested = location.hash.slice(1);
  state.view = VIEWS.includes(requested) ? requested : 'parcs';

  for (const panel of els.views) panel.hidden = panel.dataset.viewPanel !== state.view;
  for (const tab of els.tabs) {
    if (tab.dataset.view === state.view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  if (state.view === 'recap') renderRecap();

  // When switching from deep in the list, bring the top of the new view back under the sticky tabs.
  if (scroll && window.scrollY > els.main.offsetTop) window.scrollTo({ top: els.main.offsetTop });
}

function clearFilters() {
  state.query = '';
  state.countryCode = '';
  els.search.value = '';
  els.country.value = '';
  setVisitFilter('all');
  els.search.focus();
}

function populateCountries() {
  const countries = new Map();
  for (const park of state.parks) {
    const entry = countries.get(park.countryCode) ?? { name: park.country, count: 0 };
    entry.count += 1;
    countries.set(park.countryCode, entry);
  }

  const sorted = [...countries.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr'));
  els.country.append(new Option(`Tous les pays (${state.parks.length})`, ''));
  for (const [code, { name, count }] of sorted) {
    els.country.append(new Option(`${flagFor(code)} ${name} (${count})`, code));
  }
}

function bindEvents() {
  let debounceTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.query = els.search.value;
      render();
    }, 150);
  });

  els.country.addEventListener('change', () => {
    state.countryCode = els.country.value;
    render();
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    render();
  });

  els.clearFilters.addEventListener('click', clearFilters);

  els.toggleAnimations.addEventListener('click', () => updatePrefs({ animations: !animationsOn() }));
  els.toggleSound.addEventListener('click', () => {
    updatePrefs({ sound: !state.prefs.sound });
    playChime();
  });
  reducedMotion.addEventListener('change', applyPrefs);

  let konamiIndex = 0;
  document.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : document.body;
    const typing = target.matches('input, select, textarea');
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!target.matches('input[type="search"], select, textarea')) {
      if (key === KONAMI[konamiIndex]) konamiIndex += 1;
      else konamiIndex = key === KONAMI[0] ? 1 : 0;
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0;
        chainsawMode();
      }
    }

    if (event.key === '/' && !typing && state.view === 'parcs') {
      event.preventDefault();
      els.search.focus();
    } else if (event.key === 'Escape' && event.target === els.search && els.search.value) {
      event.preventDefault();
      els.search.value = '';
      state.query = '';
      render();
    } else if (event.key === 'Escape') {
      stopFireworks();
    }
  });

  window.addEventListener('hashchange', () => showView({ scroll: true }));

  // Keep several open tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    state.visited = loadVisited();
    render();
  });

  for (const button of els.visitButtons) {
    button.addEventListener('click', () => setVisitFilter(button.dataset.filter));
  }

  els.exportBtn.addEventListener('click', () => {
    const payload = buildExport([...state.visited].filter((id) => state.knownIds.has(id)));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = payload.exportedAt.slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${EXPORT_FILE_PREFIX}-${date}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus(`Export réussi : ${payload.visited.length} ${plural(payload.visited.length, 'parc', 'parcs')} sauvegardé${payload.visited.length > 1 ? 's' : ''}.`);
  });

  els.importTrigger.addEventListener('click', () => els.importInput.click());

  els.importInput.addEventListener('change', async () => {
    const file = els.importInput.files[0];
    els.importInput.value = '';
    if (!file) return;

    try {
      const { visited, unknown } = parseImport(await file.text(), state.knownIds);
      const confirmed = confirm(
        `Remplacer ta checklist actuelle par ${visited.length} ${plural(visited.length, 'parc', 'parcs')} ?`,
      );
      if (!confirmed) {
        showStatus('Import annulé.');
        return;
      }
      state.visited = new Set(visited);
      persist();
      render();
      const ignored = unknown ? `, ${unknown} identifiant(s) inconnu(s) ignoré(s)` : '';
      showStatus(`Import réussi : ${visited.length} ${plural(visited.length, 'parc', 'parcs')}${ignored}.`);
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  $('#surprise').addEventListener('click', () => {
    const todo = state.parks.filter((park) => !state.visited.has(park.id));
    if (!todo.length) {
      showStatus('Tu as tout visité ! Rien à chasser.');
      return;
    }
    const park = todo[Math.floor(Math.random() * todo.length)];
    showStatus(`Mission du jour : ${park.name} (${park.city}, ${park.country}).`);
  });

  els.resetBtn.addEventListener('click', () => {
    if (!state.visited.size) {
      showStatus('Rien à réinitialiser.');
      return;
    }
    if (!confirm('Effacer toute ta checklist ? Cette action est irréversible.')) return;
    state.visited.clear();
    persist();
    render();
    showStatus('Checklist réinitialisée.');
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { parks } = await response.json();

    state.parks = [...parks].sort(SORTERS.country);
    state.knownIds = new Set(state.parks.map((park) => park.id));
    state.visited = loadVisited();

    populateCountries();
    applyPrefs();
    bindEvents();
    showView();
    render();
  } catch (error) {
    els.progressLabel.textContent = 'Impossible de charger la liste des parcs.';
    showStatus(`Erreur de chargement (${error.message}). Vérifie que l'app est servie par un serveur HTTP.`, true);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

setupInstall();
init();
