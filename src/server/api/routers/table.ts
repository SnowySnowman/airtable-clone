import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import type { ColumnType } from "@prisma/client";
import { faker } from '@faker-js/faker';

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
              col.type === "NUMBER"
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

      getRows: publicProcedure
      .input(z.object({
        tableId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().default(100),
      }))
      .query(async ({ ctx, input }) => {
        const rows = await ctx.db.row.findMany({
          where: { tableId: input.tableId },
          take: input.limit + 1,
          skip: input.cursor ? 1 : 0,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: { id: "asc" },
        });

        const nextCursor = rows.length > input.limit ? rows.pop()!.id : null;

        return {
          rows, // each row has .values (type: Record<columnId, value>)
          nextCursor,
        };
      }),
    
});
