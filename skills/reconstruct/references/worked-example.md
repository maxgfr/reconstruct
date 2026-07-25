# Worked example — the depth bar

Everything else in this skill *describes* what a finished PRD looks like. This file **shows**
it, then names the ways a PRD looks finished and is not.

The example is deliberately small: one feature, "Public contact form" — an anonymous visitor
sends a message to a listed professional. It is the running example of
[`ai-review-rubric.md`](./ai-review-rubric.md) because it contains the single failure that most
often makes a faithful-looking PRD impossible to build: an **unsatisfiable write contract**.

---

## Part 1 — shallow vs deep, section by section

Both columns pass `--check`. Only the right-hand one survives the AI review, and only it can be
rebuilt correctly by an agent that never saw the original.

### User stories

| ❌ Shallow — passes `--check` | ✅ Deep |
| --- | --- |
| `- As a visitor, I can contact a professional.` | `- As an anonymous visitor, I can send a message to a listed professional so that I can ask a question before booking.`<br>`- As an anonymous visitor, I see my message was delivered so that I do not send it twice.`<br>`- As an anonymous visitor with a malformed email, I am told which field is wrong so that I can fix it.`<br>`- As an abusive visitor, my repeated submissions are throttled so that the professional is not spammed.`<br>`- As a listed professional, I receive the message by email so that I can reply directly.`<br>`- As a listed professional whose profile is unpublished, I receive nothing so that a delisted profile stops generating contact.`<br>`- As the notification job (system actor), I retry a failed send so that a transient provider outage does not silently drop a message.` |

What changed: every **actor** — including the anonymous visitor, the failure-path visitor, the
abusive visitor, and the **system actor** — has a story. The shallow version has one actor and
one happy path.

### Functional requirements

| ❌ Shallow | ✅ Deep |
| --- | --- |
| `- The form validates input and sends an email.`<br>`- Handles errors, rate limiting, etc.` | `1. [confirmed] The form accepts exactly four fields: professional slug (from the URL), sender name, sender email, message body.`<br>`2. [confirmed] senderName: 2–80 chars after trim; rejected with 400 otherwise.`<br>`3. [confirmed] senderEmail: must match the RFC-5322 subset the app uses, max 254 chars; rejected with 400 otherwise.`<br>`4. [confirmed] message: 20–2000 chars after trim; rejected with 400 otherwise.`<br>`5. [confirmed] The slug resolves to a published professional server-side; an unknown or unpublished slug returns 404 and writes nothing.`<br>`6. [confirmed] A valid submission inserts exactly one row into `contactRequests` and returns 201 with `{ id }`.`<br>`7. [confirmed] After the insert commits, a notification email is enqueued to the professional. Enqueue failure does NOT fail the request (best-effort).`<br>`8. [confirmed] Rate limit: 3 submissions per 10 minutes per client IP; the 4th returns 429 with `Retry-After` in seconds and writes nothing.`<br>`9. [inferred] Submissions are not deduplicated; two identical messages create two rows.` |

What changed: **numbered, atomic, testable**. Every validation rule carries its *actual* bound.
Every error state names its status code. The `[confirmed]`/`[inferred]`/`[gap]` tags let the
`--verify` pass adjudicate confidence quickly. "Etc." is gone — it is never a requirement, it is
a hole.

### Acceptance criteria

| ❌ Shallow | ✅ Deep |
| --- | --- |
| `- [ ] The contact form works correctly.` | `**AC-1 (FR-6) happy path**`<br>`Given a published professional with slug "dr-martin"`<br>`When an anonymous visitor POSTs a valid name, email and 50-char message`<br>`Then the response is 201 with { id }, and exactly one contactRequests row exists with professionalId resolved from the slug.`<br><br>`**AC-2 (FR-4) validation failure**`<br>`Given the same professional`<br>`When the message body is 19 characters`<br>`Then the response is 400 naming the "message" field, and NO contactRequests row is written.`<br><br>`**AC-3 (FR-5) unknown target**`<br>`Given no professional with slug "nobody"`<br>`When an anonymous visitor POSTs an otherwise valid payload`<br>`Then the response is 404 and NO row is written.`<br><br>`**AC-4 (FR-8) rate limit**`<br>`Given one IP that has submitted 3 times in the last 10 minutes`<br>`When it submits a 4th time`<br>`Then the response is 429 with Retry-After, and NO row is written.`<br><br>`**AC-5 (FR-7) best-effort notification**`<br>`Given the email provider returns 503`<br>`When a valid submission is made`<br>`Then the response is still 201, the row exists, and the failure is logged.` |

What changed: one scenario **per requirement**, each with concrete data, and **the failure paths
are first-class**. "Works correctly" is not testable; `Then 400 and NO row is written` is.

Note the pattern in every negative case: **state what is *not* written.** A criterion that only
asserts the status code lets a rebuild leave partial rows behind.

---

## Part 2 — the write contract (the section most often missing)

This is the one that decides whether the feature can be built at all.

