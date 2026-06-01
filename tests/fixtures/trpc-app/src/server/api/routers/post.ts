import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
export const postRouter = createTRPCRouter({
  feed: publicProcedure.query(() => []),
  create: publicProcedure.input(z.object({ title: z.string() })).mutation(({ input }) => input),
});
