import urllib.request

# Export full details of Manufacturing Journal #36 (MASTERID 10070)
xml = '''<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VchDetail</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA POLYMERS</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20250701</SVFROMDATE>
<SVTODATE>20250701</SVTODATE>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="VchDetail" ISMODIFY="No">
<TYPE>Voucher</TYPE>
<FILTER>VchFilter</FILTER>
<FETCH>*</FETCH>
</COLLECTION>
<SYSTEM TYPE="Formulae" NAME="VchFilter">$MASTERID = 10070</SYSTEM>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>'''

req = urllib.request.Request('http://localhost:9000', data=xml.encode('utf-8'), method='POST')
req.add_header('Content-Type', 'text/xml; charset=utf-8')
resp = urllib.request.urlopen(req, timeout=30)
data = resp.read().decode('utf-8')
with open('D:\\openclaw\\workspace\\vch36_detail.xml', 'w', encoding='utf-8') as f:
    f.write(data)
print(f"Saved {len(data)} bytes")
# Print key sections
import re
for tag in ['STOCKITEMNAME', 'RATE', 'AMOUNT', 'ACTUALQTY']:
    matches = re.findall(f'<{tag}[^>]*>([^<]+)</{tag}>', data)
    if matches:
        print(f"\n{tag}:")
        for m in matches:
            print(f"  {m}")
