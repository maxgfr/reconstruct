# assets/

`example-output/` is a sample `reconstruction/` tree generated from
`tests/fixtures/sample-app` with `--mode redesign --level complex --fidelity describe`.
It shows the shape of the output (overview, architecture, per-feature PRDs, copied
ground-truth data) before an agent enriches the `🧠` callouts.

Regenerate with:

```bash
node scripts/analyze.mjs --repo tests/fixtures/sample-app \
  --out assets/example-output --mode redesign --level complex --fidelity describe
```
