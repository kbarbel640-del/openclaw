param (
    [Parameter(Mandatory=$true, Position=0)]
    [string]$AudioFile,
    [string]$Language,
    [switch]$Timestamps,
    [switch]$Json,
    [switch]$Quiet
)

$VenvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$TranscribePy = Join-Path $PSScriptRoot "transcribe.py"

if (-not (Test-Path $VenvPython)) {
    Write-Error "Error: Python executable not found at $VenvPython. Please run setup first: cd $(Join-Path $PSScriptRoot "..") && uv venv .venv --python 3.12 && uv pip install --python .venv/Scripts/python.exe openai-whisper torch --index-url https://download.pytorch.org/whl/cpu"
    exit 1
}

$Args = @($TranscribePy, $AudioFile)

if ($Language) {
    $Args += @("--language", $Language)
}
if ($Timestamps) {
    $Args += "--timestamps"
}
if ($Json) {
    $Args += "--json"
}
if ($Quiet) {
    $Args += "--quiet"
}

# Run python
& $VenvPython $Args
