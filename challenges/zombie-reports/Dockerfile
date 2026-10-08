FROM alpine:3.22

# tini is PID 1, as an init is on a server: it reaps processes whose parent has died.
RUN apk add --no-cache tini \
    && adduser -D -H -s /sbin/nologin reports \
    && mkdir -p /var/log/reports && touch /var/log/reports/queue.log && chown -R reports:reports /var/log/reports

COPY --chmod=0755 report-scheduler nightly-report render-region cache-warmup /usr/local/bin/
COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sleep", "infinity"]
