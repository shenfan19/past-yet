# Converts the story prose of a story into a language written by conversion, config.i18n.convert, such as Traditional Chinese from
# Simplified with OpenCC. It reads text.<from>.story_prose from the person card and writes catalog.<id>.story_prose into the catalog file
# of that language, cards/text/<lang>/catalog_stories.yaml, for each story whose card that language already carries, replacing an older
# block. Only the values are converted: the field names, the tag keys of variants and the {placeholders} stay as they are.
# Read the result through afterwards; a converter does not know every word. Needs pip install opencc pyyaml.
# Usage: python tools/story_prose_convert.py [eventId,eventId]   (without IDs: every story whose source text has story prose)
#        python tools/story_prose_convert.py --whole   converts every file of the language under cards/text/<lang>/ in place as well,
#        for text translated before the conversion was set up; the converter leaves text already in the target script as it is
#        python tools/story_prose_convert.py --stale   only reports: every text of a story card in the language whose wording has
#        drifted from the conversion of the source, as when the Chinese was rewritten and the Traditional Chinese was not; it changes nothing
#        python tools/story_prose_convert.py --stale --refresh   writes the conversion over each drifted text found once in the file, to read through
import os, re, sys, difflib
import yaml, opencc

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CARDS = os.path.join(ROOT, 'cards')
config = yaml.safe_load(open(os.path.join(CARDS, 'config', 'config.yaml'), encoding='utf-8'))
whole = '--whole' in sys.argv
stale = '--stale' in sys.argv
refresh = '--refresh' in sys.argv
args = [a for a in sys.argv[1:] if a not in ('--whole', '--stale', '--refresh')]
wanted = [x for x in (args[0].split(',') if args else []) if x]

def convert(value, cc, fix):
    if isinstance(value, str):
        out = cc.convert(value)
        for wrong, right in fix.items(): out = out.replace(wrong, right)
        return out
    if isinstance(value, list): return [convert(v, cc, fix) for v in value]
    if isinstance(value, dict): return {k: convert(v, cc, fix) for k, v in value.items()}
    return value

def cards():
    root = os.path.join(CARDS, 'people')
    for d in sorted(os.listdir(root)):
        f = os.path.join(root, d, 'person.yaml')
        # only the cards that carry story prose are parsed
        if os.path.exists(f) and 'story_prose:' in (t := open(f, encoding='utf-8').read()): yield f, yaml.safe_load(t)

class Dumper(yaml.SafeDumper): pass
# every string single-quoted, as the cards write their prose, so {placeholders} and colons read back as text
Dumper.add_representer(str, lambda d, v: d.represent_scalar('tag:yaml.org,2002:str', v, style="'"))

