export function participation(D, tier, stay, spec, statsAt, drawStage) {
  const approachDay = Math.min(3, Math.max(1, Math.round(stay * 0.04)));
  const recognitionDay = Math.min(7, Math.max(approachDay + 1, Math.round(stay * 0.08)));
  const approach = statsAt(approachDay);
  const recognition = statsAt(recognitionDay);
  const staff = D.get('staff.staff.' + spec.staffId);
  const prepared = Object.values(spec.items || {}).some((n) => n > 0) ? 0.6 : 0;
  const trusted = staff.traits.some((trait) => ['kind', 'patient', 'charismatic', 'cosmopolitan', 'methodical'].includes(trait)) ? 0.8 : 0;
  // the identity the traveller came as opens the door sooner or later
  const idReach = spec.identity ? spec.identity.reach : 0, idAccept = spec.identity ? spec.identity.accept : 0;
  const chance = (stage) => (drawStage(stage) - 0.5) * 2;
  const reached = approach.wit * 0.45 + approach.will * 0.35 + approach.finesse * 0.2 + idReach + chance('reach') >= 1.8 + tier * 0.25;
  const accepted = reached && recognition.wit * 0.35 + recognition.will * 0.35 + recognition.constitution * 0.3 + prepared + trusted + idAccept + chance('recognition') >= 2.1 + tier * 0.35;
  return { approachDay, recognitionDay, reached, accepted };
}
