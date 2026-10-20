FROM alpine:3.22

# dropbear plays the archive host (OpenSSH's sshd needs chroot, which sandboxes do not get); the OpenSSH
# client is what the job uses, with its usual host key checks.
RUN apk add --no-cache dropbear openssh-client

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
