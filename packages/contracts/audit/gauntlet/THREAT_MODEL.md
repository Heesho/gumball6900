# Threat model

Assume an arbitrary public caller can order transactions, supply caller-controlled arrays and receivers, prefund
predictable addresses, call public deployers, donate tokens, choose exact boundary timestamps, use contract wallets,
and deploy callback-capable or behavior-changing tokens wherever the supported-token boundary permits.

Assume miners, signalers, buyers, keepers, governance, launch authority, pending owners, and unrelated MEV actors can be
distinct and mutually hostile. Consider malicious-but-structurally-consistent Router graphs and counterfeit dependency
getters. A compromised authorized governance owner is a trust risk, but authority beyond the documented surface is a
privilege flaw.

Primary impacts are theft or dilution, insolvency, unauthorized mint/burn or redirection, permanent or selective loss
of exitability, stuck canonical funds, deployment capture, atomic-launch corruption, governance/setup capture,
accounting drift, and economically exploitable ordering or rounding.

Unsupported fee-on-transfer, rebasing, or mutable-blocklist assets are tested for containment, not silently promoted to
supported assets. No website, SDK, subgraph, keeper, Router, or governance action may be a correctness dependency for a
bounded onchain user exit.
