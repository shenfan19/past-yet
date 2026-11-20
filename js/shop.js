// Shops, stock and antiques as framed lists. Chosen purchases sit in a cart pinned at the top of the frame.
import { firstSentence } from './narrate.js';

export function createShop(X) {
  const { D, ctx, T, U, esc, st, DEV, listbox, office } = X;
  const S_ = U.shop;
  // an item sells for exactly what it costs, in the currency of its shop, whenever the player likes
  const sell1 = (id) => D.get(`items.${id}.cost`);
  const tagOpts = (tags) => [...new Set(tags)].map((x) => ({ id: x, label: T.tags[x] }));
  const tagChips = (tags) => tags.map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('');
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;
  const cart = () => st.cart;
  // each shop is paid in its own currency, funds for the modern shop and time energy for the future one
  const curOf = (shopId) => D.get('shops.shops.' + shopId + '.currency');
  const icon = (c) => D.get('config.ui.currency_icons.' + c);
  const bal = (c) => (c === 'energy' ? ctx.S().energy : ctx.S().funds);
  const cartTotal = (shopId) => Object.entries(cart()).reduce((a, [id, n]) => a + (D.get(`items.${id}.shop`) === shopId ? D.get(`items.${id}.cost`) * n : 0), 0);
  const oneLine = firstSentence;
  const COLON = U.fmt.colon, SEP = U.fmt.sep;
  const signedPercent = new Intl.NumberFormat(D.lang, { style: 'percent', signDisplay: 'exceptZero' });

  // one row is one line: the name, then the description in a column of its own, cut short with the whole text in the tooltip
  const nameCell = (kind, id, name, tip, extra = '') => `<span class="nowrap">${X.wl(kind + ':' + id, name, tip)}${extra}</span>`;
  const descCell = (desc) => `<div class="oneline muted"${X.tip(desc)}>${esc(oneLine(desc))}</div>`;
  const itemTip = (id) => {
    const it = D.get('items.' + id);
    return `${T.items[id].desc}\n${U.enc.weight} ${it.weight} · ${S_.buy_price} ${it.cost} · ${S_.sell_price} ${sell1(id)}\n${it.tags.map((t) => T.tags[t]).join(SEP)}`;
  };
  const stepper = (decAct, incAct, id, n, decOff, incOff) => `<span class="stepper"><button data-act="${decAct}" data-id="${id}" ${decOff ? 'disabled' : ''}>−</button><span class="n">${n}</span><button data-act="${incAct}" data-id="${id}" ${incOff ? 'disabled' : ''}>+</button></span>`;

  function shopBox(shopId) {
    const sh = D.get('shops.shops.' + shopId);
    const S = ctx.S();
    const lid = 'shop_' + shopId;
    const base = Object.entries(D.get('items')).filter(([, it]) => it.shop === shopId && !it.retired).map(([id]) => id);
    const ids = base.filter((id) => listbox.match(lid, T.items[id].name + ' ' + T.items[id].desc, D.get('items.' + id).tags));
    const rows = ids.map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    const buyable = (it) => it.playable && sh.playable && !it.ip;
    const total = cartTotal(shopId);
    const cur = curOf(shopId);
    const foot = Object.keys(cart()).some((id) => D.get(`items.${id}.shop`) === shopId)
      ? `<span>${S_.total} <b>${total}</b> ${icon(cur)}</span> <button class="primary" data-act="cartbuy" data-id="${shopId}" ${total > bal(cur) ? 'disabled' : ''}>${S_.confirm}</button> <button class="ghost" data-act="cartclear">${S_.clear_cart}</button>` : '';
    return listbox.html({
      id: lid, tools: listbox.tools(lid, tagOpts(base.flatMap((id) => D.get('items.' + id).tags))), rows, pinned: (r) => (cart()[r.id] || 0) > 0, pinTitle: S_.cart, foot,
      cols: [
        { k: 'name', label: S_.col_name, w: '20%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, itemTip(r.id), !buyable(r.it) && DEV ? ' ' + hiddenChip() : '') },
        { k: 'desc', label: S_.col_desc, w: '28%', cell: (r) => descCell(T.items[r.id].desc) },
        { k: 'tags', label: S_.col_tags, w: '16%', cell: (r) => `<span class="nowrap">${tagChips(r.it.tags)}</span>` },
        { k: 'price', label: S_.buy_price, w: '9%', cls: 'num', val: (r) => r.it.cost, cell: (r) => `${r.it.cost} ${icon(cur)}` },
        { k: 'stock', label: S_.stock, w: '8%', cls: 'num', val: (r) => S.inv[r.id] || 0, cell: (r) => S.inv[r.id] || 0 },
        { k: 'qty', label: S_.col_qty, w: '19%', cls: 'num', cell: (r) => (r.it.unlock_energy > S.energy ? `<span class="muted"${X.tip(S_.locked_tip)}>🔒 ${r.it.unlock_energy} ${icon('energy')}</span>` : buyable(r.it)
          ? stepper('cartdec', 'cartinc', r.id, cart()[r.id] || 0, !(cart()[r.id] > 0), total + r.it.cost * r.it.step > bal(cur))
          : `<span class="muted">${r.it.ip ? S_.ip_short : S_.planned}</span>`) },
      ],
    });
  }

  function invBox() {
    const S = ctx.S();
    const held = Object.keys(D.get('items')).filter((id) => (S.inv[id] || 0) > 0);
    const rows = held.filter((id) => listbox.match('inv', T.items[id].name + ' ' + T.items[id].desc, D.get('items.' + id).tags)).map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    return listbox.html({
      id: 'inv', tools: listbox.tools('inv', tagOpts(held.flatMap((id) => D.get('items.' + id).tags))), rows, empty: S_.inv_empty,
      cols: [
        { k: 'name', label: S_.col_name, w: '24%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, itemTip(r.id)) },
        { k: 'desc', label: S_.col_desc, w: '38%', cell: (r) => descCell(T.items[r.id].desc) },
        { k: 'stock', label: S_.stock, w: '9%', cls: 'num', val: (r) => S.inv[r.id], cell: (r) => S.inv[r.id] },
        { k: 'sell', label: S_.sell_price, w: '12%', cls: 'num', val: (r) => sell1(r.id), cell: (r) => `${sell1(r.id)} ${icon(curOf(r.it.shop))}` },
        { k: 'act', label: '', w: '17%', cls: 'num', cell: (r) => `<button data-act="shopsell" data-id="${r.id}">${S_.sell} ×${Math.min(r.it.step, S.inv[r.id])}</button>` },
      ],
    });
  }

  // An antique opens its place only while it is anchored. It cannot be released while someone is away there,
  // and the last anchored place cannot be released, so the office always has somewhere to send people.
  function releasable(id) {
    const S = ctx.S();
    const an = D.get('antiques.antiques.' + id);
    if (!an.era) return true;
    if (S.dispatches.some((d) => !d.claimed && d.eraId === an.era)) return false;
    return S.locks.some((x) => x !== id && D.get('antiques.antiques.' + x).era);
  }

  const copies = (id) => ctx.S().antiques.filter((x) => x === id).length;
  // a copy that is anchored is not for sale, the rest are
  const sellable = (id) => copies(id) - (ctx.S().locks.includes(id) ? 1 : 0) > 0;

  const selectedGrantTier = () => st.filters.grantTier ?? null;

  function antiqueBox(secretary, tier) {
    const S = ctx.S();
    const shown = Object.keys(D.get('antiques.antiques')).filter((id) => (DEV || S.antiques.includes(id)) && D.get('antiques.antiques.' + id).kind !== 'medium');
    const offers = shown.map((id) => ({ id, name: T.antiques[id].name, an: D.get('antiques.antiques.' + id), own: S.antiques.includes(id), n: copies(id), lock: S.locks.includes(id), grant: office.grantQuote(id, secretary) }));
    const tiers = [...new Set([...offers.map((r) => r.grant.base), ...(tier === null ? [] : [tier])])].sort((a, b) => a - b);
    const tierFilter = `<label class="nowrap">${esc(S_.grant_tier)} <select id="grant-tier"><option value="">${esc(S_.all_grant_tiers)}</option>${tiers.map((value) => `<option value="${value}" ${value === tier ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`;
    const rows = offers.filter((r) => (tier === null || r.grant.base === tier) && listbox.match('ants', r.name + ' ' + T.antiques[r.id].desc, r.an.tags));
    const percent = secretary ? esc(signedPercent.format(secretary)) : '';
    const bonus = D.lang.startsWith('zh') ? `（${percent}）` : ` (${percent})`;
    const uplift = percent ? `<small class="delta up">${bonus}</small>` : '';
    return listbox.html({
      id: 'ants', tools: tierFilter + listbox.tools('ants', tagOpts(offers.flatMap((r) => r.an.tags))), rows, empty: offers.length ? U.lbox.empty : S_.antiques_empty,
      cols: [
        { k: 'name', label: S_.col_name, w: '21%', val: (r) => r.name, cell: (r) => nameCell('antiques', r.id, r.name, T.antiques[r.id].desc + '\n' + r.an.tags.map((t) => T.tags[t]).join(SEP), (DEV && !r.an.playable ? ' ' + hiddenChip() : '') + (r.lock ? ` <span class="chip">${S_.locked}</span>` : '')) },
        { k: 'desc', label: S_.col_desc, w: '18%', cell: (r) => descCell(T.antiques[r.id].desc) },
        { k: 'dest', label: U.dispatch.points_to, w: '14%', cell: (r) => esc(r.own || DEV ? (r.an.era ? T.eras[r.an.era].short : r.an.event ? T.catalog[r.an.event].place : U.dispatch.not_ready) : U.dispatch.unknown_dest) },
        { k: 'count', label: S_.copies, w: '6%', cls: 'num', val: (r) => r.n, cell: (r) => r.n },
        { k: 'sell', label: S_.research_grant, w: '100px', cls: 'num', val: (r) => r.grant.total, cell: (r) => `<span class="nowrap">${r.grant.total}${uplift}</span>` },
        { k: 'act', label: '', w: '21%', cls: 'num', cell: (r) => (r.own
          ? `<button data-act="antlock" data-id="${r.id}" ${r.lock && !releasable(r.id) ? 'disabled' : ''}${r.lock && !releasable(r.id) ? ' data-tip="' + esc(S_.keep_one) + '"' : ''}>${r.lock ? S_.unlock : S_.lock}</button> <button data-act="antsell" data-id="${r.id}" ${sellable(r.id) ? '' : 'disabled'}>${S_.sell_antique}</button>`
          : '') },
      ],
    });
  }

  function antiquesSection() {
    const { period_days } = D.get('config.office.market');
    const tier = selectedGrantTier();
    const secretary = office.perks().sale_mult;
    const cycle = S_.grant_cycle.replace('{days}', String(period_days));
    const offers = office.spareOffers(tier);
    const spares = offers.reduce((count, offer) => count + offer.n, 0);
    const spareFund = offers.reduce((amount, offer) => amount + offer.n * offer.price, 0);
    const transfer = tier === null ? S_.sell_spares : S_.sell_tier_spares;
    return `<p class="muted">${esc(S_.antiques_hint)}</p>
      <p class="muted">${esc(cycle)}</p>
      <div class="row" style="margin-bottom:6px"><button data-act="sellspares" ${spares ? '' : 'disabled'}>${esc(transfer)}${spares ? ` ×${spares} · ${spareFund} ${icon('funds')}` : ''}</button></div>${antiqueBox(secretary, tier)}`;
  }

  // The agency page: antiques, items, the two shops, the employees and the hiring offer. The employee blocks come from the page as they are.
  // the buying page holds the two shops and the hiring offer, the agency page the employees, the goods and the antiques
  const GROUPS = { buy: ['modern', 'future', 'hire'], shop: ['staff', 'inv', 'ants'] };
  function html(extra, tab) {
    const future = `<p class="muted">${esc(S_.future.desc)}</p>${shopBox('future')}`;
    // each page lists its sections one under the other, every list is paged
    const parts = {
      modern: () => `<p class="muted">${esc(S_.modern.desc)}</p>${shopBox('modern')}`,
      future: () => future,
      hire: () => extra.hire,
      staff: () => extra.staff,
      inv: () => `<p class="muted">${S_.inv_hint}</p>${invBox()}`,
      ants: antiquesSection,
    };
    const names = { modern: S_.modern.name, future: S_.future.name, hire: U.office.hire_title, staff: U.office.staff, inv: S_.inv_title, ants: S_.antiques_title };
    const ids = GROUPS[tab];
    return `
      ${ids.map((id) => `<div class="sec" id="shop-${id}">${names[id]}</div>${parts[id]()}`).join('')}`;
  }

  function act(a, id) {
    const S = ctx.S();
    if (a === 'cartinc' || a === 'cartdec') {
      const it = D.get('items.' + id);
      const n = (cart()[id] || 0) + (a === 'cartinc' ? it.step : -it.step);
      if (it.unlock_energy > S.energy && a === 'cartinc') return true;
      if (n <= 0) delete cart()[id]; else if (cartTotal(it.shop) + it.cost * it.step <= bal(curOf(it.shop)) || a === 'cartdec') cart()[id] = n;
      return true;
    }
    if (a === 'cartclear') { st.cart = {}; return true; }
    if (a === 'cartbuy') {
      const cur = curOf(id);
      if (cartTotal(id) <= bal(cur)) {
        for (const [cid, n] of Object.entries(cart())) {
          const it = D.get('items.' + cid);
          if (it.shop !== id) continue;
          if (it.playable && !it.ip && D.get('shops.shops.' + it.shop).playable) {
            if (cur === 'energy') S.energy -= it.cost * n; else S.funds -= it.cost * n;
            S.inv[cid] = (S.inv[cid] || 0) + n;
          }
          delete cart()[cid];
        }
        ctx.save();
      }
      return true;
    }
    if (a === 'shopsell') {
      const it = D.get('items.' + id), n = Math.min(it.step, S.inv[id] || 0);
      if (n > 0) { if (curOf(it.shop) === 'energy') S.energy += sell1(id) * n; else S.funds += sell1(id) * n; S.inv[id] -= n; ctx.save(); }
      return true;
    }
    if (a === 'sellspares') return !!office.sellSpares(Infinity, true, selectedGrantTier());
    if (a === 'antsell') {
      if (!sellable(id)) return false;
      S.funds += office.salePrice(id);
      S.antiques.splice(S.antiques.indexOf(id), 1);
      if (!S.antiques.includes(id)) S.autoAnchored = (S.autoAnchored || []).filter((x) => x !== id);
      ctx.save();
      return true;
    }
    if (a === 'antlock') {
      if (!S.antiques.includes(id)) return false;
      if (S.locks.includes(id)) {
        if (!releasable(id)) return false;
        S.locks = S.locks.filter((x) => x !== id);
        S.autoAnchored ||= [];
        if (!S.autoAnchored.includes(id)) S.autoAnchored.push(id);
      } else {
        S.locks.push(id);
      }
      ctx.save();
      return true;
    }
    return false;
  }
  return { html, act };
}
