# Module diagram

```mermaid
graph TD
  F0["Core"]
  F1["Project Setup & Tooling"]
  F2["Prisma"]
  F3["API"]
  F4["Internationalization"]
  F5["Dashboard"]
  F6["Documentation"]
  DATA[("Data / i18n / schema")]
  F0 --> DATA
  F1 --> DATA
  F2 --> DATA
  F3 --> DATA
```
