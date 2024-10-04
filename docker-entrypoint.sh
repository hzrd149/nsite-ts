#!/bin/sh

echo Changing permission on volumes
chown -R nsite:nsite /var/cache/nginx
chown -R nsite:nsite /screenshots

exec "$@"
