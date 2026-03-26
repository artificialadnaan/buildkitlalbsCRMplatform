FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/portal/package.json apps/portal/
RUN npm install
COPY packages/ packages/
COPY apps/portal/ apps/portal/
RUN npm run build --workspace=@buildkit/portal
WORKDIR /app/apps/portal
EXPOSE 3000
CMD ["npx", "serve", "dist", "-s", "-l", "3000"]
