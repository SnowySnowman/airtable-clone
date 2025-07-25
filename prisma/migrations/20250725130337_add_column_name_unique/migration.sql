/*
  Warnings:

  - A unique constraint covering the columns `[tableId,name]` on the table `Column` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Column_tableId_name_key" ON "Column"("tableId", "name");
