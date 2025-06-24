// import { z } from "zod";
// import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// export const baseRouter = createTRPCRouter({
//   getAllForUser: protectedProcedure.query(async ({ ctx }) => {
//     return ctx.db.base.findMany({
//       where: { userId: ctx.session.user.id },
//       select: {
//         id: true,
//         name: true,
//         tables: { select: { id: true, name: true } },
//       },
//       orderBy: { createdAt: "desc" },
//     });
//   }),
// });

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { z } from "zod";

export const baseRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      include: {
        tables: true,
      },
      where: {
        userId: ctx.session.user.id,
      },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newBase = await ctx.db.base.create({
        data: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });

      return newBase;
    }),
    getOne: protectedProcedure
        .input(z.object({ baseId: z.string() }))
        .query(async ({ ctx, input }) => {
        return ctx.db.base.findUnique({
            where: { id: input.baseId },
            include: { tables: true },
        });
    }),
});
