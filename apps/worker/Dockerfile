FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/worker/package.json apps/worker/
RUN npm install
COPY packages/ packages/
COPY apps/worker/ apps/worker/
CMD ["npx", "tsx", "apps/worker/src/index.ts"]
