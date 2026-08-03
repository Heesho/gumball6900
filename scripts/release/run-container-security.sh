#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: bash scripts/release/run-container-security.sh IMAGE OUTPUT_DIRECTORY" >&2
    exit 1
fi

image="$1"
output_directory="$2"
policy="scripts/release/container-security-policy.json"
checker="scripts/release/check-container-vulnerabilities.mjs"

for command in cp docker find jq mktemp node realpath unlink; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Required container-security command is unavailable: $command" >&2
        exit 1
    fi
done

mkdir -p "$output_directory"
if [[ -L "$output_directory" || ! -d "$output_directory" ]]; then
    echo "Container-security output must be a real directory" >&2
    exit 1
fi
output_directory="$(realpath "$output_directory")"
for stale_name in \
    container-security-policy.json \
    web-container.sbom.syft.json \
    web-container.sbom.spdx.json \
    web-container.grype.json \
    web-container.grype-db-status.json \
    web-container-vulnerability-summary.json; do
    stale_path="$output_directory/$stale_name"
    if [[ -L "$stale_path" || -d "$stale_path" ]]; then
        echo "Container-security evidence path is not a regular file boundary: $stale_name" >&2
        exit 1
    fi
    if [[ -e "$stale_path" ]]; then
        unlink "$stale_path"
    fi
done
cp "$policy" "$output_directory/container-security-policy.json"
policy_summary="$(node "$checker" --policy "$policy" --policy-only)"
platform="$(jq --exit-status --raw-output '.platform' <<<"$policy_summary")"
syft_image="$(jq --exit-status --raw-output '.images.syft.reference' <<<"$policy_summary")"
grype_image="$(jq --exit-status --raw-output '.images.grype.reference' <<<"$policy_summary")"
image_id="$(docker image inspect "$image" --format '{{.Id}}')"
if [[ ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "Built release image lacks a valid immutable image ID" >&2
    exit 1
fi

docker pull --platform "$platform" "$syft_image"
docker pull --platform "$platform" "$grype_image"

syft_repo_digests="$(docker image inspect "$syft_image" --format '{{json .RepoDigests}}')"
grype_repo_digests="$(docker image inspect "$grype_image" --format '{{json .RepoDigests}}')"
syft_digest="${syft_image##*@}"
grype_digest="${grype_image##*@}"
jq --exit-status --arg digest "$syft_digest" 'any(.[]; endswith("@" + $digest))' <<<"$syft_repo_digests" >/dev/null
jq --exit-status --arg digest "$grype_digest" 'any(.[]; endswith("@" + $digest))' <<<"$grype_repo_digests" >/dev/null

native_sbom="$output_directory/web-container.sbom.syft.json"
spdx_sbom="$output_directory/web-container.sbom.spdx.json"
scan_report="$output_directory/web-container.grype.json"
database_status="$output_directory/web-container.grype-db-status.json"
summary="$output_directory/web-container-vulnerability-summary.json"
smoke="$output_directory/web-container-smoke.json"
grype_cache="$(mktemp -d "${TMPDIR:-/tmp}/gumball-grype-cache.XXXXXX")"
image_archive_directory="$(mktemp -d "${TMPDIR:-/tmp}/gumball-image-archive.XXXXXX")"
image_archive="$image_archive_directory/web-container.docker.tar"
cleanup() {
    find "$grype_cache" -depth -delete
    find "$image_archive_directory" -depth -delete
}
trap cleanup EXIT

if [[ -L "$smoke" || ! -f "$smoke" || ! -s "$smoke" ]]; then
    echo "Container smoke evidence must be a regular nonempty file" >&2
    exit 1
fi

docker save --output "$image_archive" "$image_id"
if [[ -L "$image_archive" || ! -f "$image_archive" || ! -s "$image_archive" ]]; then
    echo "Docker did not produce a regular nonempty release-image archive" >&2
    exit 1
fi

docker run --rm --platform "$platform" \
    --network none \
    --env SYFT_CHECK_FOR_APP_UPDATE=false \
    --env SYFT_FORMAT_PRETTY=true \
    --mount "type=bind,source=$image_archive,target=/input/web-container.docker.tar,readonly" \
    --mount "type=bind,source=$output_directory,target=/evidence" \
    "$syft_image" docker-archive:/input/web-container.docker.tar \
    --output syft-json=/evidence/web-container.sbom.syft.json \
    --output spdx-json=/evidence/web-container.sbom.spdx.json

docker run --rm --platform "$platform" \
    --env GRYPE_CHECK_FOR_APP_UPDATE=false \
    --env GRYPE_DB_CACHE_DIR=/cache \
    --mount "type=bind,source=$grype_cache,target=/cache" \
    "$grype_image" db update

docker run --rm --platform "$platform" \
    --network none \
    --env GRYPE_CHECK_FOR_APP_UPDATE=false \
    --env GRYPE_DB_AUTO_UPDATE=false \
    --env GRYPE_DB_CACHE_DIR=/cache \
    --env GRYPE_DB_REQUIRE_UPDATE_CHECK=false \
    --env GRYPE_DB_VALIDATE_BY_HASH_ON_START=true \
    --mount "type=bind,source=$grype_cache,target=/cache" \
    "$grype_image" db status --output json >"$database_status"

docker run --rm --platform "$platform" \
    --network none \
    --env GRYPE_CHECK_FOR_APP_UPDATE=false \
    --env GRYPE_DB_AUTO_UPDATE=false \
    --env GRYPE_DB_CACHE_DIR=/cache \
    --env GRYPE_DB_REQUIRE_UPDATE_CHECK=false \
    --env GRYPE_DB_VALIDATE_BY_HASH_ON_START=true \
    --mount "type=bind,source=$output_directory,target=/evidence,readonly" \
    --mount "type=bind,source=$grype_cache,target=/cache" \
    "$grype_image" sbom:/evidence/web-container.sbom.syft.json --output json >"$scan_report"

node "$checker" \
    --policy "$policy" \
    --sbom "$native_sbom" \
    --spdx "$spdx_sbom" \
    --scan "$scan_report" \
    --smoke "$smoke" \
    --database-status "$database_status" \
    --image-id "$image_id" \
    --output "$summary"
