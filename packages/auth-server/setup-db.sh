#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load DATABASE_URL from .env.local if not already set
if [ -z "$DATABASE_URL" ] && [ -f "$SCRIPT_DIR/.env.local" ]; then
  DATABASE_URL=$(grep '^DATABASE_URL=' "$SCRIPT_DIR/.env.local" | cut -d'=' -f2-)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set. Configure it in .env.local or export it."
  exit 1
fi

echo "Running schema migration..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/setup-db.sql"
echo "Done."
