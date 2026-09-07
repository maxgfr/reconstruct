# Compare exercised behavior

Use after a rebuild exists, separately from the PRD/source-faithfulness ledgers.
Confirm both local directories and read every executable/argument before asking
for explicit execution authorization. Programs run with the user's privileges;
this is not a sandbox. Use self-terminating test drivers, not persistent services.

Write a local fixture:

```json
{
  "schemaVersion": 1,
  "cases": [{
    "id": "uppercase",
    "stdin": "hello",
    "original": {"command": "node", "args": ["main.mjs"]},
    "rebuilt": {"command": "node", "args": ["main.mjs"]},
    "timeoutMs": 5000
  }]
}
```

Both commands get the same stdin, using their respective tree as working
directory. Argument arrays are passed directly without shell interpolation.
Declare representative happy paths, failure paths and boundaries explicitly;
the engine does not discover cases or install dependencies.

```sh
node scripts/analyze.mjs --compare cases.json --original ./original --rebuilt ./rebuilt --json
# Above validates the fixture but executes nothing; not-tested, exit 1.
# Only after explicit authorization:
node scripts/analyze.mjs --compare cases.json --original ./original --rebuilt ./rebuilt --run-tests --json
```

Retain stdout JSON as the report. It includes the fixture SHA-256, resolved
trees, execution time, per-case `passed`/`failed`/`not-tested`, commands and
bounded observations. `stdoutBase64`/`stderrBase64` preserve exact bytes; the
plain text fields are previews. Exit 0 requires every case to match byte-for-byte
on stdout and stderr and both exits to equal 0. An explicit `expectedExitCode`
(integer 0–255) permits a matching negative case. Identical crashes or missing
commands cannot pass. Timeouts and output overflow fail even when both match.

Limits: fixture at most 1 MiB; 1–100 cases with unique nonempty IDs; stdin at
most 64 KiB per case; 64 KiB captured bytes per output stream; timeout 1–600000 ms
per command (default 5000). Cases run sequentially; each command may create
side effects. On POSIX the runner terminates the command's own process group,
including ordinary children; detached descendants and Windows process trees are
not supervised.
Prepare deterministic, isolated test state yourself. No global equivalence,
side-effect comparison, network trace, timing or UI fidelity is inferred. Name
the exercised case IDs and remaining untested behavior in the handoff. A green
comparison does not replace `--check --semantic` or its independent ledgers.
