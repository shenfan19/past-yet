// Stable-stream randomness. A draw depends only on (seed, key, index), never on how many
// other draws happened before, so changing one item does not reshuffle the rest of the run.
// The hash constants below belong to the cyrb53 algorithm, they are not game rules.
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 2097152 + (h1 >>> 11);
}

export function draw(seed, key, index) {
  return hash(`${seed}|${key}|${index}`) / 9007199254740992;
}
