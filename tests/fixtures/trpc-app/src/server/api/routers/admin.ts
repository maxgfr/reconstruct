import { z } from "zod";
import { t, publicProcedure, protectedProcedure } from "../trpc";

// Same-file nested sub-router, mounted below at `audit`.
const auditRouter = t.router({
  log: publicProcedure.query(() => []),
});

// Uses the raw `t.router({...})` factory form (vs createTRPCRouter elsewhere).
export const adminRouter = t.router({
  stats: protectedProcedure.query(() => ({})),
  purge: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => input),
  events: publicProcedure.subscription(() => null),
  audit: auditRouter,
});
