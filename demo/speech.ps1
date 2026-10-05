param([string]$VoiceName = 'Microsoft Huihui Desktop')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speechDirectory = Join-Path $PSScriptRoot 'audio'
New-Item -ItemType Directory -Path $speechDirectory -Force | Out-Null
$segments = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$voiceSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voiceSynth.SelectVoice($VoiceName)
$voiceSynth.Rate = 0
$voiceSynth.Volume = 100
foreach ($segment in $segments) {
    $target = Join-Path $speechDirectory ($segment.id + '.wav')
    $voiceSynth.SetOutputToWaveFile($target)
    $voiceSynth.Speak($segment.text)
}
$voiceSynth.Dispose()
Write-Output ('Generated ' + $segments.Count + ' local narration files.')
