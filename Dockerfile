# Use the latest Node image
FROM node:latest

# Expose port 80
EXPOSE 7777/tcp

# Set working directory
WORKDIR /app

# Copy all files into the image
COPY . .

# Update packages and install dependencies
RUN apt-get update && \
    apt-get install -y nginx \
    libx11-xcb1 \
    libxrandr2 \
    libgconf-2-4 \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxss1 \
    libxcomposite1 \
    libgtk-3-0 \
    chromium \
    --no-install-recommends && \
    npm install pm2 -g && \
    cp nginx.conf /etc/nginx/nginx.conf && \
    npm install

# Switch to your backend directory
WORKDIR /app/be

# Install npm packages and make entrypoint.sh executable
RUN npm install && chmod +x /app/entrypoint.sh

# Set the entrypoint
ENTRYPOINT [ "/app/entrypoint.sh" ]
