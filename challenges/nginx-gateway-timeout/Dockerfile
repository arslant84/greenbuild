FROM python:3.13-alpine

# The site: nginx in front of the app. Its logs go to real files, part of the puzzle.
RUN apk add --no-cache nginx \
    && rm -f /etc/nginx/http.d/default.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
