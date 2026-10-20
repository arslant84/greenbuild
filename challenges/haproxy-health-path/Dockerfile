FROM alpine:3.22

# haproxy balances two copies of the app; busybox httpd plays the app.
RUN apk add --no-cache haproxy busybox-extras curl

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
