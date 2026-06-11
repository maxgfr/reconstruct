const fastify = require("fastify")({ logger: true });

fastify.get("/health", async () => ({ ok: true }));

fastify.route({
  method: "GET",
  url: "/version",
  handler: async () => ({ version: "1.0.0" }),
});

fastify.register(require("./routes/users"), { prefix: "/api/users" });
fastify.register(require("./routes/admin"), { prefix: "/admin" });

fastify.listen({ port: 3000 });
