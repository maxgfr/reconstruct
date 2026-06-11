async function routes(fastify, opts) {
  fastify.get("/", async () => []);
  fastify.post("/", async (req) => req.body);
  fastify.route({
    method: ["GET", "DELETE"],
    url: "/:id",
    handler: async (req) => ({ id: req.params.id }),
  });
}

module.exports = routes;
