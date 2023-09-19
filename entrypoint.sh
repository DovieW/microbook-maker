#!/bin/bash

fc-cache -fv

nginx

pm2 start /app/be/index.js --name mbm

pm2 logs mbm
