export function matchLocale(config, value) {
  if (typeof value !== 'string') return null;
  const tag = value.trim().toLowerCase().replaceAll('_', '-');
  const codes = Object.keys(config.locales);
  const exact = codes.find((code) => code.toLowerCase() === tag);
  if (exact) return exact;

  const [language, ...subtags] = tag.split('-');
  const script = subtags[0];
  const region = script?.length === 4 ? subtags[1] : script;
  if (language === 'zh' && (script === 'hant' || (script !== 'hans' && ['tw', 'hk', 'mo'].includes(region)))) {
    const traditional = codes.find((code) => code.toLowerCase() === 'zh-hant');
    if (traditional) return traditional;
  }
  return codes.find((code) => code.toLowerCase() === language) ?? null;
}

export function chosenLocale(config, url, saved) {
  return matchLocale(config, url) ?? matchLocale(config, saved) ?? config.auto;
}

export function pickLocale(config, url, saved, browserLanguages) {
  const chosen = chosenLocale(config, url, saved);
  if (chosen !== config.auto) return chosen;
  for (const value of browserLanguages) {
    const matched = matchLocale(config, value);
    if (matched) return matched;
  }
  return config.fallback;
}

export const localeTag = (code) => code === 'zh' ? 'zh-Hans' : code;
