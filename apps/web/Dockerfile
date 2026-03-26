FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/web/package.json apps/web/
RUN npm install
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm run build --workspace=@buildkit/web

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 3000
CMD ["serve", "dist", "-s", "-l", "3000"]
