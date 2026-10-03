"""Extract desktop component facts from saved public manufacturer exports.

Usage: python scripts/read-manufacturer-tables.py INPUT_DIRECTORY OUTPUT_JSON
Inputs: amd-cpu.html, amd-gpu.html, nvidia.html, intel.xlsx (sources documented in
docs/catalog-sources.md). Standard library only; no network or database writes.
"""
from pathlib import Path
from html.parser import HTMLParser
import json, re, sys, zipfile, xml.etree.ElementTree as ET


def clean(value):
    return re.sub(r'\s+', ' ', re.sub(r'G\s*eForce\s*', '', str(value or '').replace('™', '').replace('®', '').replace('·', ' '))).strip()


class HardwareHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items, self.rows, self.row, self.cell = [], [], None, None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'data-json' in attrs:
            self.items = json.loads(attrs['data-json']).get('items', [])
        if tag == 'tr': self.row = []
        if tag in ('td', 'th'): self.cell = []
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None: self.row.append(clean(' '.join(self.cell)))
            self.cell = None
        if tag == 'tr' and self.row:
            self.rows.append(self.row)
            self.row = None
    def handle_data(self, value):
        if self.cell is not None: self.cell.append(value)


def collect(root):
    models = {}
    def add(category, brand, name, variant, specs, url, aliases=''):
        item = dict(category=category, brand=brand, name=clean(name), variant=clean(variant), aliases=clean(aliases)[:500], specs={k: clean(v) for k, v in specs.items() if v}, source_url=url)
        assert item['name'] and len(item['name']) <= 120 and len(item['variant']) <= 160
        assert url.startswith('https://')
        models[tuple(item[k].lower() for k in ('category', 'brand', 'name', 'variant'))] = item
    for kind in ('cpu', 'gpu'):
        p = HardwareHTML()
        p.feed((root / f'amd-{kind}.html').read_text(encoding='utf-8'))
        for item in p.items:
            e = {k: v.get('value') for k, v in item['elements'].items()}
            name = re.sub(r'^AMD\s+', '', clean(e['name']))
            url = item.get('productPages', {}).get('en') or f'https://www.amd.com/en/products/specifications/{"processors" if kind == "cpu" else "graphics"}.html'
            if kind == 'cpu':
                sockets = e.get('cpuSocket') or []
                if not sockets or not all(re.match(r'^(AM\d|FM\d|sTR|sWRX)', x) for x in sockets): continue
                if not str(e.get('numOfCpuCores', '')).isdigit(): continue
                series = re.search(r'(Ryzen(?: AI)?(?: Threadripper)?(?: PRO)? [3579]|Ryzen Threadripper(?: PRO)?|Athlon(?: X[24])?|FX|Phenom(?: II)?|Sempron)', name)
                clocks = [f'{float(x)/1000:g}' for x in (e.get('baseClock'), e.get('maxBoostClock')) if x and re.fullmatch(r'\d+(\.\d+)?', str(x))]
                specs = dict(socket=' / '.join(sockets), cores=e['numOfCpuCores'], threads=e.get('numOfThreads'), series=series[0] if series else clean(' '.join(e.get('family') or [])), clock='–'.join(dict.fromkeys(clocks))+' GHz' if clocks else '')
                add('cpu', 'AMD', name, '', specs, url, ' '.join((e.get('productIdBoxed') or [])+(e.get('productIdTray') or [])))
            else:
                if 'Component' not in (e.get('boardType') or []) or not e.get('maxMemorySize'): continue
                memory = str(e['maxMemorySize'])+' GB'
                add('gpu', 'AMD', name, memory, dict(chipVendor='AMD', coreModel=name, vram=memory), url)
    with zipfile.ZipFile(root / 'intel.xlsx') as z:
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(z.read('xl/worksheets/_rels/sheet1.xml.rels'))}
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        links = {x.attrib['ref']: rels.get(x.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'), '') for x in sheet.findall('.//s:hyperlink', ns)}
        for row in sheet.findall('.//s:row', ns):
            cells = {}
            for c in row.findall('s:c', ns):
                value = c.find('s:v', ns)
                if value is not None: cells[c.attrib['r'].rstrip('0123456789')] = strings[int(value.text)] if c.attrib.get('t') == 's' else value.text
            if not cells.get('S', '').startswith('LGA') or not cells.get('F', '').isdigit(): continue
            brand = re.sub(r'^Intel\s*', '', clean(cells['B']))
            tier = cells.get('D', '')
            name = (brand+' '+tier+' '+cells['A']) if 'Ultra' in brand else brand+' '+cells['A']
            clocks = [cells[k] for k in ('K', 'M', 'J') if re.fullmatch(r'\d+(\.\d+)?', cells.get(k, ''))]
            series = brand+' '+tier if tier not in ('N/A', '') else brand
            specs = dict(series=series, socket=re.sub(r'LGA\s*', 'LGA ', cells['S']), cores=cells['F'], threads=cells.get('I', ''), clock='–'.join(dict.fromkeys(clocks))+' GHz' if clocks else '')
            url = links.get('A'+row.attrib['r']) or ''
            if not url.startswith('https://'): url = 'https://www.intel.com/content/www/us/en/support/articles/000005505/processors.html'
            add('cpu', 'Intel', name, '', specs, url, cells['A'])
    p = HardwareHTML()
    p.feed((root / 'nvidia.html').read_text(encoding='utf-8'))
    names = []
    for row in p.rows:
        if len(row) > 2 and all(re.match(r'^(?:RTX|GTX) \d', n) for n in row[1:]): names = row[1:]
        if row and row[0] == 'Standard Memory Config':
            assert len(names) == len(row)-1, (names, row)
            for name, memory in zip(names, row[1:]):
                for gb in dict.fromkeys(re.findall(r'(\d+)\s*GB', memory)):
                    variant = gb+' GB'
                    base_name = re.sub(r' \(\d+ GB\)$', '', name)
                    add('gpu', 'NVIDIA', base_name, variant, dict(chipVendor='NVIDIA', coreModel=base_name, vram=variant), 'https://www.nvidia.com/en-us/geforce/graphics-cards/compare/')
    return sorted(models.values(), key=lambda m: (m['category'], m['brand'], m['name'], m['variant']))


if __name__ == '__main__':
    from collections import Counter
    data = collect(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(dict(Counter((m['category'], m['brand']) for m in data)))
