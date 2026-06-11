module.exports = async (fastify) => {
  fastify.delete("/cache", async () => ({ cleared: true }));
};
