import re, xml.etree.ElementTree as ET

with open('D:/openclaw/workspace/poly_bom_real.xml', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', content)
root = ET.fromstring(content)

# Get detailed BOM for specific items
targets = ["47gm. 1lt. Pet Bottle", "45gm. Pet Bottle+Flip Top Cap"]
for item in root.findall('.//STOCKITEM'):
    name = item.get('NAME', '')
    if name not in targets:
        continue
    print(f"\n=== {name} ===")
    for mc in item.findall('.//MULTICOMPONENTLIST.LIST'):
        bom_name = mc.findtext('COMPONENTLISTNAME', '').strip()
        bom_qty = mc.findtext('COMPONENTBASICQTY', '').strip()
        if not bom_name:
            continue
        print(f"  BOM: {bom_name} | Output Qty: {bom_qty}")
        for comp in mc.findall('MULTICOMPONENTITEMLIST.LIST'):
            # Print ALL child elements
            for child in comp:
                print(f"    {child.tag}: {child.text}")
            print()
