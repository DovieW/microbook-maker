FROM nginx:latest

EXPOSE 80/tcp

COPY . .

WORKDIR /app

RUN apk add --update nodejs npm nginx openrc &&\
    npm install pm2 -g &&\
    cp nginx.conf /etc/nginx/nginx.conf

WORKDIR /app/be

RUN npm install && chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]