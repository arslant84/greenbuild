# Library not found after the upgrade

## What was broken

pricer 4.1 came as a package that put `libpricer.so.1` in `/usr/local/lib`, where the loader looks by default. The 4.2 upgrade (VEND-77) came as a tarball unpacked into `/opt/vendor/pricer-4.2`, and the 4.1 package was removed. The library is now only in `/opt/vendor/pricer-4.2/lib`, which the loader never searches: `Error loading shared library libpricer.so.1: No such file or directory`.

The second trap is in the fix. Alpine uses musl, whose loader reads its search path from `/etc/ld-musl-<arch>.path` (there is no `ldconfig` cache). That file replaces the default path. Listing only the vendor directory makes the pricer start, and then `curl` and every other program that needs `/usr/lib` stop starting.

## How to find it

- `/var/log/<app>/prices.log`: the loader's error.
- `ls -l /opt/vendor/bin/pricer` and `find / -name 'libpricer*'`: where the library actually is.
- `/var/log/ops.log`: how 4.1 and 4.2 were installed.
- `ls /lib/ld-musl-*`: the loader's name, which gives the path file's name.

## The fix

```sh
printf '/lib\n/usr/local/lib\n/usr/lib\n/opt/vendor/pricer-4.2/lib\n' > /etc/ld-musl-x86_64.path
```

A symlink to the library in `/usr/local/lib` also works.

## What not to do

- Only the vendor directory in the path file: the host's other programs lose `/usr/lib`. The check runs `curl`.
- `LD_LIBRARY_PATH` in the job or in a profile: it hides the problem from everything else that runs the pricer. The check runs the job as shipped, in a clean environment.
- Copying the library into `/usr/lib`: the next vendor upgrade leaves a stale copy behind.
