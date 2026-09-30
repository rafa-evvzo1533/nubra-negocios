#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/nubra-negocios
backup_dir=$base/backups
install -d -m 700 "$backup_dir"
exec 9>/run/lock/nubra-negocios-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$backup_dir/nubra-negocios-$stamp.dump"
test ! -e "$file"
trap 'rm -f -- "$file.partial"' EXIT
docker compose -f "$base/postgres.compose.yml" exec -T postgres \
  pg_dump -U nubra_owner -d nubra_negocios --format=custom > "$file.partial"
test -s "$file.partial"
docker compose -f "$base/postgres.compose.yml" exec -T postgres \
  pg_restore --list < "$file.partial" > /dev/null
mv -- "$file.partial" "$file"
# Only expired dumps created by this script in this dedicated directory.
find "$backup_dir" -maxdepth 1 -type f -name 'nubra-negocios-????????T??????Z.dump' -mtime +14 -delete
printf 'Database backup created: %s\n' "$file"
