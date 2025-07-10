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

const filtersSql: Prisma.Sql[] = [];
const values: any[] = []; // to track bindings


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

      // ✅ Add default "Grid view"
      await ctx.db.tableView.create({
        data: {
          tableId: newTable.id,
          name: "Grid view",
          config: {
            filters: [],
            sort: [],
            search: "",
            hiddenColumns: [],
          },
        },
      });

      console.log("created new table with default Grid view");
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

  // addColumn: protectedProcedure
  //   .input(z.object({
  //     tableId: z.string(),
  //     name: z.string(),
  //     type: z.enum(['text', 'number']), // or whatever types you support
  //   }))
  //   .mutation(async ({ input, ctx }) => {
  //     const existingColumns = await ctx.db.column.findMany({
  //       where: { tableId: input.tableId },
  //     });

  //     return ctx.db.column.create({
  //       data: {
  //         tableId: input.tableId,
  //         name: input.name,
  //         type: input.type.toUpperCase() as ColumnType,
  //         order: existingColumns.length,
  //       },
  //     });

  //   }),

  addColumnAndPopulate: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string(),
      type: z.enum(['TEXT', 'NUMBER']),
      defaultValue: z.string().optional(),  // optional
    }))
    .mutation(async ({ input, ctx }) => {
      const { tableId, name, type, defaultValue = "" } = input;
      const existingColumns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
      });

      const column = await ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          type: input.type.toUpperCase() as ColumnType,
          order: existingColumns.length,
        },
      });

      // Bulk update all rows with the new column value (e.g., empty string or default)
      // await ctx.db.row.updateMany({
      //   where: { tableId },
      //   data: {
      //     values: {
      //       push: { [column.id]: defaultValue },
      //     },
      //   },
      // });
      await ctx.db.$executeRawUnsafe(`
        UPDATE "Row"
        SET "values" = jsonb_set("values", '{${column.id}}', to_jsonb(''::text), true)
        WHERE "tableId" = '${tableId}'
      `);


      return column;
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
      try {
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: { columns: true },
        });

        if (!table) throw new TRPCError({ code: "NOT_FOUND" });

        const rowsData = Array.from({ length: input.count }).map(() => {
          const values: Record<string, string | number> = {};

          for (const col of table.columns) {
            const colName = col.name.toLowerCase();

            if (colName.includes('name')) {
              values[col.id] = faker.person.fullName();
            } else if (colName.includes('age')) {
              values[col.id] = faker.number.int({ min: 18, max: 65 });
            } else if (col.type === ColumnType.NUMBER) {
              values[col.id] = faker.number.int({ min: 1, max: 1000 });
            } else {
              values[col.id] = faker.word.words({ count: 3 });
            }
          }

          return {
            tableId: input.tableId,
            values,
          };
        });

        const BATCH_SIZE = 500;
        for (let i = 0; i < rowsData.length; i += BATCH_SIZE) {
          const chunk = rowsData.slice(i, i + BATCH_SIZE);

          // Try-catch around DB operation
          try {
            await ctx.db.row.createMany({ data: chunk });
          } catch (err) {
            console.error("❌ Failed chunk at batch", i, ":", err);
            throw err;
          }
        }

        return { success: true };
      } catch (err) {
        console.error("🚨 Error in addFakeRows:", err);
        throw err; // rethrow so client receives it
      }
    }),


    
    getRows: publicProcedure
      .input(z.object({
        tableId: z.string(),
        cursor: z.string().optional(), // 👈 for keyset pagination
        limit: z.number().default(50),
        search: z.string().optional(),
        sort: z.array(z.object({
          columnId: z.string(),
          order: z.enum(["asc", "desc"]),
        })).optional(),
        filters: z.array(
          z.object({
            field: z.string(),
            type: z.enum(['TEXT', 'NUMBER']),
            op: z.string(),
            value: z.union([z.string(), z.number(), z.null()]),
          })
        ).optional()
      }))
      .query(async ({ ctx, input }) => {
        // ... filters and whereClause stay the same ...

        const limit = input.limit ?? 50;

        const afterCursor = input.cursor
          ? Prisma.sql`AND "Row"."id" > ${input.cursor}`
          : Prisma.sql``;

        const conditions: Prisma.Sql[] = [Prisma.sql`"tableId" = ${input.tableId}`];

        if (input.filters) {
          for (const filter of input.filters) {
            const jsonField = Prisma.sql`jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${filter.field}'`)})`;

            if (!filter.op) continue;
            
            if (filter.type === "TEXT") {
              if (filter.op === "contains") {
                conditions.push(Prisma.sql`${jsonField} ILIKE ${`%${filter.value}%`}`);
              } else if (filter.op === "equals") {
                conditions.push(Prisma.sql`${jsonField} = ${filter.value}`);
              } else if (filter.op === "not_contains") {
                conditions.push(Prisma.sql`${jsonField} NOT ILIKE ${`%${filter.value}%`}`);
              } else if (filter.op === "is_empty") {
                conditions.push(Prisma.sql`(${jsonField} IS NULL OR ${jsonField} = '')`);
              } else if (filter.op === "is_not_empty") {
                conditions.push(Prisma.sql`(${jsonField} IS NOT NULL AND ${jsonField} <> '')`);
              }
            } else if (filter.type === "NUMBER") {
              const numVal = Number(filter.value);
              const numField = Prisma.sql`(${jsonField})::numeric`;

              // If op is not a no-value op but value is invalid, skip
              if (filter.op !== "is_empty" && filter.op !== "is_not_empty" && isNaN(numVal)) {
                continue;
              }

              switch (filter.op) {
                case ">":
                  conditions.push(Prisma.sql`${numField} > ${numVal}`);
                  break;
                case "<":
                  conditions.push(Prisma.sql`${numField} < ${numVal}`);
                  break;
              }
            }
          }
        }


        const whereClause = Prisma.sql`${Prisma.join(conditions, ' AND ')}`;

        const sortClause = input.sort?.length
          ? Prisma.sql`ORDER BY ${Prisma.join(
              input.sort.map((s) =>
                Prisma.sql`LOWER(jsonb_extract_path_text("Row"."values", ${Prisma.raw(`'${s.columnId}'`)}) ) ${Prisma.raw(s.order)}`
              ),
              ','
            )}`
          : Prisma.sql`ORDER BY "Row"."id" ASC`;

        const rows = await ctx.db.$queryRaw<Row[]>(Prisma.sql`
          SELECT * FROM "Row"
          WHERE ${whereClause}
          ${afterCursor}
          ${sortClause}
          LIMIT ${limit + 1}
        `);

        const hasNextPage = rows.length > limit;
        const trimmedRows = rows.slice(0, limit);

        return {
          rows: trimmedRows,
          nextCursor: hasNextPage ? trimmedRows[trimmedRows.length - 1]?.id : undefined,
        };
      }),

    saveView: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        config: z.object({
        filters: z.record(z.any()),
        sort: z.array(z.object({
          columnId: z.string(),
          order: z.enum(["asc", "desc"]),
        })).optional(),
        search: z.string().optional(),
        hiddenColumns: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try{
      const existingView = await ctx.db.tableView.findUnique({
        where: {
          tableId_name: {
            tableId: input.tableId,
            name: input.name,
          },
        },
      });

      if (existingView) {
        // ✅ Update existing view config
        return ctx.db.tableView.update({
          where: {
            tableId_name: {
              tableId: input.tableId,
              name: input.name,
            },
          },
          data: {
            config: input.config,
          },
        });
      }else {
        // ❌ Nothing returned before = silent fail!
        console.warn("View not found. Cannot update.");
        throw new Error("View not found");
      }
    }catch(err){
      console.log(err)
      throw err;
    }
    }),


    getViews: publicProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.tableView.findMany({
        where: { tableId: input.tableId },
      });
    }),

    createView: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if a view with the same name already exists for the table
      const existing = await ctx.db.tableView.findUnique({
        where: {
          tableId_name: {
            tableId: input.tableId,
            name: input.name,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A view named "${input.name}" already exists.`,
        });
      }

      const newView = await ctx.db.tableView.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          config: {
            filters: {},
            sort: [],
            search: '',
            hiddenColumns: [],
          },
        },
      });

      return newView;
    }),






    
});
