FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/portal-api/package.json apps/portal-api/
RUN npm install
COPY packages/ packages/
COPY apps/portal-api/ apps/portal-api/
EXPOSE 3002
CMD ["npx", "tsx", "apps/portal-api/src/index.ts"]
