# Security Policy

## Supported Versions

During the v0.x phase, security reports are accepted for the latest published minor version.

## Reporting a Vulnerability

Please do not open public issues for security problems. Use GitHub Security Advisories when the repository is published, or contact the maintainer through the private channel listed in the repository profile.

## Response Timeline

- Confirmation: best effort within 72 hours.
- Initial assessment: best effort within 7 days.
- High-severity fixes: target within 14 days when practical.
- Other fixes: target within 30 days when practical.

This project may be maintained by a small team or individual maintainers, so timelines are best effort.

## Security Scope

Examples of in-scope issues:

- Sanitizer bypasses that defeat the documented default policy.
- CSP injection or bridge injection failures.
- External-link protocol validation bypasses.
- Sandbox configuration mistakes in the default renderer.
- Bridge behavior that lets untrusted HTML attack the host page.

## Out of Scope

- CPU exhaustion, infinite loops, or mining inside the sandbox.
- Phishing content rendered as normal HTML.
- Browser, Electron, or operating-system sandbox vulnerabilities.
- Issues that require intentionally unsafe custom policy overrides.
- Self-XSS and attacks requiring users to paste trusted secrets into untrusted content.

## Credit

Reporters may be credited in advisories and release notes unless they request anonymity.
