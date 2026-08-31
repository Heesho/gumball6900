#!/usr/bin/env bash
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$AUDIT_DIR/.." && pwd)"
REPOSITORY_DIR="$(cd "$CONTRACTS_DIR/../.." && pwd)"
REPORT_DIR="$AUDIT_DIR/reports"
source "$AUDIT_DIR/toolchain.lock"

for tool in docker forge jq medusa myth node; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Required nightly audit tool is unavailable: $tool" >&2
        exit 1
    fi
done

mkdir -p "$REPORT_DIR"
status=0
node "$AUDIT_DIR/verify-toolchain.mjs" nightly
if ! "$AUDIT_DIR/run-static.sh"; then
    status=1
fi

if ! node --test \
    "$AUDIT_DIR/check-echidna-results.test.mjs" \
    "$AUDIT_DIR/check-medusa-results.test.mjs" \
    "$AUDIT_DIR/check-fuzzer-wiring.test.mjs" \
    "$AUDIT_DIR/mutation-runner-policy.test.mjs" \
    >"$REPORT_DIR/fuzzer-wiring.txt" 2>&1; then
    status=1
fi

if ! (
    cd "$CONTRACTS_DIR"
    FOUNDRY_PROFILE=integration forge test --match-contract CampaignHarnessTest
) >"$REPORT_DIR/protocol-campaign-smoke.txt" 2>&1; then
    status=1
fi

ECHIDNA_IMAGE="ghcr.io/crytic/echidna/echidna:v$ECHIDNA_VERSION@$ECHIDNA_IMAGE_DIGEST"
ECHIDNA_COVERAGE_DIR="$(mktemp -d "$REPORT_DIR/echidna-nightly-coverage.XXXXXX")"
ECHIDNA_CONTAINER_COVERAGE_DIR="audit/reports/$(basename "$ECHIDNA_COVERAGE_DIR")"
if ! docker run --rm \
    --platform linux/amd64 \
    --pull=never \
    --env FOUNDRY_PROFILE=echidna \
    --volume "$REPOSITORY_DIR:/workspace" \
    --workdir /workspace/packages/contracts \
    "$ECHIDNA_IMAGE" \
    echidna audit/harness/ProtocolStateMachineCampaign.sol \
    --contract ProtocolStateMachineCampaign \
    --config audit/echidna.yaml \
    --coverage-dir "$ECHIDNA_CONTAINER_COVERAGE_DIR" \
    >"$REPORT_DIR/echidna.txt" 2>&1; then
    status=1
fi
ECHIDNA_LCOV_FILE=""
ECHIDNA_LCOV_COUNT=0
for candidate in "$ECHIDNA_COVERAGE_DIR"/covered.*.lcov; do
    if [[ ! -f "$candidate" ]]; then
        continue
    fi
    ECHIDNA_LCOV_FILE="$candidate"
    ECHIDNA_LCOV_COUNT=$((ECHIDNA_LCOV_COUNT + 1))
done
if [[ "$ECHIDNA_LCOV_COUNT" -ne 1 ]]; then
    echo "Expected exactly one fresh Echidna LCOV receipt, observed $ECHIDNA_LCOV_COUNT" >&2
    status=1
elif ! node "$AUDIT_DIR/check-echidna-results.mjs" \
    "$REPORT_DIR/echidna.txt" \
    "$AUDIT_DIR/echidna.yaml" \
    "$AUDIT_DIR/harness/ProtocolStateMachineCampaign.sol" \
    "$ECHIDNA_LCOV_FILE"; then
    status=1
fi

cd "$CONTRACTS_DIR"
if ! FOUNDRY_PROFILE=medusa medusa fuzz \
    --config audit/medusa.json \
    --compilation-target "$CONTRACTS_DIR/audit/harness/ProtocolStateMachineCampaign.sol" \
    --use-slither-force \
    >"$REPORT_DIR/medusa.txt" 2>&1; then
    status=1
fi
if ! node "$AUDIT_DIR/check-medusa-results.mjs" \
    "$REPORT_DIR/medusa.txt" \
    "$AUDIT_DIR/medusa.json" \
    "$AUDIT_DIR/harness/ProtocolStateMachineCampaign.sol" \
    "$REPORT_DIR/medusa-corpus/coverage/lcov.info"; then
    status=1
fi

forge build
if ! node "$AUDIT_DIR/check-mythril-findings.mjs" \
    --run \
    "$AUDIT_DIR/mythril-policy.json" \
    "$CONTRACTS_DIR" \
    "$REPORT_DIR"; then
    status=1
fi

if ! node "$AUDIT_DIR/verify-toolchain.mjs" nightly --artifacts; then
    status=1
fi

exit "$status"
