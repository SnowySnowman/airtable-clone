import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { Prisma, type ColumnType } from "@prisma/client";
import { faker } from '@faker-js/faker';
import { PrismaAdapter } from "@auth/prisma-adapter";

export const tableRouter = createTRPCRouter({
  getTableById: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: { orderBy: { order: "asc" } },
          rows: { orderBy: { id: "asc" } },
        },
      });

      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      return table;
    }),

  create: protectedProcedure
  .input(z.object({ baseId: z.string(), name: z.string() }))
  .mutation(async ({ input, ctx }) => {
    return ctx.db.table.create({
      data: {
        name: input.name,
        baseId: input.baseId,
      },
    });
  }),

  // Rename a table
  rename: protectedProcedure
    .input(z.object({ tableId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.table.update({
        where: { id: input.tableId },
        data: { name: input.name },
      });
    }),

  // Delete a table
  delete: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Wrap in a transaction to ensure atomic deletion
      await ctx.db.$transaction([
        ctx.db.row.deleteMany({
          where: { tableId: input.tableId },
        }),
        ctx.db.column.deleteMany({
          where: { tableId: input.tableId },
        }),
        ctx.db.table.delete({
          where: { id: input.tableId },
        }),
      ]);

      return { success: true };
    }),



  updateCell: publicProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
      });

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const currentValues = row.values as Record<string, string | number>;

      const newValues = {
        ...currentValues,
        [input.columnId]: input.value,
      };

      console.log("Updating cell:", {
        tableId: input.tableId,
        rowId: input.rowId,
        columnId: input.columnId,
        value: input.value,
      });


      await ctx.db.row.update({
        where: { id: input.rowId },
        data: { values: newValues },
      });

      return { success: true };
    }),

  addColumn: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string(),
      type: z.enum(['text', 'number']), // or whatever types you support
    }))
    .mutation(async ({ input, ctx }) => {
      const existingColumns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
      });

      return ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          type: input.type.toUpperCase() as ColumnType,
          order: existingColumns.length,
        },
      });

    }),

    renameColumn: protectedProcedure
    .input(z.object({
      columnId: z.string(),
      name: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.column.update({
        where: { id: input.columnId },
        data: { name: input.name },
      });
    }),

    deleteColumn: protectedProcedure
    .input(z.object({
      columnId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Optional: remove associated cell values
      return ctx.db.column.delete({
        where: { id: input.columnId },
      });
    }),

    addRow: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const newRow = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          values: {}, // Start with empty values
        },
      });
      return newRow;
    }),

    addFakeRows: publicProcedure
      .input(z.object({ tableId: z.string(), count: z.number().min(1).max(100000) }))
      .mutation(async ({ input, ctx }) => {
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: { columns: true },
        });

        if (!table) throw new TRPCError({ code: "NOT_FOUND" });

        const rowsData = Array.from({ length: input.count }).map(() => {
          const values: Record<string, string | number> = {};
          for (const col of table.columns) {
            values[col.id] =
              col.type === "number"
                ? faker.number.int({ min: 1, max: 1000 })
                : faker.word.words({ count: 3 });
          }

          return {
            tableId: input.tableId,
            values,
          };
        });

        // Use transaction for performance
        await ctx.db.$transaction(
          rowsData.map((data) => ctx.db.row.create({ data }))
        );

        return { success: true };
      }),

      // getRows: publicProcedure
      // .input(z.object({
      //   tableId: z.string(),
      //   cursor: z.string().nullish(),
      //   limit: z.number().default(100),
      //   search: z.string().optional(),       // 🆕 search term
      //   sort: z.object({
      //     columnId: z.string(),
      //     order: z.enum(["asc", "desc"]),
      //   }).optional(),                       // 🆕 sorting
      // }))
      // .query(async ({ ctx, input }) => {
      //   const table = await ctx.db.table.findUnique({
      //     where: { id: input.tableId },
      //     include: { columns: true },
      //   });

      //   if (!table) throw new Error("Table not found");

      //   const rows = await ctx.db.row.findMany({
      //     where: {
      //       tableId: input.tableId,
      //       ...(input.search
      //         ? {
      //             OR: table.columns.map((col) => ({
      //               values: {
      //                 path: [col.id],
      //                 string_contains: input.search,
      //               },
      //             })),
      //           }
      //         : {}),
      //     },
      //     take: input.limit + 1,
      //     skip: input.cursor ? 1 : 0,
      //     cursor: input.cursor ? { id: input.cursor } : undefined,
      //     orderBy: { id: "asc" },
      //   });

      //   const nextCursor = rows.length > input.limit ? rows.pop()!.id : null;

      //   return {
      //     rows,
      //     nextCursor,
      //   };
      // }),

      getRows: publicProcedure
      .input(z.object({
        tableId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().default(100),
        search: z.string().optional(),
        sort: z.object({
          columnId: z.string(),
          order: z.enum(["asc", "desc"]),
        }).optional(),
        filters: z.record(z.object({
          type: z.enum(["text", "number"]),
          op: z.string(), // operator like '=', 'contains', etc.
          value: z.any(), // value to compare against
        })).optional(),
      }))
      .query(async ({ ctx, input }) => {
        try{
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: { columns: true },
        });

        if (!table) throw new Error("Table not found");

        const isNumericSearch = !isNaN(Number(input.search));

        const filterConditions: Prisma.RowWhereInput[] = [];

        if (input.filters) {
          for (const [columnId, filter] of Object.entries(input.filters)) {
            const path = [columnId];

            if (filter.type === "text") {
              if (filter.op === "contains") {
                filterConditions.push({
                  values: {
                    path,
                    string_contains: filter.value,
                  },
                });
              } else if (filter.op === "not_contains") {
                filterConditions.push({
                  NOT: {
                    values: {
                      path,
                      string_contains: filter.value,
                    },
                  },
                });
              } else if (filter.op === "equals") {
                filterConditions.push({
                  values: {
                    path,
                    equals: filter.value,
                  },
                });
              } else if (filter.op === "is_empty") {
                filterConditions.push({
                  values: {
                    path,
                    equals: "",
                  },
                });
              } else if (filter.op === "is_not_empty") {
                filterConditions.push({
                  NOT: {
                    values: {
                      path,
                      equals: "",
                    },
                  },
                });
              }
            }

            if (filter.type === "number") {
              const numberValue = Number(filter.value);
              if (filter.op === "=") {
                filterConditions.push({ values: { path, equals: numberValue } });
              } else if (filter.op === "<") {
                filterConditions.push({ values: { path, lt: numberValue } });
              } else if (filter.op === ">") {
                filterConditions.push({ values: { path, gt: numberValue } });
              } else if (filter.op === "is_empty") {
                filterConditions.push({ values: { path, equals: Prisma.JsonNull } });
              } else if (filter.op === "is_not_empty") {
                filterConditions.push({ NOT: { values: { path, equals: Prisma.JsonNull } } });
              }
            }
          }
        }

        const columnFilters = input.filters
        ? Object.entries(input.filters).map(([colId, filter]) => {
            const path = [colId];
            const { type, op, value } = filter;

            if (type === "text") {
              if (op === "equals") {
                return { values: { path, equals: value} };
              } else if (op === "contains") {
                return { values: { path, string_contains: value } };
              } else if (op === "not_contains") {
                return {
                  NOT: { values: { path, string_contains: value} },
                };
              } else if (op === "is_empty") {
                return { values: { path, equals: null } };
              } else if (op === "is_not_empty") {
                return { NOT: { values: { path, equals: null } } };
              }
            }

            if (type === "number") {
              if (op === ">") {
                return { values: { path, gt: Number(value) } };
              } else if (op === "<") {
                return { values: { path, lt: Number(value) } };
              }
            }

            return undefined;
          }).filter(Boolean)
        : [];

      const searchFilters = input.search
        ? table.columns.map((col) => ({
            OR: [
              {
                values: {
                  path: [col.id],
                  string_contains: input.search,
                },
              },
              ...(isNumericSearch
                ? [
                    {
                      values: {
                        path: [col.id],
                        equals: Number(input.search),
                      },
                    },
                  ]
                : []),
            ],
          }))
        : [];

      const rows = await ctx.db.row.findMany({
        where: {
          tableId: input.tableId,
          AND: [...columnFilters, ...(searchFilters.length > 0 ? [{ OR: searchFilters }] : [])],
        },
        take: input.limit + 1,
        skip: input.cursor ? 1 : 0,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { id: "asc" },
      });


        const nextCursor = rows.length > input.limit ? rows.pop()!.id : null;

        return {
          rows,
          nextCursor,
        };
      } catch (err){
        console.error("getrows error:", err);
        throw new Error("Failed to fetch rows");
      }
      }),


    saveView: publicProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string(),
      config: z.object({
        filters: z.record(z.any()),
        sort: z.object({ columnId: z.string(), order: z.enum(["asc", "desc"]) }).optional(),
        search: z.string().optional(),
        hiddenColumns: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.tableView.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          filters: input.config.filters,
          sort: input.config.sort ?? {},
          hiddenCols: input.config.hiddenColumns ?? [],
          search: input.config.search ?? "",
          config: input.config,
        },
      });
    }),

    getViews: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.tableView.findMany({
        where: { tableId: input.tableId },
      });
    }),



    
});
