#!/usr/bin/env python3
"""Builds backend/src/main/resources/company-salaries.json (company, level and median total pay, India) from
scripts/data/india_sde_salaries_by_level.csv. SalarySeed loads it into the company_salaries table at startup.

    python3 scripts/gen-company-salaries.py
"""
import csv, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(ROOT / 'scripts/data/india_sde_salaries_by_level.csv', encoding='utf-8-sig')))
out = []
for r in rows:
    yoe = r['Typical YOE'].strip()
    if yoe and 'year' not in yoe: yoe += ' years'
    all_levels = r['Normalised level'].strip().startswith('All levels')
    out.append(dict(company=r['Company'].strip(), segment=r['Segment'].strip(),
                    level='All levels' if all_levels else r['Company level'].strip(),
                    norm='' if all_levels else r['Normalised level'].strip(), yoe=yoe,
                    inr=int(float(r['Median total comp (INR)'])), lpa=r['Median total comp (LPA)'].strip(),
                    median=r['Company median TC (LPA)'].strip()))
(ROOT / 'backend/src/main/resources/company-salaries.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(out), 'rows,', len({o['company'] for o in out}), 'companies')
