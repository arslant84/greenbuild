# Writing a challenge

A challenge is a folder in `challenges/` (see "Спецификация задания" in `docs/architecture.md`). There is no human review (owner's decision D3): a challenge is accepted when CI passes. CI checks what a machine can; the rest of this checklist is the author's responsibility.

## The folder

`challenge.yaml`, `Dockerfile`, `setup.sh`, `check.sh`, `solution.sh`, `hints.md`, `README.md`. Start `challenge.yaml` with `# yaml-language-server: $schema=../../packages/challenge-spec/challenge.schema.json` so your editor checks it while you type.

## Checklist

| # | Rule | Who checks it |
|---|---|---|
| 1 | One problem per challenge; its cause is found in the environment's logs and configs, not in the statement | Author |
| 2 | The seed changes what the player has to find (ports, names, paths) | CI, when `randomize` is set: different seeds must leave different files after setup |
| 3 | An experienced engineer solves it in 3–10 minutes | Author; `time_limit_sec` must be 60–7200 (CI) |
| 4 | `check.sh` checks the outcome, not the method, and rejects workarounds (e.g. deleting the service) | Author; CI proves it fails after setup and passes after `solution.sh` |
| 5 | Hints go from general to specific and none contains a ready command | Author; CI checks the `## Hint N` count matches `hints` |
| 6 | `README.md` explains the cause and how to find it | Author |
| 7 | The image never contains `check.sh` or `solution.sh` | CI: no file of either name may exist in the image |

## Run the checks locally

```sh
pnpm challenges:validate                                      # every folder: files, manifest, id, hint count
bash challenges/verify-challenge.sh challenges/<id>           # setup → check fails → solution → check passes, 3 seeds
```

Pass a path relative to the repository: on Windows Git Bash, absolute paths do not reach `docker build`. CI runs the same script under gVisor for every challenge folder a pull request changes.

## Changing a published challenge

Never edit a published version. Copy the change into a new version (`version: N+1`); `db:seed` refuses a version whose `challenge.yaml` or `check.sh` changed after it was published.
