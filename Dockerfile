FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest and build
COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
