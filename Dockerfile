FROM alpine:latest

RUN apk add --update nodejs npm nginx
RUN npm install pm2 -g

WORKDIR /app

COPY . .
COPY nginx.conf /etc/nginx/nginx.conf

WORKDIR /app/be

RUN npm install

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]