// Internal identifiers keep the original "chainsaw-parks" value: changing them would wipe users'
// saved checklists and make older backup files unimportable.
export const APP_ID = 'chainsaw-parks';
export const FORMAT_VERSION = 1;
export const STORAGE_KEY = 'chainsaw-parks:checklist';
export const EXPORT_FILE_PREFIX = 'lizparks-checklist';
export const PREFS_KEY = 'chainsaw-parks:prefs';

/**
 * User preferences. `animations` is null until the user picks a value (then the system setting applies).
 * @returns {{ animations: boolean | null, sound: boolean }}
 */
export function loadPrefs() {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      animations: typeof data?.animations === 'boolean' ? data.animations : null,
      sound: data?.sound === true,
    };
  } catch {
    return { animations: null, sound: false };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function loadVisited() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    const ids = Array.isArray(data?.visited) ? data.visited : [];
    return new Set(ids.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function saveVisited(ids) {
  try {
    const payload = { app: APP_ID, version: FORMAT_VERSION, visited: [...ids].sort() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function buildExport(ids) {
  return {
    app: APP_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    visited: [...new Set(ids)].sort(),
  };
}

/**
 * Parses a checklist file. Unknown park ids are dropped and counted.
 * @returns {{ visited: string[], unknown: number }}
 */
export function parseImport(text, knownIds) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier invalide : le contenu n’est pas du JSON.');
  }
  if (data?.app !== APP_ID) {
    throw new Error('Ce fichier n’est pas une sauvegarde LizParKs.');
  }
  if (data.version !== FORMAT_VERSION) {
    throw new Error(`Version de sauvegarde non prise en charge (v${data.version ?? '?'}).`);
  }
  if (!Array.isArray(data.visited)) {
    throw new Error('Fichier invalide : la liste « visited » est absente.');
  }

  const entries = data.visited.filter((id) => typeof id === 'string');
  const visited = [...new Set(entries.filter((id) => knownIds.has(id)))].sort();
  return { visited, unknown: data.visited.length - visited.length };
}
