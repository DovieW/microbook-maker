#!/bin/bash

cd /app/be

pm2 start --name microbook-maker

tail -f ~/.pm2/logs/microbook-maker-out.log ~/.pm2/logs/microbook-maker-error.log