# Symbol Drawing App

Local browser drawing pad for tracing images and PDF pages. The application runs without a build step and is served by a small Python server.

## Run

```powershell
python server.py
```

Open <http://127.0.0.1:5173>. On Windows, `start-app.bat` starts the same server.

## Verify

```powershell
npm test
```

The command runs the JavaScript unit tests and Python server tests. Browser-level checks should cover loading the library, selecting an image/PDF, crop dialogs, drawing, clear, and undo.

## Architecture

- `app.js` — application state, orchestration, drawing input, and top-level event wiring.
- `modules/history.js` — bounded 20-action history with snapshot sharing.
- `modules/delete-*` — delete-particle data and animation lifecycle.
- `modules/crop-*`, `modules/auto-crop.js`, `modules/image-crop-service.js` — crop geometry, analysis, rendering, and encoding.
- `modules/library-*`, `web/browser-files.js` — server/browser file access, sorting, request cancellation, and DOM rendering.
- `modules/pdf-service.js`, `modules/media-loader.js` — image and PDF decoding.
- `modules/audio-effects.js`, `modules/sprite-animation.js` — effect resources and animations.
- `server.py` — HTTP routes and file-dialog integration.
- `server_library.py` — validated filesystem and image-data helpers.
- `tests/` — JavaScript and Python unit tests.
- `archive/` — files retained for manual review but not used by the running app.

Static HTML, CSS, and JavaScript are served with revalidation enabled so module changes cannot be mixed with stale browser cache entries.
