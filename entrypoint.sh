#!/bin/bash

nginx

pm2 start /app/be/index.js --name mbm

pm2 logs mbm
