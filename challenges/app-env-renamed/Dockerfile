FROM nginx:1.29-alpine

# busybox httpd plays the company app.
# The base image sends nginx logs to the console; real files are part of the puzzle.
RUN apk add --no-cache busybox-extras \
    && rm -f /var/log/nginx/access.log /var/log/nginx/error.log /etc/nginx/conf.d/default.conf

COPY --chmod=0755 appctl /usr/local/bin/appctl
COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
