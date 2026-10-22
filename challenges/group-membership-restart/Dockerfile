FROM alpine:3.22

# A small upload service in Python, writing into a directory shared with the thumbnailer.
RUN apk add --no-cache python3 curl

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
