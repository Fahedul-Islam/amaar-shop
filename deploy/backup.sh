#!/usr/bin/env bash
#
# Nightly backup: PostgreSQL dump + uploaded files, keeping the last 7 days.
#
# Install (as the ubuntu user on the server):
#     chmod +x ~/amaar-shop/deploy/backup.sh
#     crontab -e
#     0 2 * * * /home/ubuntu/amaar-shop/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
#
# Restore instructions: ../docs/DEPLOYMENT.md (Part 10).

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
STAMP="$(date +%F_%H%M)"

cd "$DEPLOY_DIR"

# Load POSTGRES_USER / POSTGRES_DB from the same .env docker compose uses.
set -a
. ./.env
set +a

mkdir -p "$BACKUP_DIR"

# 1. Database — a plain SQL dump, gzipped.
docker compose exec -T postgres \
	pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
	| gzip >"$BACKUP_DIR/db_$STAMP.sql.gz"

# 2. Uploaded files — read the volume through a throwaway container.
docker run --rm \
	-v amaarshop_upload_data:/data:ro \
	-v "$BACKUP_DIR":/backup \
	alpine tar czf "/backup/uploads_$STAMP.tar.gz" -C /data .

# 3. Prune anything older than KEEP_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name '*.gz' -mtime "+$KEEP_DAYS" -delete

echo "$(date -Is) backup ok → $BACKUP_DIR/db_$STAMP.sql.gz, $BACKUP_DIR/uploads_$STAMP.tar.gz"
