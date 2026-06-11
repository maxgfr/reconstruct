import { Hono } from "hono";

const users = new Hono();

users.get("/", (c) => c.json([]));
users.post("/", (c) => c.json({}, 201));
users.get("/:id", (c) => c.json({ id: c.req.param("id") }));

export default users;
