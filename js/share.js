// The share card of one finished trip, shown in a pop-up over the page. It is drawn on a canvas from the report: the story of the trip and,
// for a simulated place, its curves against the mainline; for a small story its sync points. There are no tables of numbers on it.
// The site address and a QR code from a matrix shipped with the game are on it. Nothing is uploaded and no outside service is asked.
import { staffName } from './narrate.js';

export function createShare(X) {
  const { D, ctx, T, U, esc } = X;
  const H = U.share;
  const C = D.get('config.share');
  const CV = C.canvas;
  const QR = D.get('share_qr');

  const dispatch = (id) => ctx.S().dispatches.find((d) => d.id === id);
  const hookOf = (n) => H.hooks[n % H.hooks.length];

  // what the card says about a trip: its name, how it ended, the story told in a few lines, and the hook
  function parts(d) {
    const R = d.report;
    const who = staffName(D, d.spec.staffId);
    const index = ctx.S().dispatches.indexOf(d);
    if (d.light) {
      const c = T.catalog[d.eraId];
      const ev = D.get('catalog.events').find((x) => x.id === d.eraId);
      const o = R.outcomeId;
      return {
        name: c.name,
        outcome: U.light.outcome[o],
        text: [U.light.summary[o].replace('{staff}', who).replace('{place}', c.place).replace('{figure}', c.figure), c.story],
        points: R.points.map((p) => ({ hit: p.hit, redeem: !!p.redeem, text: ev.scene ? c.points[p.id] : U.light.points[p.id] })),
        hook: hookOf(index),
      };
    }
    return {
      name: T.eras[d.eraId].name,
      outcome: R.outcomeName,
      text: [R.summary, U.fmt.quote.replace('{x}', R.quote) + ' ' + U.fmt.dash + R.staff],
      chart: R.chart,
      hook: hookOf(index),
    };
  }
  const caption = (d) => { const p = parts(d); return [H.result.replace('{staff}', staffName(D, d.spec.staffId)).replace('{era}', p.name).replace('{outcome}', p.outcome), ...p.text, p.hook, QR.url].join(' '); };

  // the pop-up body: the card and what can be done with it
  function html(d) {
    return `<div class="share">
      <h3>${esc(H.title)}</h3>
      <p class="muted">${esc(H.intro)}</p>
      <canvas id="sharecanvas" width="${CV.w}" height="${CV.h}" aria-label="${esc(caption(d))}"></canvas>
      <div class="row" style="margin:12px 0"><button class="primary" data-act="sharesave">${esc(H.save)}</button><button data-act="sharecopy">${esc(H.copy)}</button>${navigator.share ? `<button data-act="sharenative">${esc(H.send)}</button>` : ''}<span class="muted" id="sharemsg"></span></div>
    </div>`;
  }

  // CJK characters break anywhere, other text breaks between words
  function wrap(g, text, maxW) {
    const tokens = text.match(/[　-〿぀-ヿ㐀-鿿＀-￯]|[^\s　-〿぀-ヿ㐀-鿿＀-￯]+\s*/g) || [];
    const lines = [];
    let line = '';
    for (const t of tokens) {
      // closing punctuation never starts a line
      if (line && !/^[，。！？；：、）」』”,.!?;:)]/.test(t) && g.measureText((line + t).trimEnd()).width > maxW) { lines.push(line.trimEnd()); line = t.trimStart(); } else line += t;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }
  // at most n lines, the last one ending in an ellipsis when something was left out
  const cut = (lines, n) => (lines.length <= n ? lines : [...lines.slice(0, n - 1), lines[n - 1].replace(/[\s，。,.;；、]*$/, '') + '…']);

  // one curve pair of the trip against the mainline, drawn small and plain
  function curve(g, K, x0, y0, w, h, title, base, branch, key, marks) {
    const sans = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
    const xmax = Math.max(...base.map((p) => p.day), ...branch.map((p) => p.day), 1);
    const ymax = Math.max(...base.map((p) => p[key]), ...branch.map((p) => p[key]), 1) * D.get('config.ui.chart.headroom');
    const px = (v) => x0 + (v / xmax) * w, py = (v) => y0 + h - (v / ymax) * h;
    g.fillStyle = K.ink2; g.font = `400 ${CV.small_px}px ${sans}`; g.textAlign = 'left';
    g.fillText(title, x0, y0 - 10);
    g.strokeStyle = K.line; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y0 + h); g.lineTo(x0 + w, y0 + h); g.stroke();
    g.setLineDash([6, 6]); g.strokeStyle = K.ink2; g.lineWidth = 3;
    g.beginPath(); base.forEach((p, i) => (i ? g.lineTo(px(p.day), py(p[key])) : g.moveTo(px(p.day), py(p[key])))); g.stroke();
    g.setLineDash([]); g.strokeStyle = K.stamp; g.lineWidth = 4;
    g.beginPath(); branch.forEach((p, i) => (i ? g.lineTo(px(p.day), py(p[key])) : g.moveTo(px(p.day), py(p[key])))); g.stroke();
    g.setLineDash([2, 6]); g.strokeStyle = K.ink; g.lineWidth = 2;
    for (const m of marks) if (m !== null && m !== undefined) { g.beginPath(); g.moveTo(px(m), y0); g.lineTo(px(m), y0 + h); g.stroke(); }
    g.setLineDash([]);
  }

  function draw(d) {
    const cv = document.getElementById('sharecanvas');
    if (!cv) return;
    const g = cv.getContext('2d');
    const K = C.colors;
    const p = parts(d);
    const serif = '"Noto Serif SC", "Songti SC", SimSun, serif';
    const sans = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
    g.fillStyle = K.bg; g.fillRect(0, 0, CV.w, CV.h);
    g.strokeStyle = K.stamp; g.lineWidth = CV.border; g.strokeRect(CV.border / 2, CV.border / 2, CV.w - CV.border, CV.h - CV.border);

    // stamp and title
    const L = CV.logo_px;
    g.save();
    g.translate(CV.pad + L / 2, CV.pad + L / 2);
    g.rotate((CV.logo_tilt_deg * Math.PI) / 180);
    g.strokeStyle = K.stamp; g.lineWidth = 4;
    g.strokeRect(-L / 2, -L / 2, L, L);
    g.fillStyle = K.stamp; g.font = `700 ${Math.round(L * 0.72)}px ${serif}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(D.get('config.meta.logo'), 0, 2);
    g.restore();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = K.ink; g.font = `700 ${CV.title_px}px ${serif}`;
    g.fillText(H.card_title, CV.pad + L + 20, CV.pad + L / 2 + CV.title_px * 0.35);

    // text column on the left, the QR code on the right
    const qrX = CV.w - CV.pad - CV.qr_size;
    const colW = qrX - CV.pad - 40;
    let y = CV.pad + L + 56;
    g.fillStyle = K.ink; g.font = `700 ${CV.event_px}px ${serif}`;
    for (const l of cut(wrap(g, p.name, colW), 2)) { g.fillText(l, CV.pad, y); y += CV.event_px * CV.line_gap; }
    g.fillStyle = K.stamp; g.font = `700 ${CV.body_px}px ${sans}`;
    const stars = '★'.repeat(d.stars || 0) + '☆'.repeat((d.max || D.get('config.stars.max')) - (d.stars || 0));
    g.fillText(`${p.outcome}  ${stars}`, CV.pad, y); y += CV.body_px * CV.line_gap + 6;
    g.fillStyle = K.ink; g.font = `400 ${CV.body_px - 2}px ${sans}`;
    const room = Math.floor((CV.vis_y - 50 - y) / ((CV.body_px - 2) * CV.line_gap));
    const body = [];
    for (const t of p.text) body.push(...wrap(g, t, colW));
    for (const l of cut(body, Math.max(2, room))) { g.fillText(l, CV.pad, y); y += (CV.body_px - 2) * CV.line_gap; }

    // QR code with its quiet zone, then the address
    const rows = QR.rows;
    const cells = rows.length + CV.qr_quiet * 2;
    const qrY = CV.pad + 8;
    g.fillStyle = K.qr_bg; g.fillRect(qrX, qrY, CV.qr_size, CV.qr_size);
    g.fillStyle = K.ink;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] !== '1') continue;
        const x0 = Math.round(((c + CV.qr_quiet) * CV.qr_size) / cells);
        const y0 = Math.round(((r + CV.qr_quiet) * CV.qr_size) / cells);
        g.fillRect(qrX + x0, qrY + y0, Math.round(((c + CV.qr_quiet + 1) * CV.qr_size) / cells) - x0, Math.round(((r + CV.qr_quiet + 1) * CV.qr_size) / cells) - y0);
      }
    }
    g.fillStyle = K.ink; g.font = `600 ${CV.small_px + 2}px ${sans}`; g.textAlign = 'center';
    g.fillText(QR.url.replace(/^https?:\/\//, ''), qrX + CV.qr_size / 2, qrY + CV.qr_size + CV.small_px + 14);
    g.textAlign = 'left';

    // the middle band: the two curves of a simulated place, or the sync points of a small story
    const vy = CV.vis_y;
    if (p.chart) {
      const w = (CV.w - CV.pad * 2 - CV.chart_gap) / 2;
      const mk = [p.chart.arrive, p.chart.leave];
      curve(g, K, CV.pad, vy + 24, w, CV.chart_h, U.report.sick, p.chart.base, p.chart.branch, 'cases', mk);
      curve(g, K, CV.pad + w + CV.chart_gap, vy + 24, w, CV.chart_h, U.report.dead, p.chart.base, p.chart.branch, 'deaths', mk);
      g.fillStyle = K.ink2; g.font = `400 ${CV.small_px}px ${sans}`;
      g.fillText(`- - ${U.report.mainline}      ── ${U.report.this_branch}`, CV.pad, vy + 24 + CV.chart_h + CV.small_px + 14);
    } else {
      let py = vy + 30;
      g.font = `400 ${CV.body_px}px ${sans}`;
      for (const pt of p.points) {
        g.fillStyle = pt.hit ? K.stamp : K.ink2;
        const mark = pt.redeem ? (pt.hit ? '♥' : '♡') : (pt.hit ? '★' : '☆');
        for (const [i, l] of cut(wrap(g, `${mark} ${pt.text}`, CV.w - CV.pad * 2), 2).entries()) { g.fillText(i ? '    ' + l : l, CV.pad, py); py += CV.body_px * CV.line_gap; }
        py += 6;
      }
    }

    // the hook and the disclaimer sit along the bottom
    g.strokeStyle = K.line; g.lineWidth = 2;
    g.font = `italic 400 ${CV.body_px - 2}px ${serif}`;
    const hook = cut(wrap(g, p.hook, CV.w - CV.pad * 2), 2);
    g.font = `400 ${CV.small_px}px ${sans}`;
    const lines = wrap(g, H.disclaimer, CV.w - CV.pad * 2);
    const dy = CV.h - CV.pad + 8 - lines.length * CV.small_px * CV.line_gap;
    g.beginPath(); g.moveTo(CV.pad, dy - CV.small_px * 1.4); g.lineTo(CV.w - CV.pad, dy - CV.small_px * 1.4); g.stroke();
    g.fillStyle = K.ink2; g.font = `italic 400 ${CV.body_px - 2}px ${serif}`;
    hook.forEach((l, i) => g.fillText(l, CV.pad, dy - CV.small_px * 1.4 - 14 - (hook.length - 1 - i) * (CV.body_px - 2) * CV.line_gap));
    g.font = `400 ${CV.small_px}px ${sans}`;
    lines.forEach((l, i) => g.fillText(l, CV.pad, dy + i * CV.small_px * CV.line_gap));
  }

  function save() {
    const cv = document.getElementById('sharecanvas');
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = C.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }
  async function copy(d) {
    const msg = document.getElementById('sharemsg');
    try { await navigator.clipboard.writeText(caption(d)); if (msg) msg.textContent = H.copied; } catch (e) { if (msg) msg.textContent = caption(d); }
  }
  async function send(d) {
    const cv = document.getElementById('sharecanvas');
    try {
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const file = new File([blob], C.file_name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: caption(d) });
      else await navigator.share({ text: caption(d), url: QR.url });
    } catch (e) { /* the player closed the share sheet */ }
  }
  return { html, draw, save, copy, send, dispatch, caption };
}
