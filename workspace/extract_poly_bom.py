import xml.etree.ElementTree as ET
import re

with open(r'D:\openclaw\workspace\poly_stockitems_full.xml', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'&#x[0-9a-fA-F];', '', content)
root = ET.fromstring(content)

items = root.findall('.//STOCKITEM')
print(f"Total stock items: {len(items)}")

bom_count = 0
for item in items:
    name = item.get('NAME', '')
    mcl = item.findall('.//MULTICOMPONENTLIST.LIST')
    has_bom = False
    for mc in mcl:
        comp_name = mc.find('COMPONENTLISTNAME')
        if comp_name is not None and comp_name.text and comp_name.text.strip():
            has_bom = True
            break
    
    if has_bom:
        bom_count += 1
        print(f"\n{'='*60}")
        print(f"ITEM: {name}")
        for mc in mcl:
            cl_name = mc.find('COMPONENTLISTNAME')
            cl_qty = mc.find('COMPONENTBASICQTY')
            if cl_name is not None and cl_name.text and cl_name.text.strip():
                print(f"  BOM: {cl_name.text.strip()} | Qty: {cl_qty.text.strip() if cl_qty is not None else 'N/A'}")
                for comp in mc.findall('MULTICOMPONENTITEMLIST.LIST'):
                    sname = comp.find('STOCKITEMNAME')
                    nature = comp.find('NATUREOFITEM')
                    qty = comp.find('ACTUALQTY')
                    print(f"    -> {nature.text if nature is not None else '?'}: {sname.text if sname is not None else '?'} | Qty: {qty.text.strip() if qty is not None else 'N/A'}")

print(f"\n\nTotal items with BOM: {bom_count}")
