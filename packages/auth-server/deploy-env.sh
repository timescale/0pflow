#!/bin/bash
# Upload .env.local variables to Vercel as sensitive env vars.
# Usage: ./deploy-env.sh [environment]
# Default environment: production
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"
ENVIRONMENT="${1:-production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

if ! command -v vercel &> /dev/null; then
  echo "Error: vercel CLI not installed. Run: npm i -g vercel"
  exit 1
fi

echo "Uploading env vars to Vercel ($ENVIRONMENT)..."
while IFS= read -r line; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  # Split on first =
  key="${line%%=*}"
  value="${line#*=}"
  # Skip if no value
  [[ -z "$value" ]] && continue
  echo "  $key"
  printf '%s' "$value" | vercel env add "$key" "$ENVIRONMENT" --sensitive --force 2>/dev/null || \
  printf '%s' "$value" | vercel env add "$key" "$ENVIRONMENT" --sensitive
done < "$ENV_FILE"

echo "Done. Run 'vercel --prod' to redeploy with the new env vars."
