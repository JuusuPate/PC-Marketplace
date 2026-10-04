"""Offline extraction of manufacturer RAM variants, without network or DB writes.

Input: saved G.Skill product-search responses, Patriot sku_sheets arrays, and
a layout-preserving text extraction of the TEAMGROUP VULCAN Z ordering table.
Usage: python scripts/read-memory-variants.py INPUT_DIRECTORY OUTPUT_JSON
"""
import html
import json
import re
import sys
from pathlib import Path


def memory(name, brand, capacity, modules, each, kind, speed, latency, form, sku, source):
    if int(capacity) != int(modules) * int(each):
        raise ValueError(f'Capacity mismatch for {sku}')
    if form not in ('DIMM', 'SO-DIMM') or kind not in ('DDR4', 'DDR5'):
        raise ValueError(f'Unknown memory type for {sku}')
    return dict(category='memory', brand=brand, name=name,
                variant=f'{capacity} GB ({modules} x {each} GB) {kind}-{speed} CL{latency} {form}',
                aliases=sku, specs=dict(capacity=f'{capacity} GB', modules=modules, moduleCapacity=each,
                                       memoryType=kind, speed=speed, latency=latency, moduleFormat=form),
                source_url=source)


def extract_gskill(data, series="Ripjaws V", memory_type="DDR4"):
    markup = data['html'].replace('\\"', '"').replace('\\/', '/')
    cards = re.findall(r'href="(/product/[^"]+)".*?<p class="sub-title">(.*?)</p>', markup, re.S)
    if not cards:
        raise ValueError('No product cards found')
    for url, subtitle in cards:
        text = html.unescape(re.sub('<[^>]*>', ' ', subtitle))
        kind, speed = re.search(r'(DDR[45])-(\d+)', text).groups()
        latency = re.search(r'CL(\d+)', text)[1]
        capacity, modules, each = re.search(r'(\d+)GB\s*\((\d+)x(\d+)GB\)', text).groups()
        if not text.strip().startswith(series + ' ') or kind != memory_type:
            raise ValueError('Unexpected series')
        yield memory(series, 'G.Skill', capacity, modules, each, kind, speed, latency, 'DIMM',
                     url.rsplit('/',1)[1], 'https://www.gskill.com' + url)


def extract_patriot(rows, series, kind):
    for row in rows:
        if row.get('isActive') is not True:
            continue
        capacity, modules, each = re.fullmatch(r'(\d+)GB\s*\((\d+)x(\d+)GB\)', row['capacity']).groups()
        speed = re.fullmatch(r'(\d+)MT/s', row['frequency'].strip())[1]
        latency = re.fullmatch(r'\d+', row['cl'])[0]
        # The public sku_sheets list incorrectly uses the base CL40 for this kit.
        # Its linked manufacturer PDF specifies tested 5600 MT/s CL38 (XMP/EXPO).
        if row['partNumber'] == 'PVV564G56C38K':
            latency = '38'
        group = row['grouping']
        if group not in ('UDIMM', 'SODIMM', 'Non-RGB Kits', 'Non-RGB Single', 'RGB Kits', 'RGB Single'):
            raise ValueError(f'Unknown grouping: {group}')
        name = series + (' RGB' if group.startswith('RGB ') else '')
        form = 'SO-DIMM' if group == 'SODIMM' else 'DIMM'
        yield memory(name, 'Patriot', capacity, modules, each, kind, speed, latency, form,
                     row['partNumber'], row['file']['url'])


def extract_teamgroup(text):
    source = 'https://images.teamgroupinc.com/products/memory/u-dimm/ddr4/vulcan-z/spec-sheet/vulcan-z-en.pdf'
    for line in text.splitlines():
        if 'TLZ' not in line:
            continue
        row = re.search(r'(\d+)GB(?:X(\d+))?\s+(TLZ(?:RD|GD)4(\d+)G(\d+)HC(\d+)[A-Z0-9]+)', line)
        if not row:
            raise ValueError(f'Unrecognized TEAMGROUP ordering row: {line}')
        each, modules, sku, capacity, speed, latency = row.groups()
        modules = modules or '1'
        # Only actual ordering-table rows are emitted; never a capacity/speed cross product.
        if f'DDR4-{speed}' not in text or f'CL{latency}-' not in text:
            raise ValueError(f'Missing technical column for {sku}')
        yield memory('T-FORCE VULCAN Z', 'TeamGroup', capacity, modules, each, 'DDR4',
                     speed, latency, 'DIMM', sku, source)


def main():
    directory = Path(sys.argv[1])
    models = {}
    def collect(rows):
        for row in rows:
            key = (row['brand'], row['name'], row['variant'])
            if key in models:
                if row['aliases'] not in models[key]['aliases'].split(' '):
                    models[key]['aliases'] += ' ' + row['aliases']
            else:
                models[key] = row
    for pattern, series, kind in [('gskill-ripjaws-*.json', 'Ripjaws V', 'DDR4'),
                                  ('gskill-flare-*.json', 'Flare X5', 'DDR5'),
                                  ('gskill-neo-*.json', 'Trident Z5 Neo RGB', 'DDR5')]:
        for path in sorted(directory.glob(pattern)):
            collect(extract_gskill(json.loads(path.read_text(encoding='utf-8')), series, kind))
    for filename, series, kind in [('patriot-steel.json','Viper Steel','DDR4'),
                                   ('patriot-elite2.json','Viper Elite II','DDR4'),
                                   ('patriot-venom.json','Viper Venom','DDR5')]:
        path = directory / filename
        if path.exists():
            collect(extract_patriot(json.loads(path.read_text(encoding='utf-8')), series, kind))
    path = directory / 'teamgroup-vulcan.txt'
    if path.exists():
        collect(extract_teamgroup(path.read_text(encoding='utf-8')))
    if not models:
        raise ValueError('No supported manufacturer input found')
    if any(len(row['aliases'])>500 for row in models.values()):
        raise ValueError('Alias limit exceeded')
    Path(sys.argv[2]).write_text(json.dumps(list(models.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Extracted {len(models)} actual RAM configurations.')


if __name__ == '__main__':
    main()
