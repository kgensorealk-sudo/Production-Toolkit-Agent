# tools/checkEncoding.ps1
#
# Guards against source-level mojibake regression (see docs/handover.md,
# Phase 0.1). Scans services/, pages/, components/, contexts/, utils/, and
# root package.json for the specific garbled byte sequences that appear when
# UTF-8 text (curly quotes, em/en dashes, the (c) symbol, etc.) gets
# misread/miswritten as a different single-byte encoding -- e.g. an author's
# curly apostrophe becoming "authorÃ¢â‚¬â„¢s" instead of "author's" or "author's".
#
# This is NOT the same class of issue as the apostrophe-normalization fix in
# productionQaAgent.ts (that was about straight vs curly apostrophes both
# being *valid* UTF-8; this script is about detecting genuinely *broken*
# byte sequences that shouldn't exist in source at all).
#
# Exit code: 0 if clean, 1 if any mojibake pattern is found (for CI / npm
# script / pre-commit hook use).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools/checkEncoding.ps1

$ErrorActionPreference = "Stop"

# Known mojibake fingerprints: UTF-8 bytes for curly quotes/dashes/copyright
# misinterpreted as Windows-1252 and re-saved, producing these specific
# multi-character garbage sequences instead of the original single character.
$patterns = @(
  'â€™',   # U+2019 right single quote (curly apostrophe), mis-encoded
  'â€˜',   # U+2018 left single quote, mis-encoded
  'â€œ',   # U+201C left double quote, mis-encoded
  ('â€'),   # U+201D right double quote, mis-encoded (Windows-1252 0x9D is an unassigned C1 control char; the old '\x9D' escape doesn't exist in PowerShell and never matched anything)
  ('â€”'), # U+2014 em dash, mis-encoded (Windows-1252 0x94 -> U+201D). Was wrongly a straight quote (U+0022) before, identical to the en-dash entry below.
  ('â€“'), # U+2013 en dash, mis-encoded (Windows-1252 0x93 -> U+201C). Was wrongly identical to the em-dash entry above.
  'Â©',    # U+00A9 copyright symbol, mis-encoded
  'Â®',    # U+00AE registered trademark, mis-encoded
  'â€¦'    # U+2026 horizontal ellipsis, mis-encoded
)

$scanDirs = @('services', 'pages', 'components', 'contexts', 'utils')
$scanExtensions = @('*.ts', '*.tsx', '*.json')

$targets = @()
foreach ($dir in $scanDirs) {
  if (Test-Path $dir) {
    foreach ($ext in $scanExtensions) {
      $targets += Get-ChildItem -Path $dir -Recurse -Filter $ext -File -ErrorAction SilentlyContinue
    }
  }
}
if (Test-Path "package.json") {
  $targets += Get-Item "package.json"
}

$violations = @()

foreach ($file in $targets) {
  $content = Get-Content -Raw -Encoding UTF8 -Path $file.FullName -ErrorAction SilentlyContinue
  if ($null -eq $content) { continue }

  foreach ($pattern in $patterns) {
    if ($content.Contains($pattern)) {
      $lineNum = 1
      $lines = $content -split "`n"
      foreach ($line in $lines) {
        if ($line.Contains($pattern)) {
          $violations += [PSCustomObject]@{
            File    = $file.FullName.Replace((Get-Location).Path + '\', '')
            Line    = $lineNum
            Pattern = $pattern
          }
        }
        $lineNum++
      }
    }
  }
}

if ($violations.Count -eq 0) {
  Write-Host "checkEncoding: PASS -- no mojibake patterns found across $($targets.Count) scanned files." -ForegroundColor Green
  exit 0
} else {
  Write-Host "checkEncoding: FAIL -- $($violations.Count) mojibake occurrence(s) found:" -ForegroundColor Red
  foreach ($v in $violations) {
    Write-Host "  $($v.File):$($v.Line) contains pattern [$($v.Pattern)]" -ForegroundColor Red
  }
  exit 1
}
