# Contributing to html-preview-sandbox

Thanks for your interest in improving this project. It is a security-focused library, so contributions are held to a high bar for correctness and for honesty about what the code actually guarantees.

## Independent Implementation Boundary

This project is an **independent, from-scratch implementation**. It was informed by prior product experience with HTML preview, but it is not a copy of any closed-source project. All contributions must respect these boundaries:

- **Do not copy source code** from any proprietary or third-party project. Implement functionality yourself.
- **Do not import git history** from any other repository.
- **Do not carry over internal artifacts**: internal comments, ticket numbers, internal file paths, internal service names, or internal design-doc references must never appear in this repo.
- Prior work may inform **approach and technique**, never verbatim code.

If you are unsure whether something crosses this line, open an issue before contributing the code.

## Development

```bash
npm install
npm run build          # tsup -> dist/ (tests and examples run against dist/)
npm run check          # type check + Node test suite
npm run test:browser   # Playwright tests on Chromium/Firefox/WebKit (run `npx playwright install --with-deps chromium firefox webkit` first)
```

The local quality gate before opening a PR:

```bash
npm run check && npm run test:browser
```

## Security Changes Require Evidence

Any change to the sanitizer, CSP presets, sandbox tokens, or URL handling must:

1. Add or update regression tests under `test/` and fixtures under `fixtures/`.
2. Keep every security claim in `README.md`, `THREAT_MODEL.md`, and `docs/SECURITY_MODEL.md` **exactly consistent** with the actual `buildCsp` output and sanitizer behavior. Do not describe a protection the code does not provide.
3. Prefer honest, narrow claims over impressive-sounding absolutes. "Blocks attacker-readable exfiltration channels" is acceptable; "zero network" is only true for the `offline` preset.

## Reporting Security Issues

Do **not** open a public issue for a vulnerability. Follow the process in [SECURITY.md](SECURITY.md).

## Pull Requests

- Keep changes focused; unrelated refactors belong in separate PRs.
- Match the existing TypeScript style and module layout.
- Update relevant docs in the same PR as the behavior change.

Branch naming, the PR flow, versioning, and the release process are documented in
[docs/BRANCHING.md](docs/BRANCHING.md).
