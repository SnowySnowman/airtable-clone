// src/server/api/routers/base.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
  getAllForUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { userId: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        tables: { select: { id: true, name: true } },
      },
    });
  }),
});
