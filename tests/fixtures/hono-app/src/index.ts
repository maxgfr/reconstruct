import { Hono } from "hono";
import users from "./users";

const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.on("PURGE", "/cache", (c) => c.json({ cleared: true }));

app.route("/users", users);

export default app;
