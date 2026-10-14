
#!/usr/bin/env bash
# User-run only: builds locally and creates/pushes images to private AWS ECR.
set -euo pipefail

: "${AWS_REGION:?Set AWS_REGION to your ECR region}"
: "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?Set the Clerk publishable key for this release}"

ECR_REPOSITORY="${ECR_REPOSITORY:-lifecairn}"
IMAGE_TAG="${IMAGE_TAG:-$(date -u +%Y%m%dT%H%M%SZ)}"
PLATFORM="${PLATFORM:-linux/amd64}"
NEXT_BUILD_BUNDLER="${NEXT_BUILD_BUNDLER:-turbopack}"

if [[ ! "$IMAGE_TAG" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]] || (( ${#IMAGE_TAG} > 122 )); then
  printf 'Invalid IMAGE_TAG (maximum 122 characters, leaving room for -tools).\n' >&2
  exit 1
fi
case "$PLATFORM" in
  linux/amd64|linux/arm64) ;;
  *) printf 'PLATFORM must be linux/amd64 or linux/arm64.\n' >&2; exit 1 ;;
esac
case "$NEXT_BUILD_BUNDLER" in
  turbopack|webpack) ;;
  *) printf 'NEXT_BUILD_BUNDLER must be turbopack or webpack.\n' >&2; exit 1 ;;
esac

command -v aws >/dev/null || { printf 'Install and configure AWS CLI first.\n' >&2; exit 1; }
command -v docker >/dev/null || { printf 'Install Docker first.\n' >&2; exit 1; }
docker info >/dev/null
docker buildx version >/dev/null

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_PAGER=""
export AWS_PAGER
REPOSITORY_ERROR="$(mktemp)"
trap 'rm -f -- "$REPOSITORY_ERROR"' EXIT

# AWS_PROFILE, when set by the user, is honored by AWS CLI.
if ! REPOSITORY_URI="$(aws ecr describe-repositories \
  --region "$AWS_REGION" --repository-names "$ECR_REPOSITORY" \
  --query 'repositories[0].repositoryUri' --output text 2>"$REPOSITORY_ERROR")"; then
  if grep -q 'RepositoryNotFoundException' "$REPOSITORY_ERROR"; then
    printf 'Creating private ECR repository: %s\n' "$ECR_REPOSITORY"
    REPOSITORY_URI="$(aws ecr create-repository \
      --region "$AWS_REGION" --repository-name "$ECR_REPOSITORY" \
      --image-tag-mutability IMMUTABLE \
      --query 'repository.repositoryUri' --output text)"
  else
    cat "$REPOSITORY_ERROR" >&2
    exit 1
  fi
fi

REGISTRY="${REPOSITORY_URI%%/*}"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

APP_IMAGE="${REPOSITORY_URI}:${IMAGE_TAG}"
TOOLS_IMAGE="${REPOSITORY_URI}:${IMAGE_TAG}-tools"

printf 'Building and pushing %s for %s\n' "$APP_IMAGE" "$PLATFORM"
docker buildx build --platform "$PLATFORM" --target runner \
  --build-arg "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  --build-arg "NEXT_BUILD_BUNDLER=$NEXT_BUILD_BUNDLER" \
  --tag "$APP_IMAGE" --push "$REPO_ROOT"

printf 'Building and pushing matching database tools: %s\n' "$TOOLS_IMAGE"
docker buildx build --platform "$PLATFORM" --target tools \
  --tag "$TOOLS_IMAGE" --push "$REPO_ROOT"

# Verify both tags exist before reporting success.
aws ecr describe-images --region "$AWS_REGION" \
  --repository-name "$ECR_REPOSITORY" \
  --image-ids "imageTag=$IMAGE_TAG" "imageTag=${IMAGE_TAG}-tools" \
  --query 'imageDetails[].{Tags:imageTags,Digest:imageDigest}' --output table

printf '\nCopy these values into deploy/ec2.env on EC2:\n'
printf 'APP_IMAGE=%s\nTOOLS_IMAGE=%s\n' "$APP_IMAGE" "$TOOLS_IMAGE"
printf '\nUse the same Clerk publishable key on EC2 as used for this build.\n'
