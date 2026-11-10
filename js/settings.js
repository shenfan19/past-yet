// The player's settings. They live in this browser only and are laid over the defaults in config.yaml.
export function createSettings(D) {
  const C = D.get('config.settings');
  const listeners = new Set();
  let values = { ...C.defaults };
  try {
    const raw = localStorage.getItem(C.storage_key);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const k of Object.keys(C.defaults)) if (k in saved && typeof saved[k] === typeof C.defaults[k]) values[k] = saved[k];
    }
  } catch (e) { /* storage blocked or damaged, the defaults are used */ }

  function applyTheme() {
    const v = values.theme;
    if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  }
  applyTheme();

  return {
    get: (k) => {
      if (!(k in values)) throw new Error('未知设置 ' + k);
      return values[k];
    },
    set(k, v) {
      if (!(k in C.defaults)) throw new Error('未知设置 ' + k);
      values[k] = v;
      try { localStorage.setItem(C.storage_key, JSON.stringify(values)); } catch (e) { /* storage blocked, the choice lasts until the page closes */ }
      if (k === 'theme') applyTheme();
      listeners.forEach((fn) => fn(k));
    },
    reset() {
      values = { ...C.defaults };
      try { localStorage.removeItem(C.storage_key); } catch (e) { /* storage blocked */ }
      applyTheme();
      listeners.forEach((fn) => fn(null));
    },
    onChange: (fn) => listeners.add(fn),
    options: C.options,
  };
}
