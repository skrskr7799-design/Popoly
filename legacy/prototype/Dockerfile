# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Runtime — static files only, no nginx
FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# Bind all interfaces so phones on the same Wi‑Fi can open the published host port
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
