import urllib.request

# First, find all MFG journals with Invoice #43 narration to identify the duplicate
query_xml = '''<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>MfgJournals</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA POLYMERS</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE>20250701</SVFROMDATE>
<SVTODATE>20250701</SVTODATE>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="MfgJournals" ISMODIFY="No">
<TYPE>Voucher</TYPE>
<FILTER>MfgFilter</FILTER>
<FETCH>DATE,NARRATION,GUID,MASTERID,VOUCHERNUMBER</FETCH>
</COLLECTION>
<SYSTEM TYPE="Formulae" NAME="MfgFilter">$VOUCHERTYPENAME = "Manufacturing Journal"</SYSTEM>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>'''

req = urllib.request.Request('http://localhost:9000', data=query_xml.encode('utf-8'), method='POST')
req.add_header('Content-Type', 'text/xml; charset=utf-8')
resp = urllib.request.urlopen(req, timeout=30)
print(resp.read().decode('utf-8'))
