// A framed list like a delivery menu: sortable columns, a scrolling body, and chosen rows pinned at the top of the frame.
export function createListbox(X) {
  const { esc, st, U, D } = X;
  const L = U.lbox;

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
    return `<div class="lbox">${pinHtml}<div class="lscroll" data-keep="${spec.id}" style="max-height:${spec.maxH || 260}px"><table class="ltable">${colgroup}<thead>${head}</thead><tbody>${body(rest) || `<tr><td colspan="${spec.cols.length}" class="muted">${esc(spec.empty || L.empty)}</td></tr>`}</tbody></table></div>${spec.foot ? `<div class="lfoot">${spec.foot}</div>` : ''}</div>`;
  }

  function sort(idKey) {
    const [id, k] = idKey.split(':');
    const ss = sortOf(id);
    if (ss.k === k) ss.dir = -ss.dir; else { ss.k = k; ss.dir = 1; }
  }
  return { html, sort };
}
