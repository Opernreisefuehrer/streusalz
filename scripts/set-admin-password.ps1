$ErrorActionPreference = 'Stop'
$previousEncoding = $OutputEncoding
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    Write-Host 'ADMIN-PASSWORT SETZEN'
    Write-Host 'Die Eingabe bleibt verborgen. Das neue Passwort wird direkt fuer den Live-Shop eingerichtet.'
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    do {
        $password = Read-Host 'Neues Passwort (14 bis 256 Zeichen)' -AsSecureString
        $confirmation = Read-Host 'Passwort wiederholen' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        $confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            $confirmed = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)
            $valid = $password.Length -ge 14 -and $password.Length -le 256 -and $plain -ceq $confirmed
            if ($valid) {
                $hash = $plain | node scripts\password.mjs --stdin
                if ($LASTEXITCODE -ne 0 -or $hash -notmatch '^[a-f0-9]{32}:[a-f0-9]{128}$') {
                    throw 'Der Passwort-Hash konnte nicht erzeugt werden. Vercel wurde nicht geaendert.'
                }
            } else {
                Write-Host 'Bitte 14 bis 256 Zeichen verwenden und beide Male genau dasselbe Passwort eingeben.'
            }
        } finally {
            $plain = $null
            $confirmed = $null
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer)
            $password.Dispose()
            $confirmation.Dispose()
        }
    } while (-not $valid)

    $hash | npx --yes vercel env add ADMIN_PASSWORD_HASH --environment production --project streusalz --sensitive --force --yes
    if ($LASTEXITCODE -ne 0) { throw 'Der Passwort-Hash konnte nicht in Vercel hinterlegt werden.' }
    $hash = $null
    Write-Host 'Hash gespeichert. Der Live-Shop wird mit der neuen Konfiguration bereitgestellt.'
    npx --yes vercel redeploy streusalz.vercel.app --environment production
    if ($LASTEXITCODE -ne 0) {
        throw 'Der Hash ist gespeichert, aber die Bereitstellung ist fehlgeschlagen. Vor dem Login die Production-Bereitstellung in Vercel erneut starten.'
    }
    Write-Host 'Fertig. Melde dich auf https://www.streusalz-grosshandel.de/admin mit deinem selbst gewaehlten Passwort an.'
} finally {
    $hash = $null
    $OutputEncoding = $previousEncoding
    Pop-Location
}
