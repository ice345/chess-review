#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ $# -ne 2 ]]; then
  echo 'Usage: deploy/nuc/build.sh IMAGE_TAG RELEASE_ID (builds Linux amd64 locally)' >&2
  exit 2
fi
docker buildx build --platform linux/amd64 --load --file deploy/nuc/Dockerfile \
  --build-arg "RELEASE_ID=$2" --tag "$1" .
