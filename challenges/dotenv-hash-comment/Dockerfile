FROM node:22-alpine

# The webhook receiver loads its settings with dotenv; curl and openssl play the payment provider.
RUN apk add --no-cache curl openssl \
    && mkdir -p /opt/webhooks \
    && cd /opt/webhooks \
    && npm install --no-audit --no-fund --silent dotenv@16.4.5

COPY --chmod=0644 server.js /opt/webhooks/server.js
COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
