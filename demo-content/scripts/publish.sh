#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-staging}
REGISTRY="registry.acme.example"
IMAGE="$REGISTRY/acme-docs"
TAG=$(git rev-parse --short HEAD)

echo "Building docs site for environment: $ENVIRONMENT"
echo "Image: $IMAGE:$TAG"

# Run type checks and lint before building
npm run typecheck
npm run lint

# Build the Next.js app
npm run build

# Build and push the Docker image
docker build -t "$IMAGE:$TAG" -t "$IMAGE:latest" .
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

# Deploy to the target environment
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "Deploying to production…"
  kubectl set image deployment/acme-docs app="$IMAGE:$TAG" \
    --namespace production
  kubectl rollout status deployment/acme-docs --namespace production
else
  echo "Deploying to staging…"
  kubectl set image deployment/acme-docs app="$IMAGE:$TAG" \
    --namespace staging
  kubectl rollout status deployment/acme-docs --namespace staging
fi

echo "Deployment complete: $IMAGE:$TAG → $ENVIRONMENT"
