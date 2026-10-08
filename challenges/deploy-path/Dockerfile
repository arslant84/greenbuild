FROM nginx:1.29-alpine

# The base image sends nginx logs to the console; real files are part of the puzzle.
RUN rm -f /var/log/nginx/access.log /var/log/nginx/error.log /etc/nginx/conf.d/default.conf

COPY --chmod=0755 deploy /usr/local/bin/deploy
COPY --chmod=0755 notify /opt/deploy/bin/notify
COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
