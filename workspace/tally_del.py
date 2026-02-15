import urllib.request

# Tally delete voucher - needs NAME="voucher number" on the VOUCHER tag
xml = '''<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA POLYMERS</SVCURRENTCOMPANY>
</STATICVARIABLES>
</DESC>
<DATA>
<TALLYMESSAGE>
<VOUCHER NAME="39" VCHTYPE="Manufacturing Journal" ACTION="Delete">
<VOUCHERTYPENAME>Manufacturing Journal</VOUCHERTYPENAME>
<VOUCHERNUMBER>39</VOUCHERNUMBER>
<DATE>20250701</DATE>
</VOUCHER>
</TALLYMESSAGE>
</DATA>
</BODY>
</ENVELOPE>'''

req = urllib.request.Request('http://localhost:9000', data=xml.encode('utf-8'), method='POST')
req.add_header('Content-Type', 'text/xml; charset=utf-8')
resp = urllib.request.urlopen(req, timeout=30)
result = resp.read().decode('utf-8')
print(result)
