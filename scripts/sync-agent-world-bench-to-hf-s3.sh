#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${HEPA_AGENTWORLD_DATA_DIR:-$ROOT/data/agent-world-bench}"
PROFILE="${HF_AWS_PROFILE:-hf}"
BUCKET="${HF_S3_BUCKET:-eridhubdata}"
PREFIX="${HF_S3_PREFIX:-agent-world-bench}"

if ! aws --profile "$PROFILE" s3 ls "s3://$BUCKET" >/dev/null 2>&1; then
  echo "ไม่สามารถเข้าถึง s3://$BUCKET ด้วย profile $PROFILE" >&2
  exit 1
fi

echo "อัปโหลด $SOURCE → s3://$BUCKET/$PREFIX/"
aws --profile "$PROFILE" s3 sync "$SOURCE" "s3://$BUCKET/$PREFIX/" \
  --exclude ".cache/*" \
  --exclude "*.lock" \
  --only-show-errors

echo "เสร็จแล้ว"