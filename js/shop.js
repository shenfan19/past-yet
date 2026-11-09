// Shops, stock and antiques. Items are bought into stock and carried from stock. Antiques can be sold or locked.
export function createShop(X) {
  const { D, ctx, T, U, esc, st, DEV } = X;
  const S_ = U.shop;
  const O = D.get('config.office');
  const sell1 = (id) => Math.floor(D.get(`items.${id}.cost`) * O.sell_ratio);
  const s = () => st.shop;
  const tagOk = (tags) => !s().tag || tags.includes(s().tag);
  const textOk = (name, desc) => { const q = s().q.trim().toLowerCase(); return !q || (name + ' ' + desc).toLowerCase().includes(q); };
  const tagChips = (tags) => tags.map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('');
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;

  function itemCard(id, mode) {
    const it = D.get('items.' + id), tx = T.items[id], S = ctx.S();
    const n = S.inv[id] || 0;
    const shop = D.get('shops.shops.' + it.shop);
    const hidden = !it.playable || !shop.playable;
    let actions;
    if (mode === 'buy') {
      const blocked = hidden || it.ip || S.funds < it.cost * it.step;
      actions = `<button data-act="shopbuy" data-id="${id}" ${blocked ? 'disabled' : ''}>${S_.buy} ×${it.step} · ${it.cost * it.step}</button>`;
    } else {
      actions = `<button data-act="shopsell" data-id="${id}" ${n < 1 ? 'disabled' : ''}>${S_.sell} ×${Math.min(it.step, n)} · ${sell1(id) * Math.min(it.step, n)}</button>`;
    }
    return `<div class="card ${hidden ? 'locked' : ''}"><div class="row sp"><h3>${esc(tx.name)}${hidden && DEV ? ' ' + hiddenChip() : ''}</h3>${actions}</div>
      <div>${tagChips(it.tags)}${it.ip ? `<span class="chip warn">${S_.ip_unchecked}</span>` : ''}</div>
      <p class="muted">${esc(tx.desc)}</p><div class="muted">${S_.buy_price} ${it.cost} · ${S_.sell_price} ${sell1(id)} · ${S_.stock} ${n}</div></div>`;
  }

  function antiqueCard(id) {
    const an = D.get('antiques.antiques.' + id), tx = T.antiques[id], S = ctx.S();
    const own = S.antiques.includes(id);
    const lock = S.locks.includes(id);
    const dest = own || DEV ? (an.era ? T.eras[an.era].short : U.dispatch.not_ready) : U.dispatch.unknown_dest;
    const kind = { key: U.dispatch.kind_key, daily: U.dispatch.kind_daily, story: U.dispatch.kind_story }[an.kind];
    const actions = own
      ? `<button data-act="antlock" data-id="${id}">${lock ? S_.unlock : S_.lock}</button><button data-act="antsell" data-id="${id}" ${lock ? 'disabled' : ''}>${S_.sell_antique} · ${an.sell}</button>`
      : `<button data-act="antbuy" data-id="${id}" ${S.funds < an.price || !an.playable ? 'disabled' : ''}>${S_.buy} · ${an.price}</button>`;
    return `<div class="card ${own ? '' : 'locked'}"><div class="row sp"><h3>${esc(tx.name)}${DEV && !an.playable ? ' ' + hiddenChip() : ''}${lock ? ' <span class="chip">' + S_.locked + '</span>' : ''}</h3><div class="row">${actions}</div></div>
      <div>${tagChips(an.tags)}</div><p class="muted">${esc(tx.desc)}</p><div class="muted">${U.dispatch.points_to}：${esc(dest)}${own || DEV ? ' · ' + esc(kind) : ''}</div></div>`;
  }

  function html() {
    const S = ctx.S();
    const items = Object.keys(D.get('items'));
    const visibleItem = (id) => { const it = D.get('items.' + id); return tagOk(it.tags) && textOk(T.items[id].name, T.items[id].desc); };
    const stock = items.filter((id) => (S.inv[id] || 0) > 0 && visibleItem(id));
    const shopSection = (shopId) => {
      const sh = D.get('shops.shops.' + shopId);
      if (!sh.playable && !DEV) return `<div class="card locked"><h3>${U.enc.locked_name}</h3><p class="muted">${U.enc.locked_text}</p></div>`;
      const cards = items.filter((id) => D.get('items.' + id).shop === shopId && visibleItem(id)).map((id) => itemCard(id, 'buy')).join('');
      return `<p class="muted">${esc(S_[shopId].desc)}${!sh.playable ? ' ' + hiddenChip() : ''}</p><div class="grid2">${cards || `<p class="muted">${S_.empty_shop}</p>`}</div>`;
    };
    const ants = Object.keys(D.get('antiques.antiques')).filter((id) => {
      const an = D.get('antiques.antiques.' + id);
      return (DEV || an.playable || S.antiques.includes(id)) && tagOk(an.tags) && textOk(T.antiques[id].name, T.antiques[id].desc);
    });
    const present = new Set();
    for (const id of items) D.get('items.' + id).tags.forEach((t) => present.add(t));
    for (const id of Object.keys(D.get('antiques.antiques'))) D.get('antiques.antiques.' + id).tags.forEach((t) => present.add(t));
    const bar = `<div class="tagbar"><button class="chipbtn ${s().tag ? '' : 'on'}" data-act="shoptag" data-id="">${S_.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${s().tag === t ? 'on' : ''}" data-act="shoptag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div>`;
    return `
      <div class="row" style="margin-bottom:6px"><input id="shop-q" type="search" placeholder="${S_.filter_ph}" value="${esc(s().q)}" style="flex:1;min-width:200px"><span class="stat" style="font-size:18px">${Math.round(S.funds)}</span><span class="muted">${U.office.funds}</span></div>
      ${bar}
      <div class="sec">${S_.inv_title}</div><div class="grid2">${stock.map((id) => itemCard(id, 'sell')).join('') || `<p class="muted">${S_.inv_empty}</p>`}</div>
      <div class="sec">${S_.modern.name}</div>${shopSection('modern')}
      <div class="sec">${S_.future.name}</div>${shopSection('future')}
      <div class="sec">${S_.antiques_title}</div><p class="muted">${S_.antiques_hint}</p><div class="grid2">${ants.map(antiqueCard).join('')}</div>`;
  }

  function act(a, id) {
    const S = ctx.S();
    if (a === 'shoptag') { s().tag = id; return true; }
    if (a === 'shopbuy') {
      const it = D.get('items.' + id);
      if (it.playable && !it.ip && D.get('shops.shops.' + it.shop).playable && S.funds >= it.cost * it.step) { S.funds -= it.cost * it.step; S.inv[id] = (S.inv[id] || 0) + it.step; ctx.save(); }
      return true;
    }
    if (a === 'shopsell') {
      const it = D.get('items.' + id), n = Math.min(it.step, S.inv[id] || 0);
      if (n > 0) { S.funds += sell1(id) * n; S.inv[id] -= n; ctx.save(); }
      return true;
    }
    if (a === 'antbuy') {
      const an = D.get('antiques.antiques.' + id);
      if (an.playable && !S.antiques.includes(id) && S.funds >= an.price) { S.funds -= an.price; S.antiques.push(id); ctx.save(); }
      return true;
    }
    if (a === 'antsell') {
      const an = D.get('antiques.antiques.' + id);
      if (S.antiques.includes(id) && !S.locks.includes(id)) { S.funds += an.sell; S.antiques = S.antiques.filter((x) => x !== id); ctx.save(); }
      return true;
    }
    if (a === 'antlock') {
      if (S.antiques.includes(id)) { S.locks = S.locks.includes(id) ? S.locks.filter((x) => x !== id) : [...S.locks, id]; ctx.save(); }
      return true;
    }
    return false;
  }
  function onInput(el) {
    if (el.id !== 'shop-q') return false;
    s().q = el.value;
    return true;
  }
  return { html, act, onInput };
}
