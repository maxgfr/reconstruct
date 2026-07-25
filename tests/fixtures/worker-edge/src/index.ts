import { Hono } from "hono";

type Bindings = { SESSIONS: KVNamespace; UPLOADS: R2Bucket; LOG_LEVEL: string };

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/sessions/:id", async (c) => c.json(await c.env.SESSIONS.get(c.req.param("id"))));
app.post("/uploads", async (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Bindings) {
    await purgeExpiredSessions(env);
  },
  async queue(batch: MessageBatch, env: Bindings) {
    for (const msg of batch.messages) await handleMessage(msg, env);
  },
};
