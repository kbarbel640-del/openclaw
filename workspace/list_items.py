import xml.etree.ElementTree as ET
import re
with open('D:/openclaw/workspace/poly_items.xml', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'&#(\d+);', lambda m: f'&amp;#{m.group(1)};' if int(m.group(1)) > 127 or int(m.group(1)) < 9 else m.group(0), content)
content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', content)
tree = ET.ElementTree(ET.fromstring(content))
items = tree.findall('.//STOCKITEM')
by_group = {}
for item in items:
    name = item.get('NAME','')
    parent = item.findtext('PARENT','')
    by_group.setdefault(parent, []).append(name)

for group in sorted(by_group):
    print(f"\n=== {group} ({len(by_group[group])}) ===")
    for n in sorted(by_group[group]):
        print(f"  {n}")
