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

  // create: protectedProcedure
  //   .input(
  //     z.object({
  //       name: z.string().min(1),
  //     })
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     try {
  //       console.log("Creating base for user:", ctx.session?.user?.id);
  //       const newBase = await ctx.db.base.create({
  //         data: {
  //           name: input.name,
  //           userId: ctx.session.user.id,
  //         },
  //       });
  //       return newBase;
  //     } catch (error) {
  //       console.error("❌ Error in base.create:", error);
  //       throw error; // re-throw so you still get the error client-side
  //     }
  //   }),
  create: protectedProcedure
  .input(z.object({ name: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.session.user.id;

      const newBase = await ctx.db.base.create({
        data: {
          name: input.name,
          userId,
          tables: {
            create: [
              {
                name: "Untitled Table",
                columns: {
                  create: [
                    { name: "name", type: "TEXT", order: 0 },
                    { name: "age", type: "NUMBER", order: 1 },
                  ],
                },
                rows: {
                  create: Array.from({ length: 5 }).map(() => ({
                    values: {
                      name: "",
                      age: null,
                    },
                  })),
                },
                views: {
                  create: [
                    {
                      name: "Grid view",
                      config: {
                        filters: [],
                        sort: [],
                        hiddenColumns: [],
                        search: "",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          tables: true,
        },
      });

      return newBase;
    } catch (error) {
      console.error("❌ Error in base.create:", error);
      throw error;
    }
  }),



  getOne: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.base.findUnique({
        where: { id: input.baseId },
        include: {
          tables: {
            // include: {
            //   columns: true,
            //   rows: true,
            // },
          },
        },
      });
    }),

  updateName: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.base.update({
        where: { id: input.baseId },
        data: { name: input.name },
      });
    }),
});
