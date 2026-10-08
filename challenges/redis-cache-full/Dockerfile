FROM redis:7.4-alpine

RUN mkdir -p /etc/redis /var/log/redis /var/log/warmer && chown redis:redis /var/log/redis /var/log/warmer
# The base image works from its /data VOLUME; under gVisor, files copied in for the check were not
# visible then, so the sandbox works from / like the other challenges.
WORKDIR /

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
