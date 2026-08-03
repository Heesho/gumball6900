# Archived contract analyzer tooling

The analyzer runners, policies, dispositions, and state-machine harnesses in this directory were built for the
superseded contract graph. Several still name contracts and deployment scripts removed by the minimal rebuild. Their
package-script and CI entrypoints have been removed so they cannot be mistaken for current security evidence.

Do not run, refresh, or cite these files as analysis of the current 14-contract architecture. Current engineering
checks are the configured Foundry and Hardhat suites, `forge build --sizes`, ABI synchronization, and the repository
gates documented in the root README. A new external-analysis campaign requires a fresh target inventory, policies,
dispositions, and reviewed results. Local success would remain engineering evidence, not an audit or release approval.

Raw output remains confined to `audit/reports/`; retained historical files do not authorize deployment or user funds.
