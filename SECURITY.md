# Security policy

GUM BALL 6900 is pre-release software. No production deployment or released version is currently supported, and this
repository does not offer a bug bounty or promise a response time.

## Private vulnerability reporting

GitHub private vulnerability reporting on the canonical repository is the intended disclosure channel.

Private reporting endpoint: [Open a private vulnerability report](https://github.com/heesho/gumball6900/security/advisories/new)

Do not open a public issue, discussion, pull request, or social-media post containing an unpatched vulnerability. The
repository owner must still enable and test the private reporting feature, assign a monitored security contact, and
archive evidence of the end-to-end response path before release.

Until the private channel is operational, a reporter should use only an already-established private channel with the
person or organization that granted them repository access. This file intentionally does not invent an email address,
account, or security owner.

## Blocking release gate

Public release, production deployment, and mainnet launch are blocked until all of the following are complete:

- GitHub private vulnerability reporting is enabled on the selected canonical repository;
- a monitored security contact or response team is assigned and published;
- maintainers successfully test the private report workflow, including acknowledgment and restricted coordination;
- supported versions, response expectations, disclosure handling, and any bounty terms are approved and documented.

Enabling the GitHub feature alone does not satisfy this gate without a monitored contact and a tested response path.

## Report contents

Once the private channel is available, reports should include the affected commit or deployment, impacted component,
reproduction steps or a proof of concept, security and economic impact, and any known mitigation. Avoid accessing other
users' data, moving real assets, degrading shared infrastructure, or publishing exploit details before a coordinated
fix is available.
