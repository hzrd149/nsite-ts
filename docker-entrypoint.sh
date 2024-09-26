#!/bin/sh

chown -R nginx:nginx /var/cache/nginx

exec "$@"
