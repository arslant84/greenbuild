FROM alpine:3.22

# nginx in front of php-fpm, each pool running as its app's user.
RUN apk add --no-cache nginx php83 php83-fpm curl \
    && rm -f /etc/nginx/http.d/default.conf /etc/php83/php-fpm.d/www.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
