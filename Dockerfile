# Generated by https://smithery.ai. See: https://smithery.ai/docs/config#dockerfile
# Use the official Node.js image as the base image
FROM node:20-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and pnpm-lock.yaml to the working directory
COPY package.json pnpm-lock.yaml ./

# Install pnpm package manager
RUN npm install -g pnpm

# Install project dependencies
RUN pnpm install

# Copy the rest of the application files
COPY . .

# Build the project
RUN pnpm build

# Use a smaller image for the runtime
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the built files from the builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=builder /app/node_modules /app/node_modules

# Expose the port the app runs on
EXPOSE 3000

# Set environment variable for SerpAPI key
ENV SERPAPI_KEY=your-serpapi-api-key

# Command to run the application
ENTRYPOINT ["node", "dist/index.js"]