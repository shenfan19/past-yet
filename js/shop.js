// Shops, stock and antiques as framed lists. Chosen purchases sit in a cart pinned at the top of the frame.
export function createShop(X) {
  const { D, ctx, T, U, esc, st, DEV, listbox } = X;
  const S_ = U.shop;
  const O = D.get('config.office');
  const sell1 = (id) => Math.floor(D.get(`items.${id}.cost`) * O.sell_ratio);
  const s = () => st.shop;
  const tagOk = (tags) => !s().tag || tags.includes(s().tag);
  const textOk = (name, desc) => { const q = s().q.trim().toLowerCase(); return !q || (name + ' ' + desc).toLowerCase().includes(q); };
  const tagChips = (tags) => tags.map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('');
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;
  const cart = () => st.cart;
  const cartTotal = () => Object.entries(cart()).reduce((a, [id, n]) => a + D.get(`items.${id}.cost`) * n, 0);
  const oneLine = (desc) => desc.split('。')[0] + '。';

  const nameCell = (kind, id, name, desc, tip, extra = '') => `${X.wl(kind + ':' + id, name, tip)}${extra}<div class="oneline muted">${esc(oneLine(desc))}</div>`;
  const itemTip = (id) => {
    const it = D.get('items.' + id);
    return `${T.items[id].desc}\n${U.enc.weight} ${it.weight} · ${S_.buy_price} ${it.cost} · ${S_.sell_price} ${sell1(id)}\n${it.tags.map((t) => T.tags[t]).join('、')}`;
  };
  const stepper = (decAct, incAct, id, n, decOff, incOff) => `<span class="stepper"><button data-act="${decAct}" data-id="${id}" ${decOff ? 'disabled' : ''}>−</button><span class="n">${n}</span><button data-act="${incAct}" data-id="${id}" ${incOff ? 'disabled' : ''}>+</button></span>`;

  function shopBox(shopId) {
    const sh = D.get('shops.shops.' + shopId);
    const S = ctx.S();
    const ids = Object.keys(D.get('items')).filter((id) => {
      const it = D.get('items.' + id);
      return it.shop === shopId && tagOk(it.tags) && textOk(T.items[id].name, T.items[id].desc);
    });
    const rows = ids.map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    const buyable = (it) => it.playable && sh.playable && !it.ip;
    const total = cartTotal();
    const foot = shopId === 'modern' && Object.keys(cart()).length
      ? `<span>${S_.total} <b>${total}</b></span> <button class="primary" data-act="cartbuy" ${total > S.funds ? 'disabled' : ''}>${S_.confirm}</button> <button class="ghost" data-act="cartclear">${S_.clear_cart}</button>` : '';
    return listbox.html({
      id: 'shop_' + shopId, rows, maxH: 300, pinned: (r) => (cart()[r.id] || 0) > 0, pinTitle: S_.cart, foot,
      cols: [
        { k: 'name', label: S_.col_name, w: '36%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, T.items[r.id].desc, itemTip(r.id), !buyable(r.it) && DEV ? ' ' + hiddenChip() : '') },
        { k: 'tags', label: S_.col_tags, w: '22%', cell: (r) => tagChips(r.it.tags) },
        { k: 'price', label: S_.buy_price, w: '10%', cls: 'num', val: (r) => r.it.cost, cell: (r) => r.it.cost },
        { k: 'stock', label: S_.stock, w: '10%', cls: 'num', val: (r) => S.inv[r.id] || 0, cell: (r) => S.inv[r.id] || 0 },
        { k: 'qty', label: S_.col_qty, w: '22%', cls: 'num', cell: (r) => (buyable(r.it)
          ? stepper('cartdec', 'cartinc', r.id, cart()[r.id] || 0, !(cart()[r.id] > 0), total + r.it.cost * r.it.step > S.funds)
          : `<span class="muted">${r.it.ip ? S_.ip_short : S_.planned}</span>`) },
      ],
    });
  }

  function invBox() {
    const S = ctx.S();
    const rows = Object.keys(D.get('items')).filter((id) => (S.inv[id] || 0) > 0 && tagOk(D.get('items.' + id).tags) && textOk(T.items[id].name, T.items[id].desc)).map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    return listbox.html({
      id: 'inv', rows, maxH: 220, empty: S_.inv_empty,
      cols: [
        { k: 'name', label: S_.col_name, w: '48%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, T.items[r.id].desc, itemTip(r.id)) },
        { k: 'stock', label: S_.stock, w: '14%', cls: 'num', val: (r) => S.inv[r.id], cell: (r) => S.inv[r.id] },
        { k: 'sell', label: S_.sell_price, w: '14%', cls: 'num', val: (r) => sell1(r.id), cell: (r) => sell1(r.id) },
        { k: 'act', label: '', w: '24%', cls: 'num', cell: (r) => `<button data-act="shopsell" data-id="${r.id}">${S_.sell} ×${Math.min(r.it.step, S.inv[r.id])}</button>` },
      ],
    });
  }

  function antiqueBox() {
    const S = ctx.S();
    const ids = Object.keys(D.get('antiques.antiques')).filter((id) => {
      const an = D.get('antiques.antiques.' + id);
      return (DEV || an.playable || S.antiques.includes(id)) && tagOk(an.tags) && textOk(T.antiques[id].name, T.antiques[id].desc);
    });
    const rows = ids.map((id) => ({ id, name: T.antiques[id].name, an: D.get('antiques.antiques.' + id), own: S.antiques.includes(id), lock: S.locks.includes(id) }));
    return listbox.html({
      id: 'ants', rows, maxH: 240,
      cols: [
        { k: 'name', label: S_.col_name, w: '34%', val: (r) => r.name, cell: (r) => nameCell('antiques', r.id, r.name, T.antiques[r.id].desc, T.antiques[r.id].desc + '\n' + r.an.tags.map((t) => T.tags[t]).join('、'), (DEV && !r.an.playable ? ' ' + hiddenChip() : '') + (r.lock ? ` <span class="chip">${S_.locked}</span>` : '')) },
        { k: 'dest', label: U.dispatch.points_to, w: '18%', cell: (r) => esc(r.own || DEV ? (r.an.era ? T.eras[r.an.era].short : U.dispatch.not_ready) : U.dispatch.unknown_dest) },
        { k: 'price', label: S_.buy_price, w: '10%', cls: 'num', val: (r) => r.an.price, cell: (r) => r.an.price },
        { k: 'sell', label: S_.sell_price, w: '10%', cls: 'num', val: (r) => r.an.sell, cell: (r) => r.an.sell },
        { k: 'act', label: '', w: '28%', cls: 'num', cell: (r) => (r.own
          ? `<button data-act="antlock" data-id="${r.id}">${r.lock ? S_.unlock : S_.lock}</button> <button data-act="antsell" data-id="${r.id}" ${r.lock ? 'disabled' : ''}>${S_.sell}</button>`
          : `<button data-act="antbuy" data-id="${r.id}" ${S.funds < r.an.price || !r.an.playable ? 'disabled' : ''}>${S_.buy}</button>`) },
      ],
    });
  }

  function html() {
    const S = ctx.S();
    const present = new Set();
    for (const id of Object.keys(D.get('items'))) D.get('items.' + id).tags.forEach((t) => present.add(t));
    for (const id of Object.keys(D.get('antiques.antiques'))) D.get('antiques.antiques.' + id).tags.forEach((t) => present.add(t));
    const bar = `<details class="tagfold"><summary>${S_.tag_filter}${s().tag ? '：' + esc(T.tags[s().tag]) : ''}</summary><div class="tagbar"><button class="chipbtn ${s().tag ? '' : 'on'}" data-act="shoptag" data-id="">${S_.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${s().tag === t ? 'on' : ''}" data-act="shoptag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div></details>`;
    const futureSh = D.get('shops.shops.future');
    const future = !futureSh.playable && !DEV
      ? `<div class="lbox"><div class="lfoot muted">${U.enc.locked_name} ${U.enc.locked_text}</div></div>`
      : `<p class="muted">${esc(S_.future.desc)}${!futureSh.playable ? ' ' + hiddenChip() : ''}</p>${shopBox('future')}`;
    return `
      <div class="row" style="margin-bottom:6px"><input id="shop-q" type="search" placeholder="${S_.filter_ph}" value="${esc(s().q)}" style="flex:1;min-width:200px"><span class="stat" style="font-size:18px">${Math.round(S.funds)}</span><span class="muted">${U.office.funds}</span></div>
      ${bar}
      <div class="sec">${S_.modern.name}</div><p class="muted">${esc(S_.modern.desc)}</p>${shopBox('modern')}
      <div class="grid2" style="margin-top:12px">
        <div><div class="sec" style="margin-top:0">${S_.inv_title}</div>${invBox()}</div>
        <div><div class="sec" style="margin-top:0">${S_.future.name}</div>${future}</div>
      </div>
      <div class="sec">${S_.antiques_title}</div><p class="muted">${S_.antiques_hint}</p>${antiqueBox()}`;
  }

  function act(a, id) {
    const S = ctx.S();
    if (a === 'shoptag') { s().tag = id; return true; }
    if (a === 'cartinc' || a === 'cartdec') {
      const it = D.get('items.' + id);
      const n = (cart()[id] || 0) + (a === 'cartinc' ? it.step : -it.step);
      if (n <= 0) delete cart()[id]; else if (cartTotal() + it.cost * it.step <= S.funds || a === 'cartdec') cart()[id] = n;
      return true;
    }
    if (a === 'cartclear') { st.cart = {}; return true; }
    if (a === 'cartbuy') {
      if (cartTotal() <= S.funds) {
        for (const [cid, n] of Object.entries(cart())) {
          const it = D.get('items.' + cid);
          if (it.playable && !it.ip && D.get('shops.shops.' + it.shop).playable) { S.funds -= it.cost * n; S.inv[cid] = (S.inv[cid] || 0) + n; }
        }
        st.cart = {};
        ctx.save();
      }
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
