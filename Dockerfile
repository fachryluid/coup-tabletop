FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY app ./app
COPY domain ./domain
COPY server ./server
COPY public ./public
COPY tsconfig.json next-env.d.ts ./
RUN npm run build && npm prune --omit=dev && rm -rf .next/cache

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app/package.json /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/app ./app
COPY --from=build /app/server ./server
COPY --from=build /app/domain ./domain
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
CMD ["node","--import","tsx","server/index.ts","--production"]
