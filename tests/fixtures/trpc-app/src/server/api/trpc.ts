import { initTRPC } from "@trpc/server";
export const t = initTRPC.context().create();
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ next }) => next());
