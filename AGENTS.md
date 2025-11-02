# Repository Guidelines

## Project Structure & Module Organization
- `index.html` holds base markup and bootstraps front-end assets; keep global layout updates here.
- `style.css` centralizes shared styling; group new sections under a comment banner and prefer utility classes over inline styles.
- `script.js` contains the interactive logic; organize code by feature modules and leave top-level wiring near the bottom.
- `waa.py` provides supporting Python helpers; add reusable routines here rather than embedding Python snippets in HTML.
- Store new media under `assets/` (create the folder if absent) and colocate feature-specific notes in `docs/feature-name.md`.

## Build, Test, and Development Commands
- `python -m http.server 8000` – serve the site locally for manual QA; the root folder is the document root.
- `python waa.py` – run backend/data preparation helpers; add `--help` flags when introducing new entry points.
- `npx prettier@latest --check index.html script.js style.css` – verify formatting; run with `--write` before submitting.

## Coding Style & Naming Conventions
- JavaScript: 2-space indentation, camelCase for functions/variables, PascalCase for factory wrappers, and suffix async methods with `Async`.
- CSS: keep selectors kebab-case, limit nesting to two levels, and group variables under `:root`.
- Python: 4-space indentation, snake_case functions, CapWords classes; document non-obvious routines with short docstrings.
- Use descriptive filenames such as `feature-name.component.js` and mirror that naming in related styles/tests.

## Testing Guidelines
- Target `tests/` for automated coverage: name browser-focused suites `*.spec.js` and Python suites `test_*.py`.
- Favor lightweight DOM unit tests with `vitest` + `@testing-library/dom`; call `npx vitest run` locally.
- Use `pytest --maxfail=1 --disable-warnings` for Python helpers.
- Aim for meaningful assertions on new logic (roughly 80% coverage on touched files) and document manual scenarios that cannot be automated.

## Commit & Pull Request Guidelines
- Write commits using Conventional Commits (`feat: add data importer`, `fix: guard null state`) and keep bodies under 72 characters per line.
- Reference issue IDs in the first line when available (`feat: add map overlay (#42)`).
- PRs need: concise summary, testing notes (commands + results), screenshots or screen recordings for UI updates, and a checklist of outstanding tasks.
