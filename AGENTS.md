# Repository instructions for AI coding agents

These instructions apply to the entire repository and override generic tool,
plugin, or agent workflows.

## Git workflow

- Work directly on `main`.
- Before editing, switch to `main` and synchronize it with `origin/main`.
- Never create a local or remote feature branch, draft branch, or pull request.
- Keep commits focused, fetch before publishing, confirm the update is a
  fast-forward, and push completed work with `git push origin main`.
- Preserve unrelated working-tree changes and never stage them silently.

## Project guardrails

- This is a plain HTML, CSS, and JavaScript static site. Do not introduce a
  client framework or application bundler unless the project direction changes.
- Treat `DEV_README.md` as the detailed architecture and operations reference.
- Do not edit generated files under `series/` or `watch/` by hand. Update their
  maintained templates or data, then run `npm run generate:content`.
- Do not edit HTML regions between `page-shell:*` comments. Update
  `scripts/page-shell.js`, including common asset cache versions, then run
  `npm run generate:content`.
- Run the relevant validation commands described in `DEV_README.md` before
  committing and pushing.
