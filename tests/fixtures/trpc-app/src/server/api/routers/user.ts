import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
export const userRouter = createTRPCRouter({
  list: publicProcedure.query(() => []),
  byId: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => input),
  update: protectedProcedure.input(z.object({ id: z.string(), name: z.string() })).mutation(({ input }) => input),
});
