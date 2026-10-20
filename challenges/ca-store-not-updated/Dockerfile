FROM nginx:1.29-alpine

# nginx plays the internal billing API over TLS; the sync job calls it with curl.
# The base image sends nginx logs to the console; real files are part of the puzzle.
RUN apk add --no-cache curl openssl ca-certificates \
    && rm -f /var/log/nginx/access.log /var/log/nginx/error.log /etc/nginx/conf.d/default.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
