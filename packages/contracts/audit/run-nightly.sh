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

if ! node --test "$AUDIT_DIR/check-fuzzer-wiring.test.mjs" >"$REPORT_DIR/fuzzer-wiring.txt" 2>&1; then
    status=1
fi

if ! (
    cd "$CONTRACTS_DIR"
    FOUNDRY_TEST=audit/harness forge test --match-contract ProtocolStateMachineCampaignTest
) >"$REPORT_DIR/protocol-campaign-smoke.txt" 2>&1; then
    status=1
fi

ECHIDNA_IMAGE="ghcr.io/crytic/echidna/echidna:v$ECHIDNA_VERSION@$ECHIDNA_IMAGE_DIGEST"
if ! docker run --rm \
    --platform linux/amd64 \
    --pull=never \
    --volume "$REPOSITORY_DIR:/workspace" \
    --workdir /workspace/packages/contracts \
    "$ECHIDNA_IMAGE" \
    echidna audit/harness/ProtocolStateMachineCampaign.sol \
    --contract ProtocolStateMachineCampaign \
    --config audit/echidna.yaml \
    >"$REPORT_DIR/echidna.json"; then
    status=1
fi

cd "$CONTRACTS_DIR"
if ! medusa fuzz --config audit/medusa.json >"$REPORT_DIR/medusa.txt" 2>&1; then
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
