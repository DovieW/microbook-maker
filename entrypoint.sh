#!/bin/bash

nginx

pm2 start /app/be/index.js --name microbook-maker

tail -f ~/.pm2/logs/microbook-maker-out.log ~/.pm2/logs/microbook-maker-error.log