# Compile Next.js on the builder's native CPU, even when targeting EC2 on x86.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Runtime dependencies must match the target CPU, not the build machine.
FROM node:22-bookworm-slim AS runtime-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS tools
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY drizzle.config.ts ./
COPY src/db/schema.ts ./src/db/schema.ts
CMD ["npm", "run", "db:push"]

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_BUILD_BUNDLER=turbopack
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && \
    case "$NEXT_BUILD_BUNDLER" in \
      turbopack) npm run build ;; \
      webpack) npm run build -- --webpack ;; \
      *) echo "NEXT_BUILD_BUNDLER must be turbopack or webpack" >&2; exit 1 ;; \
    esac
# The traced dependencies contain native build-CPU binaries. Replace them with
# the target-CPU production install in the runner instead of shipping them.
RUN rm -rf .next/standalone/node_modules

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
