$body = @'
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>StockItems</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA POLYMERS</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="StockItems" ISMODIFY="No">
<TYPE>StockItem</TYPE>
<FETCH>NAME, BASEUNITS, PARENT</FETCH>
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>
'@
$r = Invoke-WebRequest -Uri 'http://localhost:9000' -Method Post -Body $body -TimeoutSec 15 -UseBasicParsing
$r.Content | Out-File -FilePath 'D:\openclaw\workspace\poly_items.xml' -Encoding UTF8
Write-Host "Done"
