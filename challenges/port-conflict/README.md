# Maintenance never ended

## What was broken

During yesterday's migration someone kept a maintenance page up on the app's port with a small loop, `while true; do httpd ...; sleep 2; done`, started with `nohup` and forgotten. When maintenance ended, the loop was still running. The app could not bind its port (`bind: Address in use` in its log), and nginx, which proxies to that port, served the maintenance page instead.

## How to find it

- The site answers 200, but with "Down for maintenance", so nginx is fine and something else answers on the app's port.
- The app's log in `/var/log/<app>/` ends with a bind error.
- `netstat -ltnp` shows the app's port held by an `httpd` serving `/srv/maintenance/www`.
- Kill it, and `ps -ef` soon shows it again: its parent is `sh /root/maintenance.sh`.

## The fix

```sh
pkill -f /root/maintenance.sh                # the loop first, or it restarts the server
pkill -f 'httpd .*-h /srv/maintenance/www'
appctl start
```

## What not to do

- Killing only the maintenance `httpd`: the loop brings it back within seconds, and the app loses the race again on its next restart.
- Moving the app to another port: nginx, the firewall and anything else pointing at the port would all have to follow, and the stray loop stays.
- Leaving temporary loops behind: give them an owner and an end, e.g. `timeout 2h ...`, or a unit you can stop.
