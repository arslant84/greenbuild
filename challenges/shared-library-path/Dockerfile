FROM alpine:3.22 AS vendor

# The vendor's pricer 4.2 as its tarball ships it: a binary and the shared library it needs.
RUN apk add --no-cache gcc musl-dev
RUN echo 'const char *pricer_version(void) { return "pricer 4.2"; }' > lib.c \
    && echo '#include <stdio.h>' > main.c \
    && echo 'const char *pricer_version(void);' >> main.c \
    && echo 'int main(void) { puts(pricer_version()); return 0; }' >> main.c \
    && gcc -shared -fPIC -Wl,-soname,libpricer.so.1 -o libpricer.so.1 lib.c \
    && gcc -o pricer main.c -L. -l:libpricer.so.1

FROM alpine:3.22

# curl stands for every other program on the host that needs the system's own libraries.
RUN apk add --no-cache curl
COPY --from=vendor /pricer /opt/vendor/pricer-4.2/bin/pricer
COPY --from=vendor /libpricer.so.1 /opt/vendor/pricer-4.2/lib/libpricer.so.1

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
