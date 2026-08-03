#!/usr/bin/env bash
set -euo pipefail

for variable in CONTRACT_DOCS_DIR EVIDENCE_COMMIT RELEASE_DERIVED_DIR RELEASE_MANIFEST_PATH RELEASE_OUTPUT_DIR RELEASE_TAG REPOSITORY_DIR SOURCE_COMMIT; do
    if [[ -z "${!variable:-}" ]]; then
        echo "Required environment variable is unset: $variable" >&2
        exit 1
    fi
done

for command in git gzip jq sha256sum tar; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Required release evidence tool is unavailable: $command" >&2
        exit 1
    fi
done

git_environment=()
while IFS='=' read -r name _; do
    if [[ "$name" == GIT_* ]]; then
        git_environment+=(-u "$name")
    fi
done < <(env)

sanitized_git() {
    env "${git_environment[@]}" \
        GIT_CONFIG_GLOBAL=/dev/null \
        GIT_CONFIG_NOSYSTEM=1 \
        GIT_CONFIG_SYSTEM=/dev/null \
        GIT_NO_REPLACE_OBJECTS=1 \
        GIT_TERMINAL_PROMPT=0 \
        git --no-optional-locks "$@"
}

if [[ ! "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    echo "Unsafe release tag passed to evidence packager" >&2
    exit 1
fi
if [[ ! "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ || ! "$EVIDENCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Unsafe source or evidence commit passed to evidence packager" >&2
    exit 1
fi

metadata_file="$RELEASE_DERIVED_DIR/release-metadata.json"
metadata_manifest_path="$(jq --exit-status --raw-output '.manifestRepositoryPath | select(type == "string")' "$metadata_file")"
metadata_manifest_sha256="$(jq --exit-status --raw-output '.manifestSha256 | select(type == "string")' "$metadata_file")"
metadata_config_path="$(jq --exit-status --raw-output '.deploymentConfigRepositoryPath | select(type == "string")' "$metadata_file")"
metadata_config_sha256="$(jq --exit-status --raw-output '.deploymentConfigSha256 | select(type == "string")' "$metadata_file")"
metadata_state_path="$(jq --exit-status --raw-output '.deploymentStateRepositoryPath | select(type == "string")' "$metadata_file")"
metadata_state_sha256="$(jq --exit-status --raw-output '.deploymentStateSha256 | select(type == "string")' "$metadata_file")"
metadata_policy_id="$(jq --exit-status --raw-output '.releaseManifestSignaturePolicyId | select(type == "string")' "$metadata_file")"
metadata_policy_path="$(jq --exit-status --raw-output '.releaseManifestSignaturePolicyRepositoryPath | select(type == "string")' "$metadata_file")"
metadata_policy_sha256="$(jq --exit-status --raw-output '.releaseManifestSignaturePolicySha256 | select(type == "string")' "$metadata_file")"
metadata_safe_policy_path="$(jq --exit-status --raw-output '.safeControlPlanePolicyRepositoryPath | select(type == "string")' "$metadata_file")"
metadata_safe_policy_sha256="$(jq --exit-status --raw-output '.safeControlPlanePolicySha256 | select(type == "string")' "$metadata_file")"
metadata_evidence_commit="$(jq --exit-status --raw-output '.evidenceCommit | select(type == "string")' "$metadata_file")"
metadata_release_tag="$(jq --exit-status --raw-output '.releaseTag | select(type == "string")' "$metadata_file")"
metadata_source_commit="$(jq --exit-status --raw-output '.sourceCommit | select(type == "string")' "$metadata_file")"
metadata_registry_authorization_eligible="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.authorizationEligible | select(type == "boolean") | tostring' \
        "$metadata_file"
)"
metadata_registry_artifact_sha256="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.rawSha256 | select(type == "string")' \
        "$metadata_file"
)"
metadata_registry_selected_sha256="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.selectedRecordsSha256 | select(type == "string")' \
        "$metadata_file"
)"
metadata_registry_source_archive_file="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.sourceArchiveFileName | select(type == "string")' \
        "$metadata_file"
)"
metadata_registry_source_archive_sha256="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.sourceArchiveRawSha256 | select(type == "string")' \
        "$metadata_file"
)"
metadata_registry_source_response_sha256="$(
    jq --exit-status --raw-output \
        '.robinhoodRegistryRevalidation.sourceResponseSha256 | select(type == "string")' \
        "$metadata_file"
)"
metadata_registry_stage="$(
    jq --exit-status --raw-output '.robinhoodRegistryRevalidation.stage | select(type == "string")' "$metadata_file"
)"
if [[ "$metadata_manifest_path" != "$RELEASE_MANIFEST_PATH" || "$metadata_policy_path" != "packages/config/deployments/release-manifest-signature-policy.json" || "$metadata_safe_policy_path" != "packages/config/deployments/safe-control-plane-policy.json" || "$metadata_evidence_commit" != "$EVIDENCE_COMMIT" || "$metadata_source_commit" != "$SOURCE_COMMIT" || "$metadata_release_tag" != "$RELEASE_TAG" ]]; then
    echo "Release evidence environment does not match prepared release metadata" >&2
    exit 1
