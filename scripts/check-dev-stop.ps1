# Windows check for task 37d: after `pnpm dev` is stopped with Ctrl+C, no sandbox agent or engine
# process is left running. Runs the Go part of `pnpm dev` (turbo's dev task for both apps, in both
# turbo UIs) in its own console on spare ports, so a running `pnpm dev` is not disturbed.
#   powershell -NoProfile -File scripts/check-dev-stop.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$ports = @{ SANDBOX_AGENT_HEALTH_ADDR = "127.0.0.1:18081"; SANDBOX_AGENT_GRPC_ADDR = "127.0.0.1:19443"; SANDBOX_ENGINE_HTTP_ADDR = "127.0.0.1:18080" }
$healthUrls = @("http://127.0.0.1:18081/health", "http://127.0.0.1:18080/health")
$startTimeoutSeconds = 150
$stopWaitSeconds = 15
$filters = @("--filter=@greenbuild/sandbox-agent", "--filter=@greenbuild/sandbox-engine")

# Sends Ctrl+C to every process in the console of $ConsolePid, as pressing it in that window does.
$sendCtrlC = @'
param([int]$ConsolePid)
Add-Type -Namespace Win32 -Name Console -MemberDefinition @"
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("kernel32.dll")] public static extern bool AttachConsole(uint processId);
[DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(System.IntPtr handler, bool add);
[DllImport("kernel32.dll")] public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint group);
"@
[Win32.Console]::FreeConsole() | Out-Null
if (-not [Win32.Console]::AttachConsole($ConsolePid)) { exit 1 }
[Win32.Console]::SetConsoleCtrlHandler([System.IntPtr]::Zero, $true) | Out-Null
[Win32.Console]::GenerateConsoleCtrlEvent(0, 0) | Out-Null
'@

function Test-Healthy {
  foreach ($url in $healthUrls) {
    try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null } catch { return $false }
  }
  return $true
}

function Get-GoApps([datetime]$Since) {
  Get-CimInstance Win32_Process | Where-Object { $_.Name -in @("sandbox-agent.exe", "sandbox-engine.exe") -and $_.CreationDate -ge $Since }
}

function Test-Stop([string]$Ui) {
  $since = Get-Date
  $envs = ($ports.GetEnumerator() | ForEach-Object { "set $($_.Key)=$($_.Value)&&" }) -join " "
  $command = "$envs pnpm exec turbo run dev --env-mode=loose --ui=$Ui $($filters -join " ")"
  $console = Start-Process cmd.exe -ArgumentList "/c", $command -WorkingDirectory $repo -WindowStyle Minimized -PassThru
  $deadline = $since.AddSeconds($startTimeoutSeconds)
  while (-not (Test-Healthy)) {
    if ((Get-Date) -gt $deadline) { throw "check-dev-stop: agent and engine not healthy within $startTimeoutSeconds s (--ui=$Ui)" }
    Start-Sleep -Seconds 2
  }
  $script = Join-Path $env:TEMP "greenbuild-send-ctrl-c.ps1"
  Set-Content -Path $script -Value $sendCtrlC -Encoding utf8
  powershell -NoProfile -File $script -ConsolePid $console.Id
  Remove-Item $script
  Start-Sleep -Seconds $stopWaitSeconds
  $left = @(Get-GoApps $since)
  $left | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  if ($left.Count -gt 0) { throw "check-dev-stop: --ui=$Ui left running: $(($left | ForEach-Object { "$($_.Name) ($($_.ProcessId))" }) -join ', ')" }
  "ok: --ui=$Ui leaves no agent or engine running"
}

foreach ($url in $healthUrls) {
  $answers = try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false }
  if ($answers) { throw "check-dev-stop: $url already answers; stop what holds it first" }
}
& pnpm.cmd exec turbo run build @filters
if ($LASTEXITCODE -ne 0) { throw "check-dev-stop: build failed" }
Test-Stop "stream"
Test-Stop "tui"
