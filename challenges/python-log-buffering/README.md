# The log lags behind

## What was broken

The worker used to run in a tmux session, where its stdout was a terminal and Python wrote every line at once. Since OPS-640 its start script runs it with `nohup … >> worker.log`. With stdout redirected to a file, Python buffers output in blocks of about 8 KB and writes only when a block fills. The log is silent for a minute or more, then gets a burst. When the worker is killed on restart, whatever was still buffered is lost.

## How to find it

- `tail -f /var/log/<app>/worker.log` while the worker runs: nothing for a long time, then a burst.
- `ls -l /proc/<pid>/fd/1`: the worker's stdout is the log file, not a terminal.
- `/var/log/ops.log` and the start script: what changed in how it runs.
- The old lines at the top of the log: before the move, every job was logged.

## The fix

Run the worker unbuffered from its start script, then restart it:

```sh
sed -i 's#nohup python3 /opt/#nohup env PYTHONUNBUFFERED=1 python3 /opt/#' /usr/local/bin/<app>-worker
<app>-worker restart
```

`python3 -u` in the script, or `print(..., flush=True)` in the worker, works too.

## What not to do

- Setting `PYTHONUNBUFFERED` in `/etc/profile` or a login shell: the start script's `su -c` does not read it.
- Running the worker by hand in a terminal: it is no longer started by its script and stops with your session.
- Running the worker as root.
