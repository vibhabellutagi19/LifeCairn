#!/usr/bin/env bash
# One-command deploy, run on YOUR COMPUTER from the repo:
#
#   bash deploy/deploy.sh              build + push new images, then deploy them
#   bash deploy/deploy.sh --tag TAG    deploy images already in ECR (e.g. to roll back)
#
# Settings: deploy/deploy.env (copy deploy/deploy.env.example). It checks the
# code is committed and pushed (EC2 pulls the same commit for the compose
# file), builds with deploy/push-ecr.sh, then runs deploy/remote-deploy.sh on
# the instance over SSH: backup, new image tags in ec2.env, migrations,
# restart, health check.
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

TAG=""
while (($#)); do
  case "$1" in
    --tag) TAG="${2:?--tag needs a tag, e.g. 20261111T150000Z-abc1234}"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) fail "Unknown option: $1 (see --help)" ;;
  esac
done

[ -f deploy/deploy.env ] || fail "Create deploy/deploy.env first: cp deploy/deploy.env.example deploy/deploy.env"
set -a
# shellcheck disable=SC1091
. deploy/deploy.env
set +a
: "${EC2_HOST:?Set EC2_HOST in deploy/deploy.env}"
: "${AWS_REGION:?Set AWS_REGION in deploy/deploy.env}"
REMOTE_DIR="${REMOTE_DIR:-~/lifecairn}"
SSH_KEY="${SSH_KEY:-}"
SSH_KEY="${SSH_KEY/#\~/$HOME}"
SSH=(ssh -o ServerAliveInterval=30)
[ -n "${SSH_KEY:-}" ] && SSH+=(-i "$SSH_KEY")

step "Checking the code is committed and pushed"
[ -z "$(git status --porcelain)" ] || fail "You have uncommitted changes. Commit (or stash) them first."
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || fail "You're on '$branch'. Deploys go from main."
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main isn't the same as origin/main. Push (or pull) first."
echo "Commit $(git rev-parse --short HEAD): $(git log -1 --format=%s)"

step "Checking AWS and SSH access"
aws sts get-caller-identity --query Account --output text >/dev/null 2>&1 \
  || fail "The AWS CLI isn't logged in (aws sts get-caller-identity fails). Run aws sso login or aws configure."
"${SSH[@]}" -o ConnectTimeout=10 "$EC2_HOST" true || fail "Can't SSH to $EC2_HOST."
REPOSITORY_URI=$(aws ecr describe-repositories --region "$AWS_REGION" --repository-names "${ECR_REPOSITORY:-lifecairn}" \
  --query 'repositories[0].repositoryUri' --output text)

if [ -z "$TAG" ]; then
  : "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in deploy/deploy.env}"
  TAG="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
  step "Building and pushing images $TAG (takes a few minutes)"
  IMAGE_TAG="$TAG" bash deploy/push-ecr.sh
else
  step "Using existing images $TAG"
  aws ecr describe-images --region "$AWS_REGION" --repository-name "${ECR_REPOSITORY:-lifecairn}" \
    --image-ids "imageTag=$TAG" "imageTag=$TAG-tools" >/dev/null 2>&1 \
    || fail "ECR has no images tagged $TAG and $TAG-tools."
fi

step "Deploying on $EC2_HOST"
"${SSH[@]}" "$EC2_HOST" bash -s -- "$REMOTE_DIR" "$REPOSITORY_URI:$TAG" "$REPOSITORY_URI:$TAG-tools" "$AWS_REGION" \
  < deploy/remote-deploy.sh
