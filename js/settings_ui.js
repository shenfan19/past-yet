// The settings page: appearance, sound, game, data and advanced, each a section with a heading rule like the about page.
export function createSettingsPage(X) {
  const { D, ctx, U, esc } = X;
  const S = ctx.settings;
  const P = U.settings;
  const sections = ['appearance', 'sound', 'game', 'data', 'advanced'];
  const row = (label, control, note) => `<div class="srow"><div class="slabel">${esc(label)}${note ? `<div class="muted small">${esc(note)}</div>` : ''}</div><div class="sctl">${control}</div></div>`;
  const slider = (key) => `<input type="range" min="0" max="1" step="0.05" value="${S.get(key)}" data-set="${key}" aria-label="${esc(P.sound[key])}"> <span class="muted" data-out="${key}">${Math.round(S.get(key) * 100)}</span>`;
  const check = (key) => `<input type="checkbox" data-set="${key}" ${S.get(key) ? 'checked' : ''}>`;

  function html() {
    const A = P.appearance;
    const themeOpts = S.options.theme.map((v) => `<option value="${v}" ${S.get('theme') === v ? 'selected' : ''}>${esc(A.theme_opts[v])}</option>`).join('');
    const tracks = ctx.audio.tracks;
    const sfxButtons = Object.keys(P.sound.sfx).map((k) => `<button data-act="sfxtry" data-id="${k}">${esc(P.sound.sfx[k])}</button>`).join(' ');
    const cr = ctx.audio.credit;
    const body = {
      appearance: row(U.lang.label, X.langHtml()) + row(A.theme, `<select data-set="theme">${themeOpts}</select>`) + row(A.daynight, check('map_daynight'), A.daynight_note),
      sound: row(P.sound.music, `<button data-act="musictoggle">${esc(ctx.audio.state.playing ? U.music.pause : U.music.play)}</button> <span class="muted small">${esc(tracks[ctx.audio.state.index].composer + ' · ' + tracks[ctx.audio.state.index].title)}</span>`, P.sound.autostart)
        + row(P.sound.music_volume, slider('music_volume')) + row(P.sound.sfx_volume, slider('sfx_volume'))
        + row(P.sound.try, sfxButtons)
        + `<div class="muted small">${esc(P.sound.credit.replace('{source}', cr.source).replace('{license}', cr.license))}</div>`,
      game: row(P.game.pause_on_report, check('pause_on_report'), P.game.pause_on_report_note),
      data: `<div class="muted small">${esc(P.data.note)}</div>`
        + row(P.data.export, `<button data-act="saveexport">${esc(P.data.export)}</button>`)
        + row(P.data.import, `<input type="file" accept="application/json,application/gzip,.json,.gz" data-act="saveimport" aria-label="${esc(P.data.import)}">`)
        + row(P.data.defaults, `<button data-act="settingsreset">${esc(P.data.defaults)}</button>`)
        + row(P.data.reset, `<button class="ghost danger" data-act="reset">${esc(P.data.reset)}</button>`),
      advanced: `<h4>${esc(P.advanced.backend_h)}</h4>`
        + row(P.advanced.provider, `<select data-backend disabled><option>${esc(P.advanced.provider_local)}</option><option>${esc(P.advanced.provider_remote)}</option></select>`, P.advanced.provider_note)
        + row(P.advanced.engine, `<span>${esc(P.advanced.engine_value)}</span>`)
        + row(P.advanced.determinism, `<span>${esc(P.advanced.determinism_value)}</span>`),
    };
    const jumps = sections.map((k) => `<a class="wl" data-act="aboutjump" data-id="set-${k}">${esc(P[k].h)}</a>`).join(' · ');
    return `<div class="about settings"><p class="jumps">${jumps}</p>${sections.map((k) => `<h3 id="set-${k}">${esc(P[k].h)}</h3>${body[k]}`).join('')}</div>`;
  }

  // slider, select and checkbox changes are written straight to the settings
  function onInput(ev) {
    const t = ev.target;
    const key = t.dataset && t.dataset.set;
    if (!key) return false;
    if (t.type === 'range') {
      S.set(key, Number(t.value));
      const out = document.querySelector(`[data-out="${key}"]`);
      if (out) out.textContent = String(Math.round(Number(t.value) * 100));
    } else if (t.type === 'checkbox') {
      S.set(key, t.checked);
    } else {
      S.set(key, t.value);
    }
    return true;
  }

  async function exportSave() {
    let blob = new Blob([JSON.stringify(ctx.saved())], { type: 'application/json' });
    let extension = '.json';
    if (blob.size >= 1024 * 1024 && typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
      try {
        const gzip = blob.stream().pipeThrough(new CompressionStream('gzip'));
        blob = await new Response(gzip, { headers: { 'Content-Type': 'application/gzip' } }).blob();
        extension += '.gz';
      } catch (e) { /* keep the JSON export if compression fails */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = D.get('config.save.file_name') + extension;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importSave(file) {
    try {
      const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer());
      const gzip = signature[0] === 0x1f && signature[1] === 0x8b;
      const text = gzip ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await file.text();
      const obj = JSON.parse(text);
      if (!ctx.replace(obj)) throw new Error('bad save');
      const stored = await ctx.save();
      alert(stored ? P.data.import_ok : P.data.import_memory);
      return true;
    } catch (e) {
      alert(P.data.import_bad);
      return false;
    }
  }
  return { html, onInput, exportSave, importSave };
}
