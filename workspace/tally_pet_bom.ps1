# First list companies
$body1 = @'
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="CompanyList" ISMODIFY="No">
<TYPE>Company</TYPE>
<FETCH>NAME</FETCH>
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>
'@
$r1 = Invoke-WebRequest -Uri 'http://localhost:9000' -Method Post -Body $body1 -TimeoutSec 10 -UseBasicParsing
Write-Host "=== COMPANIES ==="
$r1.Content | Select-String 'NAME' | ForEach-Object { $_.Line.Trim() }

# Then fetch BOM items from PET Industries
$body2 = @'
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>BOMCheck</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA PET INDUSTRIES</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="BOMCheck" ISMODIFY="No">
<TYPE>StockItem</TYPE>
<FETCH>NAME, COMPONENTLIST.LIST</FETCH>
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>
'@
$r2 = Invoke-WebRequest -Uri 'http://localhost:9000' -Method Post -Body $body2 -TimeoutSec 20 -UseBasicParsing
$r2.Content | Out-File -FilePath 'D:\openclaw\workspace\pet_bom_check.xml' -Encoding UTF8
$size = (Get-Item 'D:\openclaw\workspace\pet_bom_check.xml').Length
Write-Host "`n=== PET INDUSTRIES BOM export: $size bytes ==="
