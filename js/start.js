// The candidates for the first employees: cards marked start_pool, drawn at random, never two from the same region, so the offer spans the world.
// The first ones drawn are picked by default, and the player may swap them until the first trip goes out.
export function drawStartStaff(D, O) {
  const staff = D.get('staff.staff');
  const pool = Object.keys(staff).filter((id) => staff[id].start_pool);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const offer = [], seen = new Set();
  for (const id of pool) {
    if (offer.length >= O.start_staff.offer) break;
    if (seen.has(staff[id].region)) continue;
    seen.add(staff[id].region);
    offer.push(id);
  }
  return { offer, pick: offer.slice(0, O.start_staff.pick) };
}
