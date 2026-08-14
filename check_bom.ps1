$bytes = [System.IO.File]::ReadAllBytes('c:\Projects\ERP-Traceability-System\.cpanel.yml')
Write-Output ('First 10 bytes (hex): ' + (($bytes[0..9] | ForEach-Object { $_.ToString('X2') }) -join ' '))
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Output 'BOM: PRESENT (UTF-8 BOM detected)'
} else {
    Write-Output 'BOM: none'
}

helloo, cna you hear me , im ijnc alorforni dreaming of what ho we used to be when we 