```markdown
### Write contract

`POST /api/professionals/:slug/contact` writes **one** row to `contactRequests`.
Single insert — no transaction needed (no second write).

| Column | Type | Required | Source |
| --- | --- | --- | --- |
| `id` | uuid | yes | DB default `gen_random_uuid()` |
| `professionalId` | uuid FK → `professionals.id` | yes | **resolved server-side from the URL slug** — never client input |
| `senderName` | text | yes | request body, validated per FR-2 |
| `senderEmail` | text | yes | request body, validated per FR-3 |
| `message` | text | yes | request body, validated per FR-4 |
| `status` | enum `ContactRequestStatus` | yes | literal `PENDING` on insert |
| `createdAt` | timestamptz | yes | DB default `now()` |

**Anonymous-capability check:** `contactRequests` has **no owner FK** — no column requires a
logged-in user's identity. `professionalId` is a *recipient* FK, resolved server-side, so an
anonymous caller can satisfy every required column. ✅
```

**Why this matters.** The original version of this PRD listed `professionalId` as a required
*input*. An anonymous visitor has no way to know a UUID — the form only has a slug. The feature
was structurally unbuildable, and no amount of prose polish would have revealed it. The write
contract is what makes that visible in one read.

The rule, from [`buildability-checklist.md`](./buildability-checklist.md) §4: **a public or
anonymous operation must write to an anonymous-capable entity.** If it needs an owner identity
it cannot have, the design is wrong, not the wording.

---

## Part 3 — enums are enumerated, never named

```markdown
## Enums & domain types

### ContactRequestStatus
`PENDING` · `NOTIFIED` · `FAILED` · `SPAM`

- `PENDING` — inserted, notification not yet enqueued.
- `NOTIFIED` — notification email accepted by the provider.
- `FAILED` — provider rejected after the retry budget; needs manual follow-up.
- `SPAM` — flagged by moderation; never notified.
```

A column typed `enum` whose members are not listed is **not buildable**: you cannot write the
test "an unknown value is rejected" without knowing the known values.

---

## Part 4 — edge cases are enumerated, not gestured at

```markdown
## Edge cases & failure modes

| Case | Expected behaviour |
| --- | --- |
| Message is exactly 20 / exactly 2000 chars | Accepted (bounds inclusive) |
| Message is whitespace-padded to reach 20 | Rejected — length is measured after trim |
| Email is 255 chars | Rejected 400 |
| Slug exists but profile is unpublished | 404, nothing written (same shape as unknown slug — do not leak existence) |
| Two identical submissions in a row | Both accepted — no dedup (FR-9) |
| Email provider times out | 201 returned, row is PENDING, retry handled by the job |
| Email provider fails past the retry budget | Row moves to FAILED; no user-visible effect |
| Rate limiter store is unreachable | Fail **open** (accept the submission) and log — availability over throttling |
| Concurrent submissions from one IP crossing the limit | Limiter is atomic; exactly 3 succeed |
```

Each row maps to an error-path requirement above. Note the last three: **failure of the
supporting infrastructure** is a case, and "fail open vs fail closed" is a decision the rebuild
cannot guess.

---

## Part 5 — the anti-pattern catalogue

Learn to spot these in your own output. Each one is a PRD that looks done and is not.

| Anti-pattern | Looks like | Why it fails | Fix |
| --- | --- | --- | --- |
| **Named, not specified** | "validates the registration number", "rate-limited", "sends a welcome email" | The reader cannot implement a name. The single most common cause of an unbuildable PRD. | Give the rule: the regex, the threshold + window + key, the exact function signature and payload. |
| **Happy-path only** | Acceptance criteria that all start from a valid request | Half the behaviour — validation, auth, conflicts, outages — is unspecified. | One scenario per failure path, each stating what is *not* written. |
| **"Etc." / "and so on" / "…"** | "handles errors, edge cases, etc." | It is a hole wearing a hat. Whatever "etc." hides will not be built. | Enumerate. If the list is genuinely open-ended, say what the *rule* is. |
| **Enum without members** | "`status` is an enum" | Untestable — you cannot reject an unknown value. | Full member list, once, in `## Enums & domain types`. |
| **"Same as the original"** | "behaves like the current implementation" | The rebuild has **no access** to the original. This is the whole premise of the skill. | Read the source and write down what it does. |
| **Unsatisfiable write** | An anonymous operation writing a row with an owner FK | Structurally impossible; discovered only at build time. | Anonymous-capable entity, or resolve the FK server-side and say so. |
| **Stories copy-pasted per role** | "As an admin, I can view X" × 6 roles, no differences | Roles that behave identically are one story; roles that differ need their *differences* stated. | Merge the identical, spell out the different (what each role sees/cannot do). |
| **Un-numbered wall of prose** | A paragraph describing behaviour | Nothing to trace an acceptance criterion or a test to. Also invisible to `--verify`, which harvests **list items** only. | Numbered atomic list items. |
| **Contradicting the architecture doc** | Feature says `email: string?`, `DATA-MODEL.md` says NOT NULL | The rebuild picks one and is wrong half the time. | Reconcile against source; fix the shared doc first. |
| **Invented completeness** | Confident specifics the source never states | Faithfulness failure — `--verify` will mark it `unsupported`. | Tag it `[inferred]` or `[gap]`, or leave it in `unknowns`. Never guess in the PRD's voice. |

---

## The self-test

> Could a fresh agent rebuild this unit **correctly** — getting the contracts right, not just
> the gist — from this PRD plus the architecture docs alone, with no access to the original
> product and no access to the conversation that produced it?

If the honest answer is no, name the single biggest reason and fix that. The shallow column in
Part 1 fails this test on every section; the deep column passes on all of them.
