// The share page for one finished trip. A card is drawn on a canvas from the report, with the site address and a QR code that is
// drawn from a matrix shipped with the game. Nothing is uploaded and nothing is asked of an outside service.
import { staffName } from './narrate.js';

export function createShare(X) {
  const { D, ctx, T, U, esc, r1 } = X;
  const H = U.share;
  const C = D.get('config.share');
  const CV = C.canvas;
  const QR = D.get('share_qr');

  const dispatch = (id) => ctx.S().dispatches.find((d) => d.id === id);
  function parts(d) {
    const lives = d.report.accounts.lives;
    const index = ctx.S().dispatches.indexOf(d);
    return {
      result: H.result.replace('{staff}', staffName(D, d.spec.staffId)).replace('{era}', T.eras[d.eraId].name).replace('{outcome}', d.report.outcomeName),
      lives: lives > 0 ? H.lives.replace('{n}', r1(lives)) : '',
      hook: H.hooks[index % H.hooks.length],
      era: T.eras[d.eraId].name,
    };
  }
  const caption = (d) => { const p = parts(d); return [p.result, p.lives, p.hook, QR.url].filter(Boolean).join(' '); };

  function html(d) {
    return `<div class="share">
      <p><button class="ghost" data-act="shareback">‹ ${esc(H.back)}</button></p>
      <h3>${esc(H.title)}</h3>
      <p class="muted">${esc(H.intro)}</p>
      <canvas id="sharecanvas" width="${CV.w}" height="${CV.h}" aria-label="${esc(caption(d))}"></canvas>
      <div class="row" style="margin:12px 0"><button class="primary" data-act="sharesave">${esc(H.save)}</button><button data-act="sharecopy">${esc(H.copy)}</button>${navigator.share ? `<button data-act="sharenative">${esc(H.send)}</button>` : ''}<span class="muted" id="sharemsg"></span></div>
    </div>`;
  }

  // CJK characters break anywhere, other text breaks between words
  function wrap(g, text, maxW) {
    const tokens = text.match(/[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]|[^\s\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]+\s*/g) || [];
    const lines = [];
    let line = '';
    for (const t of tokens) {
      if (line && g.measureText((line + t).trimEnd()).width > maxW) { lines.push(line.trimEnd()); line = t.trimStart(); } else line += t;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
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
    for (const l of wrap(g, p.era, colW)) { g.fillText(l, CV.pad, y); y += CV.event_px * CV.line_gap; }
    y += 6;
    g.font = `400 ${CV.body_px}px ${sans}`;
    for (const t of [p.result, p.lives]) {
      if (!t) continue;
      for (const l of wrap(g, t, colW)) { g.fillText(l, CV.pad, y); y += CV.body_px * CV.line_gap; }
      y += 4;
    }
    y += 10;
    g.fillStyle = K.ink2; g.font = `italic 400 ${CV.body_px}px ${serif}`;
    for (const l of wrap(g, p.hook, colW)) { g.fillText(l, CV.pad, y); y += CV.body_px * CV.line_gap; }

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

    // the disclaimer sits along the bottom
    g.strokeStyle = K.line; g.lineWidth = 2;
    const lines = (() => { g.font = `400 ${CV.small_px}px ${sans}`; return wrap(g, H.disclaimer, CV.w - CV.pad * 2); })();
    const dy = CV.h - CV.pad + 8 - lines.length * CV.small_px * CV.line_gap;
    g.beginPath(); g.moveTo(CV.pad, dy - CV.small_px * 1.4); g.lineTo(CV.w - CV.pad, dy - CV.small_px * 1.4); g.stroke();
    g.fillStyle = K.ink2;
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
