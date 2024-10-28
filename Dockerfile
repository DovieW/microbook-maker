FROM node:latest

EXPOSE 7777/tcp

WORKDIR /app

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
    npm install pm2 -g

COPY . .

RUN cp nginx.conf /etc/nginx/nginx.conf

WORKDIR /app/be

RUN npm install && chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]