fi
if [[ ! "$metadata_manifest_sha256" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Prepared release metadata contains an invalid manifest SHA-256" >&2
    exit 1
fi
if [[ ! "$metadata_config_sha256" =~ ^[0-9a-f]{64}$ || ! "$metadata_state_sha256" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Prepared release metadata contains an invalid deployment-snapshot SHA-256" >&2
    exit 1
fi
if [[ "$metadata_config_path" != "$(jq --exit-status --raw-output '.releaseEvidence.deploymentConfig.path' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" || "$metadata_state_path" != "$(jq --exit-status --raw-output '.releaseEvidence.deploymentState.path' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" || "$metadata_config_sha256" != "$(jq --exit-status --raw-output '.releaseEvidence.deploymentConfig.rawSha256' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" || "$metadata_state_sha256" != "$(jq --exit-status --raw-output '.releaseEvidence.deploymentState.rawSha256' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" ]]; then
    echo "Prepared deployment snapshots do not match the signed manifest descriptors" >&2
    exit 1
fi
if [[ ! "$metadata_policy_sha256" =~ ^[0-9a-f]{64}$ || ! "$metadata_policy_id" =~ ^0x[0-9a-f]{64}$ || "$metadata_policy_id" =~ ^0x0{64}$ ]]; then
    echo "Prepared release metadata contains an invalid release-manifest signature policy binding" >&2
    exit 1
fi
if [[ ! "$metadata_safe_policy_sha256" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Prepared release metadata contains an invalid Safe control-plane policy binding" >&2
    exit 1
fi
if [[ "$metadata_registry_authorization_eligible" != false || "$metadata_registry_stage" != preliminary ]]; then
    echo "Offline evidence must contain the explicitly nonauthorizing preliminary registry revalidation" >&2
    exit 1
fi
if [[ "$metadata_registry_source_archive_file" != "robinhood-registry-response.json" || ! "$metadata_registry_artifact_sha256" =~ ^[0-9a-f]{64}$ || ! "$metadata_registry_source_archive_sha256" =~ ^[0-9a-f]{64}$ || ! "$metadata_registry_source_response_sha256" =~ ^0x[0-9a-f]{64}$ || ! "$metadata_registry_selected_sha256" =~ ^0x[0-9a-f]{64}$ ]]; then
    echo "Prepared release metadata contains an invalid Robinhood registry evidence binding" >&2
    exit 1
fi
registry_artifact_file="$RELEASE_DERIVED_DIR/robinhood-registry-revalidation.json"
registry_response_file="$RELEASE_DERIVED_DIR/$metadata_registry_source_archive_file"
printf '%s  %s\n' "$metadata_manifest_sha256" "$RELEASE_DERIVED_DIR/deployment-manifest.json" | sha256sum --check --status
printf '%s  %s\n' "$metadata_config_sha256" "$RELEASE_DERIVED_DIR/deployment-config.json" | sha256sum --check --status
printf '%s  %s\n' "$metadata_state_sha256" "$RELEASE_DERIVED_DIR/deployment-state.json" | sha256sum --check --status
printf '%s  %s\n' "$metadata_policy_sha256" "$RELEASE_DERIVED_DIR/release-manifest-signature-policy.json" | sha256sum --check --status
printf '%s  %s\n' "$metadata_safe_policy_sha256" "$RELEASE_DERIVED_DIR/safe-control-plane-policy.json" | sha256sum --check --status
printf '%s  %s\n' "$metadata_registry_artifact_sha256" "$registry_artifact_file" | sha256sum --check --status
printf '%s  %s\n' "$metadata_registry_source_archive_sha256" "$registry_response_file" | sha256sum --check --status
if [[ "$metadata_registry_source_response_sha256" != "0x$metadata_registry_source_archive_sha256" ]]; then
    echo "Registry source response digest does not match its exact raw archive digest" >&2
    exit 1
fi
if ! jq --exit-status \
    --arg candidate_path "$(jq --exit-status --raw-output '.releaseEvidence.assetCandidate.path' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" \
    --arg candidate_sha256 "$(jq --exit-status --raw-output '.releaseEvidence.assetCandidate.rawSha256' "$RELEASE_DERIVED_DIR/deployment-manifest.json")" \
    --arg config_path "$metadata_config_path" \
    --arg config_sha256 "$metadata_config_sha256" \
    --arg evidence_commit "$EVIDENCE_COMMIT" \
    --arg manifest_path "$metadata_manifest_path" \
    --arg manifest_sha256 "$metadata_manifest_sha256" \
    --arg policy_id "$metadata_policy_id" \
    --arg release_tag "$RELEASE_TAG" \
    --arg selected_sha256 "$metadata_registry_selected_sha256" \
    --arg source_commit "$SOURCE_COMMIT" \
    --arg source_response_sha256 "$metadata_registry_source_response_sha256" \
    --arg source_sha256 "$metadata_registry_source_archive_sha256" '
        .authorizationEligible == false and
        .stage == "preliminary" and
        .evidence.selectedRecordsSha256 == $selected_sha256 and
        .evidence.sourceArchive.fileName == "robinhood-registry-response.json" and
        .evidence.sourceArchive.rawSha256 == $source_sha256 and
        .evidence.sourceResponseSha256 == $source_response_sha256 and
        .releaseLinkage.assetCandidate == {path: $candidate_path, rawSha256: $candidate_sha256} and
        .releaseLinkage.deploymentConfig == {path: $config_path, rawSha256: $config_sha256} and
        .releaseLinkage.deploymentManifest == {path: $manifest_path, rawSha256: $manifest_sha256} and
        .releaseLinkage.evidenceCommit == $evidence_commit and
        .releaseLinkage.releaseTag == $release_tag and
        .releaseLinkage.signaturePolicyId == $policy_id and
        .releaseLinkage.sourceCommit == $source_commit
    ' "$registry_artifact_file" >/dev/null; then
    echo "Prepared Robinhood registry artifact does not match release metadata and signed inputs" >&2
    exit 1
fi

mkdir -p "$RELEASE_OUTPUT_DIR"

archive_repository_paths() {
    local output="$1"
    shift
    tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner --format=gnu \
        --directory "$REPOSITORY_DIR" --create --file - "$@" | gzip -n >"$output"
}

archive_external_path() {
    local output="$1"
    local source="$2"
    tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner --format=gnu \
        --directory "$(dirname "$source")" --create --file - "$(basename "$source")" | gzip -n >"$output"
}

sanitized_git -C "$REPOSITORY_DIR" archive --format=tar --prefix="gumball-6900-$RELEASE_TAG/" "$SOURCE_COMMIT" \
    | gzip -n >"$RELEASE_OUTPUT_DIR/source-$RELEASE_TAG.tar.gz"

archive_repository_paths "$RELEASE_OUTPUT_DIR/contracts-$RELEASE_TAG.tar.gz" \
    packages/contracts/out packages/contracts/artifacts/hardhat packages/contracts/foundry.toml \
    packages/contracts/hardhat.config.ts
archive_repository_paths "$RELEASE_OUTPUT_DIR/abi-$RELEASE_TAG.tar.gz" \
    packages/sdk/src/generated-abis.ts packages/subgraph/abis
archive_repository_paths "$RELEASE_OUTPUT_DIR/sdk-$RELEASE_TAG.tar.gz" \
    packages/sdk/dist packages/sdk/package.json packages/sdk/README.md
archive_repository_paths "$RELEASE_OUTPUT_DIR/subgraph-$RELEASE_TAG.tar.gz" \
    packages/subgraph/build-release packages/subgraph/schema.graphql packages/subgraph/subgraph.yaml
archive_repository_paths "$RELEASE_OUTPUT_DIR/web-$RELEASE_TAG.tar.gz" \
    apps/web/.next/standalone apps/web/.next/static apps/web/.next/BUILD_ID apps/web/public apps/web/package.json
archive_repository_paths "$RELEASE_OUTPUT_DIR/storybook-$RELEASE_TAG.tar.gz" apps/web/storybook-static
archive_external_path "$RELEASE_OUTPUT_DIR/contract-docs-$RELEASE_TAG.tar.gz" "$CONTRACT_DOCS_DIR"

cp "$RELEASE_DERIVED_DIR/deployment-manifest.json" "$RELEASE_OUTPUT_DIR/deployment-manifest.json"
cp "$RELEASE_DERIVED_DIR/release-manifest-signature-policy.json" "$RELEASE_OUTPUT_DIR/release-manifest-signature-policy.json"
cp "$RELEASE_DERIVED_DIR/safe-control-plane-policy.json" "$RELEASE_OUTPUT_DIR/safe-control-plane-policy.json"
cp "$REPOSITORY_DIR/pnpm-lock.yaml" "$RELEASE_OUTPUT_DIR/pnpm-lock.yaml"
cp "$REPOSITORY_DIR/packages/simulations/requirements-dev.lock" "$RELEASE_OUTPUT_DIR/requirements-dev.lock"
cp "$RELEASE_DERIVED_DIR/release-metadata.json" "$RELEASE_OUTPUT_DIR/release-metadata.json"
cp "$RELEASE_DERIVED_DIR/subgraph-networks.json" "$RELEASE_OUTPUT_DIR/subgraph-networks.json"
cp "$REPOSITORY_DIR/packages/contracts/.gas-snapshot" "$RELEASE_OUTPUT_DIR/gas-snapshot.txt"
cp "$REPOSITORY_DIR/packages/contracts/audit/FINDINGS.md" "$RELEASE_OUTPUT_DIR/audit-findings-register.md"
analyzer_environment_policy="$REPOSITORY_DIR/packages/contracts/audit/analyzer-environment-policy.json"
cp "$analyzer_environment_policy" "$RELEASE_OUTPUT_DIR/analyzer-environment-policy.json"
analyzer_environment_state="$(
    jq --exit-status --raw-output \
        '.state | select(. == "configured" or . == "dependencies-prepared" or . == "transitive-dependencies-unlocked")' \
        "$analyzer_environment_policy"
)"
if [[ "$analyzer_environment_state" == configured || "$analyzer_environment_state" == dependencies-prepared ]]; then
    mkdir -p "$RELEASE_OUTPUT_DIR/python-analyzer-locks"
    for analyzer_lock_path in \
        packages/contracts/audit/python-locks/semgrep-linux-x64.txt \
        packages/contracts/audit/python-locks/slither-linux-x64.txt; do
        analyzer_lock_filename="${analyzer_lock_path##*/}"
        analyzer_lock="${analyzer_lock_filename%-linux-x64.txt}"
        analyzer_lock_source="$REPOSITORY_DIR/$analyzer_lock_path"
        if [[ ! -f "$analyzer_lock_source" || -L "$analyzer_lock_source" ]]; then
            echo "Configured analyzer lock is missing or not a regular nonsymlink file: $analyzer_lock_path" >&2
            exit 1
        fi
        analyzer_lock_sha256="$(
            jq --exit-status --raw-output \
                --arg analyzer "$analyzer_lock" \
                --arg analyzer_path "$analyzer_lock_path" \
                '.bindings[] | select(.tool == $analyzer and .path == $analyzer_path) | .sha256' \
                "$analyzer_environment_policy"
        )"
        if [[ ! "$analyzer_lock_sha256" =~ ^[0-9a-f]{64}$ ]]; then
            echo "Configured analyzer lock has an invalid or ambiguous SHA-256: $analyzer_lock_path" >&2
            exit 1
        fi
        printf '%s  %s\n' "$analyzer_lock_sha256" "$analyzer_lock_source" | sha256sum --check --status
        cp "$analyzer_lock_source" "$RELEASE_OUTPUT_DIR/python-analyzer-locks/$analyzer_lock_filename"
    done
fi
cp "$REPOSITORY_DIR/packages/contracts/audit/toolchain.lock" "$RELEASE_OUTPUT_DIR/audit-toolchain.lock"
for coverage_report in \
    forge-coverage.lcov forge-coverage-summary.json \
    hardhat-coverage.lcov hardhat-coverage-summary.json; do
    cp "$REPOSITORY_DIR/packages/contracts/audit/reports/$coverage_report" \
        "$RELEASE_OUTPUT_DIR/$coverage_report"
done
cp "$REPOSITORY_DIR/scripts/release/README.md" "$RELEASE_OUTPUT_DIR/evidence-format.md"
cp "$RELEASE_DERIVED_DIR"/*.json "$RELEASE_OUTPUT_DIR/"
cp "$RELEASE_DERIVED_DIR"/*.sha256 "$RELEASE_OUTPUT_DIR/"

for optional in LICENSE NOTICE SECURITY.md; do
    if [[ -f "$REPOSITORY_DIR/$optional" ]]; then
        cp "$REPOSITORY_DIR/$optional" "$RELEASE_OUTPUT_DIR/$optional"
    fi
done

(
    cd "$RELEASE_OUTPUT_DIR"
    find . -type f ! -name SHA256SUMS -print0 \
        | LC_ALL=C sort -z \
        | xargs -0 sha256sum >SHA256SUMS
)

echo "Normalized, checksummed offline evidence packaged at $RELEASE_OUTPUT_DIR"
