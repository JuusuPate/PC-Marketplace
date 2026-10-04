"""Extract real RAM variants from saved Corsair product JSON; no network or DB writes.

Usage: python scripts/read-corsair-memory.py INPUT_DIRECTORY OUTPUT_JSON
Input files contain productDetail items or their pageProps wrapper from __NEXT_DATA__.
Colours/profile SKU variants sharing the displayed technical identity become aliases.
"""

import json
import re
import sys
from pathlib import Path


def extract(product):
    specs = {item['code']: item['value'] for item in product['tech_specs']}
    capacity_text = specs.get('Capacity', specs.get('Package Contents', ''))
    match = re.fullmatch(r'(\d+)\s*GB\s*\(\s*(\d+)\s*x\s*(\d+)\s*GB\s*\)', capacity_text, re.I)
    if not match:
        raise ValueError(f'Unknown capacity: {capacity_text}')
    capacity, modules, module_capacity = map(int, match.groups())
    if capacity != modules * module_capacity:
        raise ValueError(f"Inconsistent capacity: {product['sku']}")
    module_format = {'UDIMM': 'DIMM', 'DIMM': 'DIMM', 'SODIMM': 'SO-DIMM'}[specs['Package Memory Format']]
    memory_type = specs['Memory Type']
    if memory_type not in ('DDR3', 'DDR3L', 'DDR4', 'DDR5'):
        raise ValueError(f'Unknown memory type: {memory_type}')
    speed = re.fullmatch(r'(\d+)(?:\s*(?:MT/s|MHz))?', str(specs['Tested Speed']))
    latency = re.fullmatch(r'(\d+)(?:-\d+)*', str(specs['Tested Latency']))
    if not speed or not latency:
        raise ValueError(f"Unknown speed/latency: {product['sku']}")
    # Series is manufacturer data, not a generated capacity/speed combination.
    name = re.sub(r'\s+DDR[345]$', '', specs['Memory Series']).replace(' SODIMM', '')
    variant = f'{capacity} GB ({modules} x {module_capacity} GB) {memory_type}-{speed[1]} CL{latency[1]} {module_format}'
    return {
        'category': 'memory', 'brand': 'Corsair', 'name': name, 'variant': variant,
        'aliases': product['sku'],
        'specs': {'capacity': f'{capacity} GB', 'memoryType': memory_type,
                  'modules': str(modules), 'moduleFormat': module_format,
                  'moduleCapacity': str(module_capacity), 'speed': speed[1], 'latency': latency[1]},
        'source_url': f"https://www.corsair.com/us/en/p/memory/{product['sku'].lower()}/{product['url_key']}",
    }


def main():
    models = {}
    for path in sorted(Path(sys.argv[1]).glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict) and 'productData' in data:
            products = data['productData']['productDetail']['items']
        elif isinstance(data, dict) and data.get('__typename') == 'ConfigurableProduct':
            products = [data]
        else:
            continue
        for parent in products:
            for product in [parent] + [v['product'] for v in parent.get('variants', [])]:
                row = extract(product)
                key = (row['name'], row['variant'])
                if key in models:
                    if row['aliases'] not in models[key]['aliases'].split(' '):
                        models[key]['aliases'] += ' ' + row['aliases']
                else:
                    models[key] = row
    if not models:
        raise ValueError('No Corsair products found')
    for row in models.values():
        if len(row['aliases']) > 500:
            raise ValueError(f"Too many aliases: {row['name']} {row['variant']}")
    Path(sys.argv[2]).write_text(json.dumps(list(models.values()), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Extracted {len(models)} verified Corsair memory configurations.')


if __name__ == '__main__':
    main()
