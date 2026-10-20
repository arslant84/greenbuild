# Packet too big, still

## What was broken

The nightly import sends the document bundle, 3–6 MB, as one `INSERT`. MariaDB's `[mysqld]` section sets `max_allowed_packet = 1M` (DBA-219), so the server drops the connection: the import sees `ERROR 2006 (HY000): Server has gone away`, and the server logs `Aborted connection … (Got a packet bigger than 'max_allowed_packet' bytes)`.

Ops raised `max_allowed_packet` to 64M (OPS-1307), but under `[mysql]` in `/etc/my.cnf.d/import.cnf`. That section is read only by the `mariadb` client, and the client's own limit was never the problem: the server enforces its own.

## How to find it

- `/var/log/<app>/import.log`: "Server has gone away", which hides the cause.
- `/var/lib/mysql/*.err`: the aborted connection and its reason.
- `mariadb -e 'SELECT @@GLOBAL.max_allowed_packet'`: 1048576.
- `my_print_defaults mysqld` and `my_print_defaults mysql`, or `grep -rn max_allowed_packet /etc/my.cnf*`: which section sets what.

## The fix

Raise the server's limit where the server reads it, then restart:

```sh
sed -i 's/^max_allowed_packet = 1M$/max_allowed_packet = 64M/' /etc/my.cnf.d/mariadb-server.cnf
db-restart
```

## What not to do

- `SET GLOBAL max_allowed_packet`: it is lost on the next restart. The check restarts MariaDB first.
- The maximum (1G) "to be safe": every connection may then buffer that much. The check wants at most 256M.
- Splitting or editing the import: the check runs it as shipped and compares the stored bundle byte for byte.
