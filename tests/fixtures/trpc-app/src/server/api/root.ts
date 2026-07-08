import { createTRPCRouter } from "./trpc";
import { userRouter } from "./routers/user";
import { postRouter } from "./routers/post";
import { adminRouter } from "./routers/admin";
export const appRouter = createTRPCRouter({ user: userRouter, post: postRouter, admin: adminRouter });
export type AppRouter = typeof appRouter;
