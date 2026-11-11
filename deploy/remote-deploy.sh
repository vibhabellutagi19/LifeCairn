#!/usr/bin/env bash
# Runs ON THE EC2 INSTANCE, streamed over SSH by deploy/deploy.sh:
#   remote-deploy.sh <remote_dir> <app_image> <tools_image> <aws_region>
# Pulls the repo, backs up the database, points ec2.env at the new images,
# applies migrations and restarts the app. Stops at the first failure, before
# the running app is touched whenever possible.
set -euo pipefail

REMOTE_DIR="${1:?remote dir}"
APP_IMAGE="${2:?app image}"
TOOLS_IMAGE="${3:?tools image}"
AWS_REGION="${4:?aws region}"
REGISTRY="${APP_IMAGE%%/*}"
REMOTE_DIR="${REMOTE_DIR/#\~/$HOME}"
# A relative path is relative to this (the server) user's home.
[[ "$REMOTE_DIR" = /* ]] || REMOTE_DIR="$HOME/$REMOTE_DIR"
BACKUP_DIR="$HOME/backups"
KEEP_BACKUPS=10

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cd "$REMOTE_DIR" || fail "No checkout at $REMOTE_DIR"
[ -f deploy/ec2.env ] || fail "deploy/ec2.env is missing on the server"
C=(sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml)

step "Updating the code (compose file, Caddyfile)"
git pull --ff-only

step "Checking disk space"
free_gb=$(df -Pk / | awk 'NR==2 {print int($4/1024/1024)}')
echo "Free: ${free_gb} GB"
if (( free_gb < 3 )); then
  echo "Low on space: removing images no container uses (volumes and data are not touched)."
  sudo docker image prune -a -f >/dev/null
  free_gb=$(df -Pk / | awk 'NR==2 {print int($4/1024/1024)}')
  echo "Free now: ${free_gb} GB"
  (( free_gb >= 2 )) || fail "Still under 2 GB free. Free space or grow the disk, then run again."
fi

step "Backing up the database"
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/lifecairn-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
sudo docker exec lifecairn-db-1 pg_dump -U lifecairn lifecairn --lock-wait-timeout=10s </dev/null | gzip > "$backup"
[ -s "$backup" ] || fail "Backup came out empty; nothing was changed."
echo "Saved $backup ($(du -h "$backup" | cut -f1))"
ls -1t "$BACKUP_DIR"/lifecairn-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --

step "Pointing deploy/ec2.env at the new images"
previous_app=$(grep -E '^APP_IMAGE=' deploy/ec2.env | cut -d= -f2- || true)
previous_tools=$(grep -E '^TOOLS_IMAGE=' deploy/ec2.env | cut -d= -f2- || true)
cp deploy/ec2.env deploy/ec2.env.previous
chmod 600 deploy/ec2.env.previous
set_var() {
  if grep -qE "^$1=" deploy/ec2.env; then
    sed -i "s|^$1=.*|$1=$2|" deploy/ec2.env
  else
    printf '%s=%s\n' "$1" "$2" >> deploy/ec2.env
  fi
}
set_var APP_IMAGE "$APP_IMAGE"
set_var TOOLS_IMAGE "$TOOLS_IMAGE"
echo "Was: ${previous_app:-none}"
echo "Now: $APP_IMAGE"

step "Pulling the images"
aws ecr get-login-password --region "$AWS_REGION" | sudo docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
if ! "${C[@]}" --profile tools pull app tools; then
  cp deploy/ec2.env.previous deploy/ec2.env
  fail "Pull failed; deploy/ec2.env is back on the previous images and the app was not touched."
fi

step "Applying database migrations"
tracked=$(sudo docker exec lifecairn-db-1 psql -U lifecairn -d lifecairn -tAc \
  "select to_regclass('drizzle.__drizzle_migrations') is not null and exists (select 1 from drizzle.__drizzle_migrations)" 2>/dev/null || echo f)
if [ "$tracked" != "t" ]; then
  echo "Migrations aren't tracked here yet: marking the baseline (it checks the schema first)."
  if ! "${C[@]}" --profile tools run --rm -T tools npm run db:baseline </dev/null; then
    cp deploy/ec2.env.previous deploy/ec2.env
    fail "The baseline check failed (see above); the app was not touched. Backup: $backup"
  fi
fi
if ! "${C[@]}" --profile tools run --rm -T tools </dev/null; then
  cp deploy/ec2.env.previous deploy/ec2.env
  fail "Migration failed; the app still runs the previous version. Backup: $backup"
fi

step "Restarting the app"
"${C[@]}" up -d --no-build app

step "Checking it answers"
ok=""
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/sign-in || true)
  if [[ "$code" =~ ^(200|307|308)$ ]]; then ok=1; break; fi
  sleep 2
done
running=$(sudo docker inspect --format '{{.Config.Image}}' "$("${C[@]}" ps -q app)" 2>/dev/null || echo "?")
if [ -z "$ok" ]; then
  "${C[@]}" logs --tail=60 app || true
  printf '\nTo roll back: bash deploy/deploy.sh --tag %s\n' "${previous_app##*:}"
  fail "The app didn't answer on :3000 within a minute (running $running)."
fi
echo "Running: $running"
[ "$running" = "$APP_IMAGE" ] || fail "Expected $APP_IMAGE but the container runs $running."

step "Tidying old images"
sudo docker image prune -a -f >/dev/null || true
df -h / | awk 'NR==2 {print "Free disk: " $4}'

printf '\n\033[32m✓ Deployed %s\033[0m\n' "${APP_IMAGE##*:}"
if [ -n "$previous_app" ] && [ "$previous_app" != "$APP_IMAGE" ]; then
  printf 'Roll back with: bash deploy/deploy.sh --tag %s\n' "${previous_app##*:}"
fi
