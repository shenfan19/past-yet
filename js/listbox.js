// A framed list like a delivery menu: sortable columns, a scrolling body, and chosen rows pinned at the top of the frame.
export function createListbox(X) {
  const { esc, st, U, D } = X;
  const L = U.lbox;

  // Every list shows a page of rows, as many as the player picks, the least by default, and turns pages instead of scrolling.
  const pager = (id) => (st.pager[id] ||= { size: D.get('config.ui.page_sizes')[0], page: 0 });
  function paginate(id, rows) {
    const sizes = D.get('config.ui.page_sizes');
    const pg = pager(id);
    if (!sizes.includes(pg.size)) pg.size = sizes[0];
    const pages = Math.max(1, Math.ceil(rows.length / pg.size));
    pg.page = Math.min(Math.max(0, pg.page), pages - 1);
    const shown = rows.slice(pg.page * pg.size, (pg.page + 1) * pg.size);
    const html = rows.length > sizes[0] ? `<div class="row pager"><label class="muted">${U.office.page_size} <select data-pgsize="${id}">${sizes.map((n) => `<option value="${n}" ${n === pg.size ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="ghost" data-act="pgpage" data-id="${id}:prev" aria-label="${esc(U.office.prev_page)}" ${pg.page > 0 ? '' : 'disabled'}>‹</button><span class="muted">${U.office.page_of.replace('{a}', String(pg.page + 1)).replace('{b}', String(pages))}</span><button class="ghost" data-act="pgpage" data-id="${id}:next" aria-label="${esc(U.office.next_page)}" ${pg.page < pages - 1 ? '' : 'disabled'}>›</button></div>` : '';
    return { shown, html };
  }
  const setSize = (id, n) => { const pg = pager(id); pg.size = n; pg.page = 0; };
  const turn = (id, d) => { pager(id).page += d; };

  function sortOf(id) { return st.sort[id] || (st.sort[id] = { k: null, dir: 1 }); }

  // spec: { id, cols: [{ k, label, w, cls, val(row), cell(row) }], rows, pinned(row), pinTitle, foot, maxH, empty }
  function html(spec) {
    const ss = sortOf(spec.id);
    let rows = spec.rows.slice();
    if (ss.k) {
      const col = spec.cols.find((c) => c.k === ss.k);
      if (col && col.val) {
        rows.sort((a, b) => {
          const x = col.val(a), y = col.val(b);
          return (typeof x === 'string' ? x.localeCompare(y, D.lang) : x - y) * ss.dir;
        });
      }
    }
    const pins = spec.pinned ? rows.filter(spec.pinned) : [];
    const rest = spec.pinned ? rows.filter((r) => !spec.pinned(r)) : rows;
    const colgroup = `<colgroup>${spec.cols.map((c) => `<col style="width:${c.w}">`).join('')}</colgroup>`;
    const head = `<tr>${spec.cols.map((c) => `<th class="${c.cls || ''}">${c.val ? `<button class="sortbtn" data-act="lsort" data-id="${spec.id}:${c.k}">${esc(c.label)}${ss.k === c.k ? (ss.dir > 0 ? ' ▲' : ' ▼') : ''}</button>` : esc(c.label)}</th>`).join('')}</tr>`;
    const body = (list) => list.map((r) => `<tr class="${r.cls || ''}">${spec.cols.map((c) => `<td class="${c.cls || ''}">${c.cell(r)}</td>`).join('')}</tr>`).join('');
    const pinHtml = pins.length ? `<div class="lpin"><div class="lpintitle">${esc(spec.pinTitle || L.chosen)}</div><table class="ltable">${colgroup}<tbody>${body(pins)}</tbody></table></div>` : '';
    // a list in a pop-up with a fixed height keeps its scroll, every other list is paged
    const pg = spec.scroll ? null : paginate(spec.id, rest);
    const open = spec.scroll ? `<div class="lscroll" data-keep="${spec.id}" style="max-height:min(${spec.maxH}px,75vh)">` : '<div>';
    return `<div class="lbox" id="lb-${spec.id}">${pg ? pg.html : ''}${pinHtml}${open}<table class="ltable">${colgroup}<thead>${head}</thead><tbody>${body(pg ? pg.shown : rest) || `<tr><td colspan="${spec.cols.length}" class="muted">${esc(spec.empty || L.empty)}</td></tr>`}</tbody></table></div>${spec.foot ? `<div class="lfoot">${spec.foot}</div>` : ''}</div>`;
  }

  function sort(idKey) {
    const [id, k] = idKey.split(':');
    const ss = sortOf(id);
    if (ss.k === k) ss.dir = -ss.dir; else { ss.k = k; ss.dir = 1; }
  }
  return { html, sort, paginate, setSize, turn };
}
