// The founder: the player's own character, the 51st employee. The card lives in the save, and is put into the data as if it were a staff card, so the rest of the game
// treats the founder like anyone else. Every number is in config.founder.
export function defaultFounder(D) {
  const F = D.get('config.founder');
  return { id: F.id, name: '', gender: F.default_gender, skin: F.default_skin, base: { ...F.default_base }, traits: [] };
}

export const pointsLeft = (D, f) => D.get('config.founder.total') - Object.values(f.base).reduce((a, b) => a + b, 0);

// null when the founder is complete and allowed, otherwise a code that says what is wrong
export function founderProblem(D, f) {
  const F = D.get('config.founder');
  if (!f || typeof f !== 'object') return 'missing';
  if (typeof f.name !== 'string' || !f.name.trim() || f.name.length > F.name_max) return 'name';
  if (!(f.gender in D.get('staff.gender_class'))) return 'gender';
  if (!(f.skin in D.get('hiring.skin_tones'))) return 'skin';
  const attrs = D.get('staff.attributes');
  if (!f.base || attrs.some((a) => !Number.isInteger(f.base[a]) || f.base[a] < F.min || f.base[a] > F.max)) return 'attributes';
  if (pointsLeft(D, f) < 0) return 'points';
  const traits = D.get('staff.traits');
  if (!Array.isArray(f.traits) || f.traits.length > F.traits_max || new Set(f.traits).size !== f.traits.length || f.traits.some((t) => !(t in traits))) return 'traits';
  return null;
}

// puts the founder into the staff cards and the text of the language in use
export function applyFounder(D, f) {
  const F = D.get('config.founder');
  const W = D.get('text.ui.welcome');
  D.o.staff.staff[f.id] = { gender: f.gender, age: F.age, skin: f.skin, base: { ...f.base }, traits: [...f.traits], jobs: ['founder'], start_pool: false };
  D.o.text.staff[f.id] = { name: f.name.trim() || W.founder_unnamed, ethnicity: '', jobs: [W.founder_job], bio: W.founder_bio, story: W.founder_story };
}
