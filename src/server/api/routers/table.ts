import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { Prisma, ColumnType, type Row } from "@prisma/client";
import { faker } from '@faker-js/faker';
import { PrismaAdapter } from "@auth/prisma-adapter";

export type ViewConfig = {
  filters?: Record<string, any>;
  sort?: { columnId: string; order: 'asc' | 'desc' }[];
  search?: string;
  hiddenColumns?: string[];
};


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
      .input(z.object({ baseId: z.string(), name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const newTable = await ctx.db.table.create({
          data: {
            baseId: input.baseId,
            name: input.name,
          },
        });

        // Add default columns
        const [nameCol, ageCol] = await ctx.db.$transaction([
          ctx.db.column.create({
            data: {
              name: "Name",
              type: "TEXT",
              tableId: newTable.id,
              order: 0,
            },
          }),
          ctx.db.column.create({
            data: {
              name: "Age",
              type: "NUMBER",
              tableId: newTable.id,
              order: 1,
            },
          }),
        ]);

        // Add 5 fake rows
        const rowsData = Array.from({ length: 5 }).map(() => ({
          tableId: newTable.id,
          values: {
            [nameCol.id]: faker.person.fullName(),
            [ageCol.id]: faker.number.int({ min: 18, max: 65 }),
          },
        }));

        await ctx.db.row.createMany({
          data: rowsData,
        });

        console.log("created new table")
        return newTable;
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
            col.type === ColumnType.NUMBER
              ? faker.number.int({ min: 1, max: 1000 })
              : faker.word.words({ count: 3 });
        }

        return {
          tableId: input.tableId,
          values,
        };
      });

      const BATCH_SIZE = 1000;
      for (let i = 0; i < rowsData.length; i += BATCH_SIZE) {
        const chunk = rowsData.slice(i, i + BATCH_SIZE);
        await ctx.db.row.createMany({
          data: chunk,
        });
      }

      return { success: true };
    }),

      getRows: publicProcedure
        .input(z.object({
          tableId: z.string(),
          cursor: z.string().nullish(),
          start: z.number().default(0),
          limit: z.number().default(100),
          search: z.string().optional(), // optional, not fully implemented below
          sort: z.array(z.object({
            columnId: z.string(),
            order: z.enum(["asc", "desc"]),
          })).optional(),
          filters: z.record(z.object({
            type: z.enum(["text", "number"]),
            op: z.string(), // "equals", "contains", ">", "<", etc.
            value: z.any(),
          })).optional(),
        }))
        .query(async ({ ctx, input }) => {
          const table = await ctx.db.table.findUnique({
            where: { id: input.tableId },
            include: { columns: true },
          });
          if (!table) throw new Error("Table not found");

          const filterConditions: Prisma.Sql[] = [];

          if (input.filters) {
            for (const [columnId, filter] of Object.entries(input.filters)) {
              // const path = Prisma.sql`${columnId}`;
              const jsonField = Prisma.sql`jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${columnId}'`)})`;

              if (filter.type === "text") {
                const value = filter.value;
                if (filter.op === "equals") {
                  filterConditions.push(Prisma.sql`${jsonField} = ${value}`);
                } else if (filter.op === "contains") {
                  filterConditions.push(Prisma.sql`${jsonField} ILIKE ${`%${value}%`}`);
                } else if (filter.op === "not_contains") {
                  filterConditions.push(Prisma.sql`${jsonField} NOT ILIKE ${`%${value}%`}`);
                } else if (filter.op === "is_empty") {
                  filterConditions.push(Prisma.sql`(${jsonField} IS NULL OR ${jsonField} = '')`);
                } else if (filter.op === "is_not_empty") {
                  filterConditions.push(Prisma.sql`(${jsonField} IS NOT NULL AND ${jsonField} <> '')`);
                }
              } else if (filter.type === "number") {
                const numVal = Number(filter.value);
                if (filter.op === "=") {
                  filterConditions.push(Prisma.sql`${jsonField}::numeric = ${numVal}`);
                } else if (filter.op === ">") {
                  filterConditions.push(Prisma.sql`${jsonField}::numeric > ${numVal}`);
                } else if (filter.op === "<") {
                  filterConditions.push(Prisma.sql`${jsonField}::numeric < ${numVal}`);
                } else if (filter.op === "is_empty") {
                  filterConditions.push(Prisma.sql`${jsonField} IS NULL`);
                } else if (filter.op === "is_not_empty") {
                  filterConditions.push(Prisma.sql`${jsonField} IS NOT NULL`);
                }
              }
            }
          }

          const conditions: Prisma.Sql[] = [Prisma.sql`"tableId" = ${input.tableId}`];

          // Add filter conditions
          if (input.filters) {
            for (const [columnId, filter] of Object.entries(input.filters)) {
              const jsonField = Prisma.sql`jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${columnId}'`)})`;

              if (filter.type === "text") {
                const value = filter.value;
                if (filter.op === "equals") {
                  conditions.push(Prisma.sql`${jsonField} = ${value}`);
                } else if (filter.op === "contains") {
                  conditions.push(Prisma.sql`${jsonField} ILIKE ${`%${value}%`}`);
                } else if (filter.op === "not_contains") {
                  conditions.push(Prisma.sql`${jsonField} NOT ILIKE ${`%${value}%`}`);
                } else if (filter.op === "is_empty") {
                  conditions.push(Prisma.sql`(${jsonField} IS NULL OR ${jsonField} = '')`);
                } else if (filter.op === "is_not_empty") {
                  conditions.push(Prisma.sql`(${jsonField} IS NOT NULL AND ${jsonField} <> '')`);
                }
              } else if (filter.type === "number") {
                const numVal = Number(filter.value);
                if (filter.op === ">") {
                  conditions.push(Prisma.sql`${jsonField}::numeric > ${numVal}`);
                } else if (filter.op === "<") {
                  conditions.push(Prisma.sql`${jsonField}::numeric < ${numVal}`);
                }
              }
            }
          }

          // Add global search — grouped as a single OR block
          if (input.search && input.search.trim() !== "") {
            const searchTerms = table.columns.map((col) =>
              Prisma.sql`jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${col.id}'`)}) ILIKE ${`%${input.search}%`}`
            );

            // Wrap search conditions in parentheses and join with OR
            const searchBlock = Prisma.sql`(${Prisma.join(searchTerms, ' OR ')})`;
            conditions.push(searchBlock);
          }

          const whereClause = Prisma.sql`${Prisma.join(conditions, ' AND ')}`;

          // const sortClause = input.sort
          //   ? Prisma.sql`ORDER BY jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${input.sort.columnId}'`)}) ${Prisma.raw(input.sort.order)}`
          //   : Prisma.sql`ORDER BY "Row"."id" ASC`;
          const sortClause = input.sort?.length
            ? Prisma.sql`ORDER BY ${Prisma.join(
                input.sort.map((s) =>
                  Prisma.sql`LOWER(jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${s.columnId}'`)})) ${Prisma.raw(s.order)}`
                ),
                ','
              )}`
            : Prisma.sql`ORDER BY "Row"."id" ASC`;


          // const rows = await ctx.db.$queryRaw<Row[]>(Prisma.sql`
          //   SELECT * FROM "Row"
          //   WHERE ${whereClause}
          //   ${sortClause}
          //   LIMIT ${input.limit + 1}
          // `);

          const rows = await ctx.db.$queryRaw<Row[]>(Prisma.sql`
            SELECT * FROM "Row"
            WHERE ${whereClause}
            ${sortClause}
            OFFSET ${input.start}
            LIMIT ${input.limit}
          `);

          const nextCursor = rows.length > input.limit ? rows.pop()!.id : null;

          return {
            rows,
            nextCursor,
          };
        }),

    saveView: publicProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string(),
      config: z.object({
        filters: z.record(z.any()),
        sort: z.array(
          z.object({ columnId: z.string(), order: z.enum(["asc", "desc"]) })
        ).optional(),
        search: z.string().optional(),
        hiddenColumns: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("Saving view with full config:", JSON.stringify(input.config, null, 2));

        return await ctx.db.tableView.create({
          data: {
            tableId: input.tableId,
            name: input.name,
            config: input.config,
          }
        });
      } catch (err) {
        console.error("❌ Error saving view:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save view." });
      }
    }),

    getViews: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.tableView.findMany({
        where: { tableId: input.tableId },
      });
    }),



    
});
