# The config that looks fine

## What was broken

The upload limit was raised in `/etc/<app>/config.json` with Windows Notepad, which saved the file as "UTF-8 with BOM": three bytes, `EF BB BF`, before the `{`. Editors and `cat` hide them, so the file looks valid. Python's `json` module refuses them: the app stops at start with `json.decoder.JSONDecodeError: Unexpected UTF-8 BOM (decode using utf-8-sig): line 1 column 1 (char 0)`.

## How to find it

- `/var/log/<app>/app.log`: the traceback and its last line.
- `head -c 8 /etc/<app>/config.json | od -c` shows `357 273 277 {`; `file` would say "with BOM".
- `config.json.bak` is the version from before the edit, with the old 10 MB limit.

## The fix

```sh
cd /etc/<app> && tail -c +4 config.json > config.new && cat config.new > config.json && rm config.new
<app>-start
```

GNU `sed -i '1s/^\xEF\xBB\xBF//'` does the same, but this host's busybox `sed` does not understand `\x` escapes and silently changes nothing; check the first bytes again after any fix.

## What not to do

- Restoring `config.json.bak`: the app starts, but with the old 10 MB limit; the check asks for 50.
- Changing the app to read `utf-8-sig`: it hides the problem in this one app, and every other tool reading the file still trips over it.
