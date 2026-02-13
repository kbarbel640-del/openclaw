param (
    [Parameter(Mandatory=$true)]
    [string]$In,
    [string]$Time,
    [string]$Index,
    [Parameter(Mandatory=$true)]
    [string]$Out
)

# video-frames extraction script (PowerShell Port)

if (-not (Test-Path $In)) {
    Write-Error "Error: File not found: $In"
    exit 1
}

$OutDir = Split-Path -Parent $Out
if ($OutDir -and -not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$ffmpegArgs = @("-hide_banner", "-loglevel", "error", "-y")

if ($Index) {
    $ffmpegArgs += @("-i", $In, "-vf", "select=eq(n\,$Index)", "-vframes", "1", $Out)
} elseif ($Time) {
    $ffmpegArgs += @("-ss", $Time, "-i", $In, "-frames:v", "1", $Out)
} else {
    $ffmpegArgs += @("-i", $In, "-vf", "select=eq(n\,0)", "-vframes", "1", $Out)
}

# Run ffmpeg
& ffmpeg $ffmpegArgs

if (Test-Path $Out) {
    Write-Host $Out
} else {
    Write-Error "FFmpeg failed to extract frame."
    exit 1
}
