#!/usr/bin/env python3
"""Builds backend/src/main/resources/discussion-seed.json (anonymous, imported compensation posts) from
scripts/data/india_sde_salaries_by_level.csv. DiscussionSeed loads the JSON into the discussions table at startup, once per importKey.

    python3 scripts/gen-india-comp-seed.py
"""
import csv, json, re, hashlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(ROOT / 'scripts/data/india_sde_salaries_by_level.csv', encoding='utf-8-sig')))

def inr(n):  # 1263030 -> 12,63,030
    s = str(int(float(n)))
    if len(s) <= 3: return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2: parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return ','.join(parts + [tail])

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def clip(s, n): return s if len(s) <= n else s[:n].rstrip()

out, seen = [], {}
for r in rows:
    company, level, norm = r['Company'].strip(), r['Company level'].strip(), r['Normalised level'].strip()
    all_levels = norm.startswith('All levels')
    total = r['Median total comp (INR)'].strip()
    # LPA from the exact rupee amount, to two decimals, so it always agrees with the figure in brackets (the CSV's own LPA column is rounded to one).
    lpa = ('%.2f' % (float(total) / 100000)).rstrip('0').rstrip('.')
    yoe_txt = r['Typical YOE'].strip()
    if yoe_txt and 'year' not in yoe_txt: yoe_txt += ' years'
    m = re.search(r'\d+', yoe_txt)
    key = 'levelsfyi-in-2026-11-' + slug(company) + '-' + slug(level)
    seen[key] = seen.get(key, 0) + 1
    if seen[key] > 1: key += f'-{seen[key]}'
    if len(key) > 120: key = key[:100] + '-' + hashlib.md5(key.encode()).hexdigest()[:10]
    position = 'Software Engineer (all levels, company median)' if all_levels else f"Software Engineer: {level} ({norm})"
    lines = [f'**Company:** {company}']
    if r['Segment'].strip(): lines.append(f"**Segment:** {r['Segment'].strip()}")
    lines += [f'**Position:** {position}', '**Location:** India']
    if yoe_txt: lines.append(f'**Typical experience:** {yoe_txt}')
    comp = [f'- **Total (per year, median): ₹{lpa} LPA** (₹{inr(total)})']
    if r['Company median TC (LPA)'].strip() and not all_levels:
        comp.append(f"- Company median across levels: ₹{r['Company median TC (LPA)'].strip()} LPA")
    body = '\n'.join(lines) + '\n\n**Compensation**\n' + '\n'.join(comp)
    out.append(dict(importKey=key, category='compensation', company=clip(company, 120), role=clip('All levels' if all_levels else norm, 40),
                    level=clip('All levels' if all_levels else level, 40), yoe=str(int(m.group())) if m else '',
                    ctc=f'₹{lpa} LPA', title=clip(f"{company} | {'All levels' if all_levels else level} | India | ₹{lpa} LPA", 200), body=body))

(ROOT / 'backend/src/main/resources/discussion-seed.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(out), 'posts,', len({o['company'] for o in out}), 'companies,', len({o['importKey'] for o in out}), 'unique keys')
