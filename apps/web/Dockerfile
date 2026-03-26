FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY apps/web/package.json apps/web/
RUN npm install
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm run build --workspace=@buildkit/web
EXPOSE 3000
CMD ["npx", "serve", "apps/web/dist", "-s", "-l", "3000"]
