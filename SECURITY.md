# Security Policy

## Supported versions

This project is in active development against `main`. Only the latest commit on `main` receives security fixes; there are no LTS branches.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Please report suspected vulnerabilities privately via [GitHub's "Report a vulnerability" flow](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository. Include:

- a description of the issue and its impact,
- minimal reproduction steps or a proof-of-concept,
- the commit SHA or release you tested against,
- any suggested mitigation.

Acknowledgement is sent within **3 business days**. A triage decision (accept / decline / need-more-info) follows within **10 business days**. Coordinated disclosure timelines are negotiated case by case; the default embargo is **90 days** from initial report.

## Scope

In scope:

- The toolkit code under [ai-tools/](ai-tools/), [scripts/](scripts/), [mcp-server.ts](mcp-server.ts), [cli.ts](cli.ts).
- CI workflows under [.github/workflows/](.github/workflows/).
- The pre-commit / pre-push hooks under [.husky/](.husky/).

Out of scope:

- Vulnerabilities in upstream dependencies — please report to the dependency's maintainer. Dependabot tracks updates here.
- The third-party site under test (e.g. cal.com) — report directly to that vendor.
- Issues that require an attacker to already control the developer's machine, GitHub account, or CI runner.

## Hardening already in place

- **Secret scanning (defense in depth):**
  - pre-commit: regex scanner ([scripts/check-secrets.ts](scripts/check-secrets.ts)) plus optional gitleaks if installed.
  - CI: `gitleaks/gitleaks-action@v2` on every push and PR with full history.
- **Dependency hygiene:** Dependabot for npm + GitHub Actions, weekly cadence ([.github/dependabot.yml](.github/dependabot.yml)).
- **Static analysis:** CodeQL on every push, PR, and weekly schedule ([.github/workflows/codeql.yml](.github/workflows/codeql.yml)).
- **Strict TS + lint + format gates** in CI block obviously dangerous regressions.
- **No secrets in test fixtures.** `GROQ_API_KEY` is consumed lazily; tests that don't touch the LLM run without it.
- **Untrusted-input wrapping:** AI-tool inputs are passed through `wrapUntrusted()` in [ai-tools/tool-utils.ts](ai-tools/tool-utils.ts) before being placed into prompts.

## If a leak ships to git history

1. **Rotate the credential immediately** at the issuer (Groq, OpenAI, etc.).
2. Open a private security advisory on this repo.
3. Maintainers will rewrite history (`git filter-repo`) and force-push, then notify forks.
4. Do not attempt history rewrites on a fork without coordination — it makes triage harder.
