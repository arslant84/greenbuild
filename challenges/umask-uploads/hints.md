# Hints

## Hint 1

nginx's error log in `/var/log/nginx/` says why it refuses the new files. Compare `ls -l` of an old upload with a new one: who may read each, and who does nginx run as?

## Hint 2

The files are created by the service that moves uploads from the spool into the store. A process's umask decides which permission bits its new files do not get. What changed in the service's settings on Tuesday?

## Hint 3

Fixing today's files is half the job: the service is still running with the old umask, so the next upload breaks again. Give it a umask that keeps files readable by nginx but not writable by others, restart it, then fix the files it already stored.
