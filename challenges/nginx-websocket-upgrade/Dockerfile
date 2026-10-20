FROM alpine:3.22

# nginx serves the page and proxies the live feed to a small websocket service in Python.
RUN apk add --no-cache nginx python3 py3-websockets curl \
    && rm -f /etc/nginx/http.d/default.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
