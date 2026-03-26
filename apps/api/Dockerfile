FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/api/package.json apps/api/
RUN npm install
COPY packages/ packages/
COPY apps/api/ apps/api/
EXPOSE 3001
CMD ["npx", "tsx", "apps/api/src/index.ts"]
