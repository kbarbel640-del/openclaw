import xml.etree.ElementTree as ET

import re
with open(r'D:\openclaw\workspace\pet_stockitems_full.xml', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'&#x[0-9a-fA-F];', '', content)
root = ET.fromstring(content)
tree = None  # not needed
items = root.findall('.//STOCKITEM')
print(f"Total stock items: {len(items)}")

# Sales items from PAVISHA POLYMERS PDF
sales_items = [
    "40gm PET Bottle Blowing Charge",
    "47gm. 1lt. Pet Bottle",
    "45gm. Pet Bottle+Flip Top Cap",
    "30gm. 1lt. Round PET Jar",
    "34gm. 700ml. PET Jar",
    "34gm. 500ml. Pet Bottle",
    "75gm. 5lt PET Jar",
    "18.5gm. PET Jar",
    "95gm. 7lt. PET Jar",
    "84gm Pet Jar Printed",
    "Pavisha Primium1000ml",
    "55Gm. Pet Bottle 1lt Premium",
    "430ml Premium Jar",
    "26gm. 200ml. PET Botlle",
    "34gm. 340ml. PET Bottle",
    "Pavisha Shrink Leaf1000ml PET Bottle",
    "Pavisha Premium500ml.",
    "Bottle Blowing Charge",
    "Jar Blowling Charges",
    "34gm 340ml Pet Jar Set",
    "45gm. PET Bottle",
    "44gm 900ml PET Jar Set VF",
    "20gm EOE Pet Jar Set 190ml",
    "34gm 430ml EOE Jar Set",
    "Pavisha Shink Rap 1000ml 6pc Set",
    "Pavisha Shrink Rap 500ml",
    "80gm Premium PET Bottle",
    "28gm.38mm.500ml.PET Bottle with Cap",
    "45gm.1lt. Bottle+ DC Cap",
    "34gm Printed PET Jar",
]

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
        print(f"\n{'='*60}")
        print(f"ITEM: {name}")
        match = "YES" if name in sales_items else "no"
        print(f"In Polymers sales: {match}")
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
