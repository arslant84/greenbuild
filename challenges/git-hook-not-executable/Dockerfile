FROM alpine:3.22

# The git server: a bare repository whose post-receive hook deploys every push.
RUN apk add --no-cache git

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
