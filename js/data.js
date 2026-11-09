// Strict data access: a missing key throws, there are no silent defaults.
export class Data {
  constructor(obj) { this.o = obj; }
  get(path) {
    let v = this.o;
    for (const part of path.split('.')) {
      if (v === null || typeof v !== 'object' || !(part in v)) throw new Error('缺少数据键: ' + path);
      v = v[part];
    }
    return v;
  }
}

const FILES = ['config', 'items', 'staff', 'map', 'antiques', 'shops', 'text.zh', 'encyclopedia.zh'];

export async function loadData(readText, parse) {
  const o = {};
  for (const f of FILES) o[f.replace('.', '_')] = parse(await readText('data/' + f + '.yaml'));
  o.world = JSON.parse(await readText('data/world_land.json'));
  o.era_raw = {};
  o.era_src = {};
  for (const id of o.config.eras) {
    const src = await readText('data/eras/' + id + '.lm.yaml');
    o.era_src[id] = src;
    o.era_raw[id] = parse(src);
  }
  return new Data(o);
}
