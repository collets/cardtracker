# Security policy

## Supported version

Security fixes are applied to the current `main` branch and the active production
deployment. Older commits and personal forks are not maintained releases.

## Reporting a vulnerability

Report suspected vulnerabilities privately through the repository's GitHub
Security Advisories page. If private vulnerability reporting is unavailable,
contact the repository owner privately and ask for a secure reporting channel.
Do not open a public issue containing an exploit, user information, a database
URL, an authorization header, or any credential.

Include the affected route or component, prerequisites, impact, and the smallest
safe reproduction. Use placeholders for secrets and remove personal data.

The maintainer should acknowledge a report promptly, establish severity and
scope, rotate exposed credentials immediately, and coordinate disclosure only
after affected deployments are remediated.

The implemented application security model, verification commands, and incident
procedure are documented in [Riftwatch security](docs/SECURITY.md).
