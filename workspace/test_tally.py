import sys
print("Starting...", flush=True)
try:
    import requests
    print("requests imported", flush=True)
    r = requests.post('http://localhost:9000', data=b'<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CL</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="CL"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>', headers={'Content-Type': 'text/xml'}, timeout=10)
    print(f"Status: {r.status_code}", flush=True)
    print(r.text[:500], flush=True)
except Exception as e:
    print(f"Error: {e}", flush=True)
    import traceback
    traceback.print_exc()
