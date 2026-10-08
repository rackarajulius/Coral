param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$PoolerHost = '',
  [string]$StagingConfigPath = ''
)

$ErrorActionPreference = 'Stop'
function Get-StagingTlsQuery([string]$WorkspaceRoot) {
  $certificateDirectory = [IO.Path]::GetFullPath((Join-Path $WorkspaceRoot '.staging.local'))
  $certificatePath = Join-Path $certificateDirectory 'supabase-staging-ca.crt'
  try { $directory = Get-Item -LiteralPath $certificateDirectory -Force -ErrorAction Stop }
  catch [System.Management.Automation.ItemNotFoundException] { return 'sslmode=require' }
  if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'The staging certificate directory must be an owned directory, without a symbolic link or junction.'
  }
  try { $certificate = Get-Item -LiteralPath $certificatePath -Force -ErrorAction Stop }
  catch [System.Management.Automation.ItemNotFoundException] { return 'sslmode=require' }
  if ($certificate.PSIsContainer -or ($certificate.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'The staging certificate must be a regular file, without a symbolic link or junction.'
  }
  $pem = [IO.File]::ReadAllText($certificatePath)
  if (-not $pem.Contains('-----BEGIN CERTIFICATE-----') -or -not $pem.Contains('-----END CERTIFICATE-----')) {
    throw 'The staging certificate file must contain a PEM certificate.'
  }
  return ('sslmode=verify-full&sslrootcert=' + [Uri]::EscapeDataString($certificatePath))
}

if ($ProjectRef -cnotmatch '^[a-z]{20}$') { throw 'ProjectRef must be twenty lowercase letters.' }
if ($PoolerHost -and $PoolerHost -cnotmatch '^aws-[0-9]+-[a-z]{2}-[a-z]+-[0-9]+\.pooler\.supabase\.com$') {
  throw 'PoolerHost must be the exact Supabase pooler hostname shown in the staging project.'
}

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$staging = [IO.Path]::GetFullPath((Join-Path $workspace 'staging'))
if (-not $StagingConfigPath) { $StagingConfigPath = Join-Path $staging 'backend.env.local' }
$configPath = [IO.Path]::GetFullPath($StagingConfigPath)
if ([IO.Path]::GetDirectoryName($configPath) -ine $staging -or
    [IO.Path]::GetFileName($configPath) -cnotmatch '^backend(?:\.[a-z0-9-]+)?\.env\.local$') {
  throw 'Use a backend staging .env.local file directly inside this workspace staging directory.'
}
foreach ($path in @($staging, $configPath)) {
  $item = Get-Item -LiteralPath $path -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Staging paths must not be symbolic links or junctions.' }
}

$contents = [IO.File]::ReadAllText($configPath)
$newline = if ($contents.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = [Collections.Generic.List[string]]::new()
foreach ($line in ($contents -split '\r?\n')) { $lines.Add($line) }
function Get-StagingValue([string]$name) {
  $matching = @($lines | Where-Object { $_ -cmatch ('^\s*(?:export\s+)?' + $name + '\s*=') })
  if ($matching.Count -ne 1) { throw "Staging configuration needs exactly one $name field." }
  $value = ($matching[0] -creplace ('^\s*(?:export\s+)?' + $name + '\s*=\s*'), '').Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }
  return $value
}
if ((Get-StagingValue 'CORAL_STAGING') -cne 'true') { throw 'CORAL_STAGING must be exactly true.' }
if ((Get-StagingValue 'STAGING_SUPABASE_PROJECT_REF') -cne $ProjectRef) { throw 'The declared staging project does not match ProjectRef.' }
foreach ($name in @('DATABASE_URL', 'DIRECT_URL')) {
  if (@($lines | Where-Object { $_ -cmatch ('^\s*(?:export\s+)?' + $name + '\s*=') }).Count -gt 1) {
    throw "Staging configuration has duplicate $name fields."
  }
}

$tlsQuery = Get-StagingTlsQuery $workspace
$secret = Read-Host 'Enter the Coral Staging database password (input is hidden)' -AsSecureString
$buffer = [IntPtr]::Zero
try {
  $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer)
  if (-not $plainPassword) { throw 'A database password is required.' }
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $dbHost = if ($PoolerHost) { $PoolerHost } else { "db.$ProjectRef.supabase.co" }
  $dbUser = if ($PoolerHost) { "postgres.$ProjectRef" } else { 'postgres' }
  $runtimePort = if ($PoolerHost) { '6543' } else { '5432' }
  $values = @{
    DATABASE_URL = "postgresql://${dbUser}:${encodedPassword}@${dbHost}:${runtimePort}/postgres?${tlsQuery}"
    DIRECT_URL = "postgresql://${dbUser}:${encodedPassword}@${dbHost}:5432/postgres?${tlsQuery}"
  }
  foreach ($name in @('DATABASE_URL', 'DIRECT_URL')) {
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -cmatch ('^\s*(?:export\s+)?' + $name + '\s*=')) {
        $lines[$i] = "$name=$($values[$name])"
        $found = $true
      }
    }
    if (-not $found) { $lines.Add("$name=$($values[$name])") }
  }
  [IO.File]::WriteAllText($configPath, ($lines -join $newline), [Text.UTF8Encoding]::new($false))
  Write-Host 'Updated the two staging database fields. No database connection was made.'
} finally {
  if ($buffer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer) }
  if ($secret) { $secret.Dispose() }
  $plainPassword = $null
  $encodedPassword = $null
  $values = $null
  $contents = $null
  $lines = $null
}
