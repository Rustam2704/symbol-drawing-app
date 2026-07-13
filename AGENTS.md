# Project Codex Instructions

## Exact user requests

- Treat every explicit number, dimension, filename, data type, stage, and separation of responsibilities in the user's request as a hard constraint.
- Do not reinterpret wording into a different implementation. If an exact request cannot be implemented as written, stop before editing, explain the conflict, and ask for confirmation.
- Do not silently combine independent properties. In particular, motion trajectories, spatial assignment, activation delay, dithering, rendering, and source-data recording must remain independent unless the user explicitly asks to combine them.
- Do not invent alternative variants when the user has specified the required output.

## Decision gate

- Before changing a format, schema, field width, resolution, count, algorithm, or file layout, compare the measurable benefit, implementation cost, compatibility cost, and the simplest compliant option.
- If the simplest compliant option has effectively identical output, use it.
- Any proposed deviation from the exact request requires explicit user approval before implementation.
- Never widen a stored field merely to preserve a negligible number of extra entries when reducing the entry count keeps the requested behavior and existing format.

## Verification contract

- Before edits, state a concrete mapping from each user requirement to the planned implementation.
- After edits, verify every requirement against the actual files and report any unmet item plainly.
- Do not claim that a requirement is implemented based only on intention or an unexecuted plan.
- Do not run automated tests unless the user explicitly asks for tests in the current request.

## Current trajectory task

- Preserve the existing runtime DTV asset with exactly 1000 base motion trajectories; the generator has been removed and the asset must not be regenerated unless the user explicitly requests it.
- Keep both the DTV trajectory count and per-pixel trajectory references as `uint16`; do not widen the DTV header.
- Keep 1000 one-pixel-wide activation areas separate from the 1000 trajectory references. Store the area's 0–0.25 second base delay and deterministic per-pixel time shift of plus or minus 0.1 seconds offline. Do not add frame interpolation or other motion changes.
- The browser must not calculate hashes, noise, trajectory assignments, wave delays, or random time shifts.
- Store one precomputed `uint16` value for every pixel in a 1000 x 1000 DPM map: lower 10 bits select one of 1000 trajectories and upper 6 bits store the final precomputed delay code.
- Keep only the active 1000 x 1000 DTV/DPM pair. Do not retain generators, downloaded pi digits, source-frame archives, diagnostic renders, alternate trajectory assets, or the removed JavaScript comparison animation.
- At runtime, compact the precomputed DPM values to opaque pixels, read the requested frame from the precomputed DTV table, and draw it. Runtime calculations are limited to decoding the stored value and locating the requested frame.

## User preference

- Never bring up copyright, licensing, or legal-risk commentary unless the user explicitly asks about it.
