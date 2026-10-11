FROM postgres:17-alpine

# The cluster is created at build time outside the image's VOLUME, so it ships with the image.
ENV PGDATA=/var/lib/postgresql/17/main
RUN mkdir -p "$PGDATA" /var/log/postgresql \
    && chown -R postgres:postgres /var/lib/postgresql/17 /var/log/postgresql \
    && su postgres -c "initdb -D $PGDATA --auth=trust" > /dev/null

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
