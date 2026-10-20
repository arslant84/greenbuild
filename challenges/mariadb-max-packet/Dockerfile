FROM alpine:3.22

RUN apk add --no-cache mariadb mariadb-client

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
