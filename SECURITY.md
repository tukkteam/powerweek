# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub: **Security → Report a vulnerability** ([new advisory](https://github.com/tukkteam/powerweek/security/advisories/new)).

Include what you found, how to reproduce it, and the impact you expect. We acknowledge reports within 72 hours, keep you updated, and credit you in the fix unless you prefer otherwise.

## Scope

In scope: this repository and the production deployment (Row Level Security bypasses, authentication or session issues, cross-site scripting, open redirects, leaks of the model key, abuse of the assistant endpoint).

Out of scope: denial of service by volume, findings that need a compromised device, and reports from automated scanners without a demonstrated impact.

## How we protect data

Row Level Security on every table, writes through checked RPCs, a JSON Schema check on every plan, server-only model keys, and per-user rate limits. See [docs/architecture.md](docs/architecture.md#security-model).
