// The portrait share card shows the outcome, historical echo and a short selection from the report.
// The site address and a QR code from a matrix shipped with the game are on it. Nothing is uploaded and no outside service is asked.
import { staffName, isoDateLabel } from './narrate.js';

export function createShare(X) {
  const { D, ctx, T, U, esc } = X;
  const H = U.share;
  const C = D.get('config.share');
  const CV = C.canvas;
  const QR = D.get('share_qr');
  const englishTitle = D.get('config.meta.app');
  const localTitle = H.card_title === englishTitle ? '' : H.card_title;
  const logo = new Image();
  logo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(D.get('logo'));

  const dispatch = (id) => ctx.S().dispatches.find((d) => d.id === id);

  // The lines of the record the card keeps: every line that won a star, then the lines written for this employee, then the lines of history by importance,
  // up to config.share.record_lines, told in the order they happened.
  function pickLines(timeline) {
    const N = C.record_lines;
    const rank = (t) => (t.star ? 0 : t.own ? 1 : t.tag === 'history' ? 2 : 3);
    const chosen = timeline.map((t, i) => ({ t, i })).filter(({ t }) => t.kind !== 'remark' && rank(t) < 3)
      .sort((a, b) => rank(a.t) - rank(b.t) || (b.t.importance || 0) - (a.t.importance || 0) || a.i - b.i).slice(0, N).sort((a, b) => a.i - b.i);
    return chosen.map(({ t }) => ({ text: t.text, star: !!t.star, history: t.tag === 'history' }));
  }
  // the echo of a trip, 5.15 of the story outline: the recorded line of the person and who said it, when and where
  const echoOf = (d) => {
    const id = d.echo ?? ctx.backend.echoOf(d);
    const q = id && T.quotes[id];
    const Q = id && D.get('quotes.quotes')[id];
    if (!q || !Q?.tier || !Q.sources?.length) return null;
    const occasion = q.occasion.replace(
      /\s*(?:[（(]\s*(?:game translation|本游戏译文?|本遊戲譯文?)\s*[）)]|[;；。·.]\s*(?:game translation|本游戏译文?|本遊戲譯文?))\s*[。.]?\s*$/iu, '',
    );
    const cite = U.report.echo_cite.replace('{who}', q.who).replace('{date}', isoDateLabel(D, Q.date)).replace('{occasion}', occasion);
    return { quote: U.fmt.quote.replace('{x}', q.quote), cite };
  };
  function parts(d) {
    const R = d.report;
    const who = staffName(D, d.spec.staffId);
    if (d.evacuation) return {
      name: d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name,
      outcome: U.report.evacuated,
      text: [U.report.evacuation_text.replace('{day}', String(d.evacuation.day))],
      points: [],
    };
    if (R.journey?.accepted === false) return {
      name: d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name,
      outcome: U.report.stamp[ctx.backend.stampOf(d)],
      text: [U.report.participation.share_missed.replace('{staff}', who)],
      echo: echoOf(d),
      points: [],
    };
    if (d.light) {
      const c = T.catalog[d.eraId];
      const ev = D.get('catalog.events').find((x) => x.id === d.eraId);
      const o = R.outcomeId;
      return {
        name: c.name,
        outcome: U.report.stamp[ctx.backend.stampOf(d)],
        text: R.timeline ? [] : [U.light.summary[o].replace('{staff}', who).replace('{place}', c.place).replace('{figure}', c.figure)],
        lines: R.timeline ? pickLines(R.timeline) : null,
        echo: echoOf(d),
        points: R.timeline ? [] : (R.points || []).map((p) => ({ hit: p.hit, redeem: !!p.redeem, text: ev.scene ? c.points[p.id] : U.light.points[p.id] })),
      };
    }
    return {
      name: T.eras[d.eraId].name,
      outcome: U.report.stamp[ctx.backend.stampOf(d)],
      text: R.summary ? [R.summary] : [],
      lines: pickLines(R.timeline || []),
      echo: echoOf(d),
    };
  }
  function starsOf(d) {
    const won = d.stars || 0;
    return '★'.repeat(won) + '☆'.repeat(Math.max(0, ctx.backend.maxStars(d.eraId) - won));
  }

  const caption = (d) => {
    const p = parts(d);
    const brand = [localTitle, englishTitle].filter(Boolean).join(' · ');
    const outcome = H.result.replace('{staff}', staffName(D, d.spec.staffId)).replace('{era}', p.name).replace('{outcome}', p.outcome);
    const result = [outcome, starsOf(d)].filter(Boolean).join('\n');
    return [brand, H.description, result, ...(p.echo ? [p.echo.quote + ' ' + p.echo.cite] : []), ...p.text,
      ...(p.lines || []).map((l) => (l.star ? '★ ' : '') + l.text), QR.url].join('\n\n');
  };

  // the pop-up body: the card and what can be done with it
  function html(d) {
    return `<div class="share">
      <h3>${esc(H.title)}</h3>
      <p class="muted">${esc(H.intro)}</p>
      <div class="row share-actions"><button class="primary" data-act="sharesave">${esc(H.save)}</button><button data-act="sharecopy">${esc(H.copy)}</button>${navigator.share ? `<button data-act="sharenative">${esc(H.send)}</button>` : ''}<span class="muted" id="sharemsg"></span></div>
      <canvas id="sharecanvas" width="${CV.w}" height="${CV.min_h}" aria-label="${esc(caption(d))}"></canvas>
    </div>`;
  }

  // Keep words together where possible, with character wrapping for CJK and oversized words.
  function wrap(g, text, width) {
    const tokens = text.match(/[（《「『【]*[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef][、。，；：！？）》」』】]*|[^\s\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]+|\s+/gu) || [];
    const lines = [];
    let line = '';
    for (const token of tokens) {
      const next = (line + token).trimEnd();
      if (line && g.measureText(next).width > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (g.measureText(token).width > width) {
        for (const char of token) {
          if (line && g.measureText(line + char).width > width) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
      } else {
        line += line ? token : token.trimStart();
      }
    }
    if (line.trimEnd()) lines.push(line.trimEnd());
    return lines;
  }

  function drawQR(g, x, y) {
    const { qr_size: size, qr_quiet: quiet } = CV;
    const cells = QR.rows.length + quiet * 2;
    const edge = (n) => Math.round((n + quiet) * size / cells);
    g.fillStyle = C.colors.qr_bg;
    g.fillRect(x, y, size, size);
    g.fillStyle = C.colors.ink;
    QR.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') g.fillRect(x + edge(c), y + edge(r), edge(c + 1) - edge(c), edge(r + 1) - edge(r));
      }
    });
  }

  function draw(d) {
    const cv = document.getElementById('sharecanvas');
    if (!cv) return;
    const g = cv.getContext('2d');
    const K = C.colors;
    const p = parts(d);
    const serif = '"Noto Serif SC", "Songti SC", SimSun, Georgia, serif';
    const sans = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
    const { w, min_h: minHeight, max_h: maxHeight, pad, logo_px: logoSize } = CV;
    const width = w - 2 * pad;
    const center = w / 2;
    const rows = [];
    const lineHeight = (size) => Math.ceil(size * CV.line_gap);
    let y = pad;

    function text(value, { size, face = sans, weight = 400, color = K.ink, x = pad, max = width, align = 'left', limit = Infinity } = {}) {
      if (!value) return;
      const font = `${weight} ${size}px ${face}`;
      g.font = font;
      const lines = wrap(g, value, max);
      if (lines.length > limit) {
        lines.length = limit;
        const last = Array.from(lines[limit - 1].replace(/[\s,.，。]+$/u, ''));
        while (last.length && g.measureText(last.join('').trimEnd() + '…').width > max) last.pop();
        lines[limit - 1] = last.join('').trimEnd() + '…';
      }
      for (const line of lines) {
        rows.push({ line, font, color, x, y: y + size, align });
        y += lineHeight(size);
      }
    }

    const qrX = w - pad - CV.qr_size;
    const titleX = pad + logoSize + 20;
    const titleSpace = { x: titleX, max: qrX - titleX - 26 };
    if (localTitle) text(localTitle, { ...titleSpace, size: 39, face: serif, weight: 700 });
    else y += 8;
    text(englishTitle, { ...titleSpace, size: CV.title_px, face: serif, weight: 700 });
    text(H.description, { ...titleSpace, size: CV.description_px, color: K.ink2 });
    const brandEnd = y;
    y = pad + CV.qr_size + 10;
    text(new URL(QR.url).hostname, {
      x: qrX + CV.qr_size / 2, max: CV.qr_size + 24, align: 'center', size: 20, weight: 700, color: K.ink2,
    });
    y = Math.max(y, brandEnd);

    const eventStart = rows.length;
    y += 39;
    text(p.name, { size: CV.event_px, face: serif, weight: 700, limit: 2 });
    const rating = [starsOf(d), p.outcome].filter(Boolean).join(' · ');
    text(rating, { size: CV.body_px, weight: 700, color: K.stamp, limit: 2 });

    const echoStart = rows.length;
    let echoPanel;
    if (p.echo) {
      const top = y + 26;
      y = top + 22;
      const hero = { x: center, max: width - 72, align: 'center' };
      let size = CV.echo_px;
      while (size > CV.echo_min_px) {
        g.font = `700 ${size}px ${serif}`;
        if (wrap(g, p.echo.quote, hero.max).length <= 3) break;
        size = Math.max(CV.echo_min_px, size - 6);
      }
      text(p.echo.quote, { ...hero, size, face: serif, weight: 700, limit: 4 });
      y += 12;
      text(p.echo.cite, { ...hero, size: CV.small_px + 2, color: K.ink2, limit: 2 });
      y += 18;
      echoPanel = { top, height: y - top };
    }

    const bodyStart = rows.length;
    const record = p.lines
      ? p.lines.map((line) => ({
        value: (line.star ? '★ ' : '') + line.text,
        color: line.star ? K.stamp : line.history ? K.ink2 : K.ink,
        priority: line.star ? 0 : line.history ? 2 : 1,
      }))
      : (p.points || []).filter((pt) => pt.text).map((pt) => ({
        value: `${pt.redeem ? (pt.hit ? '♥' : '♡') : (pt.hit ? '★' : '☆')} ${pt.text}`,
        color: pt.hit ? K.stamp : K.ink2,
        priority: pt.hit ? 0 : 1,
      }));
    const disclaimerSize = CV.small_px - 2;
    const disclaimerLimit = 2;
    const footerGap = 33;
    const footerInset = 18;
    const excerptGap = 8;
    g.font = `400 ${disclaimerSize}px ${sans}`;
    const disclaimerHeight = lineHeight(disclaimerSize) * Math.min(disclaimerLimit, wrap(g, H.disclaimer, width).length);
    const recordEnd = maxHeight - pad - disclaimerHeight - footerInset - footerGap - excerptGap;
    const bodyStep = lineHeight(CV.body_px);
    if (p.text.length || record.length) y += echoPanel ? 27 : 38;
    for (const value of p.text) {
      const room = Math.floor((recordEnd - y) / bodyStep);
      if (room < 1) break;
      text(value, { size: CV.body_px, limit: Math.min(room, record.length ? 2 : 4) });
      y += excerptGap;
    }
    // Fit up to four excerpts within the height limit, choosing star entries first and printing them in order.
    const ranked = record.map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => a.priority - b.priority).slice(0, 4);
    const selected = [];
    let room = recordEnd - y;
    g.font = `400 ${CV.body_px}px ${sans}`;
    for (const entry of ranked) {
      const available = Math.floor(room / bodyStep);
      if (available < 1) break;
      const lines = Math.min(2, wrap(g, entry.value, width).length);
      if (lines > available && entry.priority > 0) continue;
      const limit = Math.min(lines, available);
      selected.push({ ...entry, limit });
      room -= limit * bodyStep + excerptGap;
    }
    for (const { value, color, limit } of selected.sort((a, b) => a.index - b.index)) {
      text(value, { size: CV.body_px, color, limit });
      y += excerptGap;
    }

    const footerStart = rows.length;
    const footerY = y + footerGap;
    y = footerY + footerInset;
    text(H.disclaimer, { size: disclaimerSize, color: K.ink2, limit: disclaimerLimit });
    const height = Math.max(minHeight, y + pad);
    const extra = height - y - pad;
    // Sparse cards share the breathing room between sections and keep their footer near the text.
    const footerSpace = Math.min(42, Math.round(extra / 4));
    const bodyOffset = extra - footerSpace;
    const eventOffset = Math.round(bodyOffset * (p.echo ? 0.32 : 0.55));
    const echoOffset = Math.round(bodyOffset * 0.68);

    if (cv.height !== height) cv.height = height;
    g.fillStyle = K.bg;
    g.fillRect(0, 0, w, height);
    g.strokeStyle = K.stamp;
    g.lineWidth = CV.border;
    g.strokeRect(CV.border / 2, CV.border / 2, w - CV.border, height - CV.border);
    if (echoPanel) {
      g.beginPath();
      g.roundRect(pad, echoPanel.top + echoOffset, width, echoPanel.height, 16);
      g.fillStyle = K.echo_bg;
      g.fill();
      g.strokeStyle = K.echo_line;
      g.lineWidth = 2;
      g.stroke();
    }
    g.strokeStyle = K.line;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(pad, footerY + extra); g.lineTo(w - pad, footerY + extra);
    g.stroke();

    if (logo.complete && logo.naturalWidth) g.drawImage(logo, pad, pad, logoSize, logoSize);
    else logo.addEventListener('load', () => {
      if (document.getElementById('sharecanvas') === cv) draw(d);
    }, { once: true });

    g.textBaseline = 'alphabetic';
    rows.forEach(({ line, font, color, x, y: rowY, align }, i) => {
      g.font = font;
      g.fillStyle = color;
      g.textAlign = align;
      const offset = i >= footerStart ? extra : i >= bodyStart ? bodyOffset
        : i >= echoStart ? echoOffset : i >= eventStart ? eventOffset : 0;
      g.fillText(line, x, rowY + offset);
    });
    drawQR(g, qrX, pad);
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
