#!/usr/bin/env python3
"""Builds backend/src/main/resources/discussion-seed.json (anonymous, imported compensation posts) from
scripts/data/india_sde_salaries_by_level.csv. DiscussionSeed loads the JSON into the discussions table at startup, one post per company (the key is derived from the company name).

    python3 scripts/gen-india-comp-seed.py
"""
import csv, json, re, pathlib

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

# One post per company: every level it reports, lowest pay first. DiscussionSeed derives each post's key from the company name.
by_company = {}
for r in rows:
    by_company.setdefault(r['Company'].strip(), []).append(r)

out = []
for company, rs in by_company.items():
    rs = sorted(rs, key=lambda r: float(r['Median total comp (INR)']))
    lines = [f'**Company:** {company}']
    seg = next((r['Segment'].strip() for r in rs if r['Segment'].strip()), '')
    if seg: lines.append(f'**Segment:** {seg}')
    lines.append('**Location:** India')
    comp = []
    for r in rs:
        level, norm, lpa = r['Company level'].strip(), r['Normalised level'].strip(), r['Median total comp (LPA)'].strip()
        yoe = r['Typical YOE'].strip()
        if yoe and 'year' not in yoe: yoe += ' years'
        if norm.startswith('All levels'):
            comp.append(f'- **All levels** (company median): ₹{lpa} LPA')
        else:
            detail = ', '.join(x for x in (norm, yoe) if x)
            comp.append(f'- **{level}** ({detail}): ₹{lpa} LPA')
    med = next((r['Company median TC (LPA)'].strip() for r in rs if r['Company median TC (LPA)'].strip()), '')
    if med and len(rs) > 1: comp.append(f'- Company median across levels: ₹{med} LPA')
    lo, hi = rs[0]['Median total comp (LPA)'].strip(), rs[-1]['Median total comp (LPA)'].strip()
    span = f'₹{lo} LPA' if lo == hi else f'₹{lo} – ₹{hi} LPA'
    body = '\n'.join(lines) + '\n\n**Compensation**\n' + '\n'.join(comp)
    out.append(dict(category='compensation', company=clip(company, 120), role='Software Engineer', level='', yoe='',
                    ctc=span, title=clip(f'{company} | India | {span}', 200), body=body))

(ROOT / 'backend/src/main/resources/discussion-seed.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(out), 'posts (one per company),', sum(len(v) for v in by_company.values()), 'levels in total')
