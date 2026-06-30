FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 4000

# Start server
CMD ["npm", "start"]
