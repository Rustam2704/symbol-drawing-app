# Codex Migration Recovery

This folder records the fix for the Drawing-app Codex sidebar issue.

Problem seen on 2026-07-10:
- Codex had the real project at `D:\projects\Drawing-app`.
- Some state still pointed to `C:\Users\Admin\Desktop\Drawing-app`.
- Some thread rows used the Windows extended path form `\\?\D:\projects\Drawing-app`.
- The sidebar treated those as different projects, so `Drawing-app` could show `No chats`.

Canonical project path:

```text
D:\projects\Drawing-app
```

This should be the only Drawing-app project path in Codex state. Do not keep a Desktop copy or Desktop junction for this project.

Run `repair-codex-drawing-app-state.ps1` from PowerShell if the sidebar becomes empty again.
