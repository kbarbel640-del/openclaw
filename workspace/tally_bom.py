import requests
import xml.etree.ElementTree as ET

URL = 'http://localhost:9000'

def query(xml_body):
    r = requests.post(URL, data=xml_body.encode('utf-8'), headers={'Content-Type': 'text/xml'})
    return r.text

# Step 1: Get all stock items with BOM from PET Industries
xml = """<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>SIList</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVCURRENTCOMPANY>PAVISHA PET INDUSTRIES</SVCURRENTCOMPANY>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="SIList">
<TYPE>StockItem</TYPE>
<NATIVEMETHOD>Name, Parent, BaseUnits, IsBomItem</NATIVEMETHOD>
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>"""

result = query(xml)
root = ET.fromstring(result)
items = root.findall('.//STOCKITEM')
print(f"Total stock items in PET Industries: {len(items)}")

# Find items with BOM
bom_items = []
for item in items:
    name_el = item.get('NAME', '')
    is_bom = item.find('ISBOMITEM')
    if is_bom is not None and is_bom.text and is_bom.text.strip().lower() == 'yes':
        bom_items.append(name_el)
        print(f"  BOM Item: {name_el}")

print(f"\nItems with BOM: {len(bom_items)}")

# Step 2: For items with BOM, get full details including components
for bom_name in bom_items:
    xml2 = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Object</TYPE><ID>{bom_name}</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVCURRENTCOMPANY>PAVISHA PET INDUSTRIES</SVCURRENTCOMPANY>
</STATICVARIABLES>
</DESC></BODY></ENVELOPE>"""
    result2 = query(xml2)
    print(f"\n=== Full export for: {bom_name} ===")
    print(result2[:3000])
