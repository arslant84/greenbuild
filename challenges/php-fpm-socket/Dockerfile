FROM nginx:1.29-alpine

# The app is PHP behind PHP-FPM, reached by nginx through a unix socket.
# The base image sends nginx logs to the console; real files are part of the puzzle.
RUN apk add --no-cache php84-fpm \
    && rm -f /var/log/nginx/access.log /var/log/nginx/error.log /etc/nginx/conf.d/default.conf \
        /etc/php84/php-fpm.d/www.conf \
    && mkdir -p /run/php-fpm /var/log/php-fpm \
    && sed -i -e 's|^;*pid = .*|pid = /run/php-fpm/php-fpm.pid|' \
        -e 's|^;*error_log = .*|error_log = /var/log/php-fpm/error.log|' /etc/php84/php-fpm.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
