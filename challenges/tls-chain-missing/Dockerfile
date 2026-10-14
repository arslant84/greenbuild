FROM nginx:1.29-alpine

# openssl to work with certificates; curl and the CA tools are already in the image.
RUN apk add --no-cache openssl \
    && rm -f /var/log/nginx/access.log /var/log/nginx/error.log /etc/nginx/conf.d/default.conf

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
ENTRYPOINT []
CMD ["sleep", "infinity"]
