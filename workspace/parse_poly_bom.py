import re

with open('D:/openclaw/workspace/poly_bom_real.xml', 'r', encoding='utf-8') as f:
    content = f.read()

# Clean invalid XML chars
content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', content)

import xml.etree.ElementTree as ET
root = ET.fromstring(content)

items = root.findall('.//STOCKITEM')
print(f"Total items: {len(items)}")

bom_count = 0
for item in items:
    name = item.get('NAME', '')
    mcl = item.findall('.//MULTICOMPONENTLIST.LIST')
    for mc in mcl:
        bom_name = mc.findtext('COMPONENTLISTNAME', '').strip()
        bom_qty = mc.findtext('COMPONENTBASICQTY', '').strip()
        if not bom_name:
            continue
        bom_count += 1
        components = mc.findall('MULTICOMPONENTITEMLIST.LIST')
        comp_details = []
        for comp in components:
            sname = comp.findtext('STOCKITEMNAME', '').strip()
            sqty = comp.findtext('COMPONENTQTY', '').strip()
            if sname:
                comp_details.append(f"    -> {sname}: {sqty}")
        if comp_details:
            print(f"\n{name} | BOM: {bom_name} ({bom_qty})")
            for c in comp_details:
                print(c)

print(f"\nTotal items with BOM: {bom_count}")
