FROM alpine:3.22

# The app is deployed as a git checkout that the deploy job pulls.
RUN apk add --no-cache git

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