for lang, how in (config['i18n'].get('convert') or {}).items():
    cc = opencc.OpenCC(how['opencc'])
    if stale:
        # the texts at the same place in the source card and in the catalogue of the language, compared after conversion
        cat = (yaml.safe_load(open(os.path.join(CARDS, 'text', lang, 'catalog_stories.yaml'), encoding='utf-8')) or {}).get('catalog') or {}
        cut = config['i18n']['stale_ratio']
        def walk(src, got, at):
            if isinstance(src, str) and isinstance(got, str):
                r = difflib.SequenceMatcher(None, got, convert(src, cc, how.get('fix') or {})).ratio()
                if r < cut: yield at, r, got, convert(src, cc, how.get('fix') or {})
            elif isinstance(src, dict) and isinstance(got, dict):
                for k in src:
                    if k in got: yield from walk(src[k], got[k], at + '.' + str(k))
            elif isinstance(src, list) and isinstance(got, list):
                for i, (x, y) in enumerate(zip(src, got)): yield from walk(x, y, at + '.' + str(i))
        found = []
        for d in sorted(os.listdir(os.path.join(CARDS, 'people'))):
            f = os.path.join(CARDS, 'people', d, 'person.yaml')
            if not os.path.exists(f): continue
            try: card = yaml.safe_load(open(f, encoding='utf-8'))
            except yaml.YAMLError: continue
            for eid, ev in (card.get('events') or {}).items():
                src = (ev.get('text') or {}).get(how['from'])
                if src and eid in cat: found += [(eid + at, r, old, new) for at, r, old, new in walk(src, cat[eid], '')]
        for at, r, _, _ in found: print(f"{lang}: {at} reads {r:.2f} like the conversion of {how['from']}, the source may have been rewritten")
        if refresh:
            # each old text is replaced where it stands in the file, so the rest of the file keeps its layout; a text found more than once is left
            path = os.path.join(CARDS, 'text', lang, 'catalog_stories.yaml')
            raw = open(path, encoding='utf-8', newline='').read()
            left = []
            for at, _, old, new in found:
                quoted = "'" + old.replace("'", "''") + "'"
                if raw.count(quoted) == 1: raw = raw.replace(quoted, "'" + new.replace("'", "''") + "'")
                elif raw.count(old) == 1 and "'" not in new and '"' not in new and ': ' not in new and not new.startswith(('{', '[', '- ')): raw = raw.replace(old, new)
                else: left.append(at)
            open(path, 'w', encoding='utf-8', newline='').write(raw)
            yaml.safe_load(raw)
            print(f"{lang}: {len(found) - len(left)} texts reconverted" + (f", left as they are: {', '.join(left)}" if left else ''))
            continue
        print(f"{lang}: {len(found)} texts drifted from {how['from']}" + (f"; reconvert them from the source and read them through" if found else ''))
        continue
    if whole:
        folder = os.path.join(CARDS, 'text', lang)
        for name in sorted(os.listdir(folder)):
            if not name.endswith('.yaml'): continue
            f = os.path.join(folder, name)
            old = open(f, encoding='utf-8', newline='').read()
            new = convert(old, cc, how.get('fix') or {})
            if new != old:
                open(f, 'w', encoding='utf-8', newline='').write(new)
                print(f"{lang}: {name} converted, {sum(a != b for a, b in zip(old, new))} characters changed")
    path = os.path.join(CARDS, 'text', lang, 'catalog_stories.yaml')
    raw = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    lines = raw.replace('\r\n', '\n').split('\n')
    carried = (yaml.safe_load(raw) or {}).get('catalog') or {}
    done, skipped = [], []
    for _, card in cards():
        for eid, ev in (card.get('events') or {}).items():
            prose = ((ev.get('text') or {}).get(how['from']) or {}).get('story_prose')
            if prose is None or (wanted and eid not in wanted): continue
            if eid not in carried: skipped.append(eid); continue
            start = lines.index('  ' + eid + ':')
            end = next((i for i in range(start + 1, len(lines)) if lines[i] and not lines[i].startswith('   ')), len(lines))
            # drop an older block: from its key to the next key of the story
            for i in range(start + 1, end):
                if lines[i] == '    story_prose:':
                    stop = next((j for j in range(i + 1, end) if not lines[j].startswith('     ')), end)
                    del lines[i:stop]; end -= stop - i
                    break
            block = yaml.dump({'story_prose': convert(prose, cc, how.get('fix') or {})}, Dumper=Dumper, allow_unicode=True, sort_keys=False, width=100000, default_flow_style=False)
            # keys plain, values quoted
            new = ['    ' + re.sub(r"^(\s*(?:- )?)'([A-Za-z0-9_+]+)':", r'\1\2:', l) for l in block.rstrip('\n').split('\n')]
            # after the plain story, where the Chinese cards keep it
            at = next((i + 1 for i in range(start + 1, end) if lines[i].startswith('    story:')), start + 1)
            lines[at:at] = new
            done.append(eid)
    open(path, 'w', encoding='utf-8', newline='').write(nl.join(lines))
    print(f"{lang}: story prose converted for {len(done)}: {', '.join(done)}")
    if skipped: print(f"{lang}: no card in {os.path.relpath(path, ROOT)}, left out: {', '.join(skipped)}")
