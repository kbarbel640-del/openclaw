$body = @'
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VoucherList</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>PAVISHA POLYMERS</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="VoucherList" ISMODIFY="No">
<TYPE>Voucher</TYPE>
<FETCH>DATE, VOUCHERTYPENAME, NARRATION, VOUCHERNUMBER</FETCH>
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>
'@
$r = Invoke-WebRequest -Uri 'http://localhost:9000' -Method Post -Body $body -TimeoutSec 20 -UseBasicParsing
$r.Content | Out-File -FilePath 'D:\openclaw\workspace\poly_vouchers.xml' -Encoding UTF8
Write-Host "Saved. Size: $((Get-Item 'D:\openclaw\workspace\poly_vouchers.xml').Length) bytes"
