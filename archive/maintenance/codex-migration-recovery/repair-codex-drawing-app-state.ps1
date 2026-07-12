$ErrorActionPreference = "Stop"

$Target = "D:\projects\Drawing-app"
$OldPaths = @(
    "C:\Users\Admin\Desktop\Drawing-app",
    "\\?\C:\Users\Admin\Desktop\Drawing-app",
    "D:\projects\Drawing-app",
    "\\?\D:\projects\Drawing-app",
    "D:\projects\drawing-app",
    "\\?\D:\projects\drawing-app"
)

$CodexHome = Join-Path $env:USERPROFILE ".codex"

foreach ($Name in @(".codex-global-state.json", ".codex-global-state.json.bak")) {
    $Path = Join-Path $CodexHome $Name
    if (-not (Test-Path -LiteralPath $Path)) { continue }

    $State = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    foreach ($Key in @("electron-saved-workspace-roots", "project-order", "active-workspace-roots")) {
        $Values = @($State.$Key)
        $Values = $Values | ForEach-Object {
            if ($OldPaths -contains $_) { $Target } else { $_ }
        } | Select-Object -Unique

        if ($Values -notcontains $Target) { $Values = @($Values) + $Target }
        if ($Key -eq "active-workspace-roots") { $Values = @($Target) }

        $State.$Key = @($Values)
    }

    $Json = $State | ConvertTo-Json -Depth 100 -Compress
    Set-Content -LiteralPath $Path -Value $Json -NoNewline
    Write-Host "Updated $Path"
}

$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) {
    Write-Warning "Python was not found, so SQLite thread rows were not updated."
    exit 0
}

$Script = @'
import sqlite3
from pathlib import Path

old_paths = [
    r"C:\Users\Admin\Desktop\Drawing-app",
    r"\\?\C:\Users\Admin\Desktop\Drawing-app",
    r"D:\projects\Drawing-app",
    r"\\?\D:\projects\Drawing-app",
    r"D:\projects\drawing-app",
    r"\\?\D:\projects\drawing-app",
]
target = r"D:\projects\Drawing-app"

for db in [Path.home()/".codex/state_5.sqlite", Path.home()/".codex/sqlite/state_5.sqlite"]:
    if not db.exists():
        continue
    con = sqlite3.connect(db)
    cur = con.cursor()
    marks = ",".join("?" for _ in old_paths)
    cur.execute(f"update threads set cwd=? where cwd in ({marks})", [target, *old_paths])
    cur.execute("update threads set cwd=? where lower(cwd) like '%drawing-app'", (target,))
    con.commit()
    con.execute("pragma wal_checkpoint(truncate)")
    con.execute("vacuum")
    con.close()
    print(f"Updated {db}")
'@

$Script | python -
