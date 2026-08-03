#!/usr/bin/env bash
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$AUDIT_DIR/toolchain.lock"

MODE="${1:-write}"
if [[ "$MODE" != "write" && "$MODE" != "--check" ]]; then
    echo "Usage: $0 [--check]" >&2
    exit 1
fi

verify_sha256() {
    local expected="$1"
    local archive="$2"
    if command -v sha256sum >/dev/null 2>&1; then
        [[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected" ]]
    else
        [[ "$(shasum -a 256 "$archive" | awk '{print $1}')" == "$expected" ]]
    fi
}

case "$(uname -s):$(uname -m)" in
    Darwin:arm64)
        UV_TARGET="aarch64-apple-darwin"
        UV_SHA256="$UV_DARWIN_ARM64_SHA256"
        ;;
    Linux:x86_64)
        UV_TARGET="x86_64-unknown-linux-gnu"
        UV_SHA256="$UV_LINUX_X86_64_SHA256"
        ;;
    *)
        echo "Analyzer lock generation supports Darwin arm64 and Linux x86_64 only." >&2
        exit 1
        ;;
esac

GENERATOR_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/gumball6900-analyzer-locks.XXXXXX")"
trap 'rm -rf "$GENERATOR_TEMP"' EXIT
UV_ARCHIVE="$GENERATOR_TEMP/uv.tar.gz"
curl --fail --location --silent --show-error \
    --connect-timeout 20 \
    --retry 4 \
    --retry-all-errors \
    "https://github.com/astral-sh/uv/releases/download/$UV_VERSION/uv-$UV_TARGET.tar.gz" \
    --output "$UV_ARCHIVE"
verify_sha256 "$UV_SHA256" "$UV_ARCHIVE"
tar --extract --gzip --file "$UV_ARCHIVE" --directory "$GENERATOR_TEMP"
UV="$GENERATOR_TEMP/uv-$UV_TARGET/uv"

generate_lock() {
    local package="$1"
    local version="$2"
    local output="$3"
    printf '%s==%s\n' "$package" "$version" | "$UV" pip compile - \
        --python-version "$ANALYZER_PYTHON_VERSION" \
        --python-platform x86_64-manylinux_2_35 \
        --only-binary=:all: \
        --generate-hashes \
        --exclude-newer "$ANALYZER_LOCK_CUTOFF" \
        --no-header \
        --no-annotate \
        --output-file "$output" \
        >/dev/null
}

ANALYZER_PYTHON_VERSION="$(node -e \
    'const fs = require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).pythonVersion);' \
    "$AUDIT_DIR/analyzer-environment-policy.json")"
generate_lock semgrep "$SEMGREP_VERSION" "$GENERATOR_TEMP/semgrep-linux-x64.txt"
generate_lock slither-analyzer "$SLITHER_VERSION" "$GENERATOR_TEMP/slither-linux-x64.txt"

mkdir -p "$AUDIT_DIR/python-locks"
for tool in semgrep slither; do
    generated="$GENERATOR_TEMP/$tool-linux-x64.txt"
    checked_in="$AUDIT_DIR/python-locks/$tool-linux-x64.txt"
    if [[ "$MODE" == "--check" ]]; then
        if ! cmp --silent "$generated" "$checked_in"; then
            echo "Analyzer lock is stale: $checked_in" >&2
            exit 1
        fi
    else
        install -m 0644 "$generated" "$checked_in"
    fi
done
