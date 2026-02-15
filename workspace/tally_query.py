import requests
import xml.etree.ElementTree as ET

def tally_request(body):
    r = requests.post('http://localhost:9000', data=body, headers={'Content-Type': 'text/xml'})
    return r.text

# Get all stock items from PAVISHA PET INDUSTRIES
body = """<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>SIList</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVCURRENTCOMPANY>PAVISHA PET INDUSTRIES</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="SIList"><TYPE>StockItem</TYPE><NATIVEMETHOD>Name, Parent, BaseUnits</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"""

result = tally_request(body)
root = ET.fromstring(result)
items = root.findall('.//STOCKITEM')
print(f"Total stock items in PET Industries: {len(items)}")
for item in items:
    name = item.get('NAME', '')
    if '40gm' in name.lower() or 'bottle' in name.lower() and 'blow' in name.lower():
        print(f"  MATCH: {name}")
        # Print all child elements
        for child in item:
            print(f"    {child.tag}: {child.text}")

# Also search for BOM-related items
print("\n--- All items with 'blow' or 'preform' or 'raw' ---")
for item in items:
    name = item.get('NAME', '')
    if any(kw in name.lower() for kw in ['blow', 'preform', 'raw', 'pet resin', 'granule', 'master']):
        parent = item.find('PARENT')
        unit = item.find('BASEUNITS')
        print(f"  {name} | Parent: {parent.text if parent is not None else 'N/A'} | Unit: {unit.text if unit is not None else 'N/A'}")
