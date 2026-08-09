#!/usr/bin/env bash
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$AUDIT_DIR/.." && pwd)"
REPOSITORY_DIR="$(cd "$CONTRACTS_DIR/../.." && pwd)"
REPORT_DIR="$AUDIT_DIR/reports"
source "$AUDIT_DIR/toolchain.lock"

for tool in aderyn forge gitleaks jq node pnpm semgrep slither; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Required audit tool is unavailable: $tool" >&2
        exit 1
    fi
done

mkdir -p "$REPORT_DIR"
cd "$CONTRACTS_DIR"
status=0

node "$AUDIT_DIR/verify-toolchain.mjs" static

rm -f "$REPORT_DIR/slither.json" "$REPORT_DIR/aderyn.json"
slither . \
    --compile-force-framework foundry \
    --config-file slither.config.json \
    --json "$REPORT_DIR/slither.json" \
    >"$REPORT_DIR/slither.txt" 2>&1 || true

if ! aderyn . --src src --output "$REPORT_DIR/aderyn.json" >"$REPORT_DIR/aderyn.txt" 2>&1; then
    status=1
fi

if ! node --max-old-space-size=2048 "$AUDIT_DIR/check-static-findings.mjs" \
    "$AUDIT_DIR/static-dispositions.json" \
    "$REPORT_DIR/slither.json" \
    "$REPORT_DIR/aderyn.json"; then
    status=1
fi

if ! semgrep scan --validate --config "$AUDIT_DIR/semgrep.yml"; then
    status=1
fi

if ! semgrep scan \
    --config "$AUDIT_DIR/semgrep.yml" \
    --error \
    --sarif \
    --output "$REPORT_DIR/semgrep.sarif" \
    src script/minimal; then
    status=1
fi
if ! jq --exit-status '.runs | type == "array" and all(.[]; (.results | type == "array" and length == 0))' \
    "$REPORT_DIR/semgrep.sarif" >/dev/null; then
    echo "Semgrep SARIF contains blocking findings or is malformed." >&2
    status=1
fi

if git -C "$REPOSITORY_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
    if ! gitleaks git \
        --config "$REPOSITORY_DIR/.gitleaks.toml" \
        --no-banner \
        --redact \
        --report-format json \
        --report-path "$REPORT_DIR/gitleaks.json" \
        "$REPOSITORY_DIR"; then
        status=1
    fi
else
    echo "No Git HEAD exists; Gitleaks is scanning the working tree only." >&2
    if ! gitleaks dir \
        --config "$REPOSITORY_DIR/.gitleaks.toml" \
        --no-banner \
        --redact \
        --report-format json \
        --report-path "$REPORT_DIR/gitleaks.json" \
        "$REPOSITORY_DIR"; then
        status=1
    fi
fi
if ! jq --exit-status 'type == "array" and length == 0' "$REPORT_DIR/gitleaks.json" >/dev/null; then
    echo "Gitleaks report contains blocking findings or is malformed." >&2
    status=1
fi

if ! pnpm exec solhint 'src/**/*.sol' 'script/minimal/**/*.sol' >"$REPORT_DIR/solhint.txt" 2>&1; then
    status=1
fi

if ! forge build --sizes >"$REPORT_DIR/contract-sizes.txt" 2>&1; then
    status=1
elif ! node "$AUDIT_DIR/verify-toolchain.mjs" static --artifacts; then
    status=1
fi

: >"$REPORT_DIR/storage-layout.jsonl"
for contract in \
    GBX Fundraiser LiquidityPosition SignalGBX ResonanceRouter Resonance Strategy \
    BribeRouter Bribe StrategyFactory BribeFactory Fund TimelockController; do
    layout="$(forge inspect "$contract" storage-layout --json)"
    jq --compact-output --null-input --arg contract "$contract" --argjson layout "$layout" \
        '{contract: $contract, layout: $layout}' >>"$REPORT_DIR/storage-layout.jsonl"
done

pnpm --dir "$REPOSITORY_DIR" audit --json >"$REPORT_DIR/pnpm-audit.json" || true
if ! node "$AUDIT_DIR/check-pnpm-audit.mjs" "$REPORT_DIR/pnpm-audit.json"; then
    status=1
fi
license_platform="$(node -p '`${process.platform}-${process.arch}`')"
case "$license_platform" in
    darwin-arm64)
        license_inventory="$AUDIT_DIR/dependency-license-inventory.darwin-arm64.json"
        license_policy="$AUDIT_DIR/dependency-license-review-policy.darwin-arm64.json"
        ;;
    linux-x64)
        license_inventory="$AUDIT_DIR/dependency-license-inventory.json"
        license_policy="$AUDIT_DIR/dependency-license-review-policy.json"
        ;;
    *)
        echo "Unsupported dependency-license audit platform: $license_platform" >&2
        status=1
        license_inventory=""
        license_policy=""
        ;;
esac
if [[ "$(pnpm --version)" != "10.14.0" ]]; then
    echo "Dependency-license evidence requires pnpm 10.14.0." >&2
    status=1
elif ! pnpm --dir "$REPOSITORY_DIR" licenses list --json >"$REPORT_DIR/licenses-installed.json"; then
    status=1
elif [[ -z "$license_inventory" ]]; then
    status=1
elif ! node "$AUDIT_DIR/generate-dependency-license-inventory.mjs" \
    --workspace "$REPOSITORY_DIR" \
    --platform "$license_platform" \
    --check "$license_inventory"; then
    status=1
elif ! cp "$license_inventory" "$REPORT_DIR/licenses.json"; then
    status=1
elif ! node "$AUDIT_DIR/check-license-review.mjs" \
    "$license_policy" \
    "$REPOSITORY_DIR/pnpm-lock.yaml" \
    "$REPOSITORY_DIR/pnpm-workspace.yaml" \
    "$REPORT_DIR/licenses.json"; then
    status=1
fi

exit "$status"
