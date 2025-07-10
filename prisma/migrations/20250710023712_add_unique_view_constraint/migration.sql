/*
  Warnings:

  - A unique constraint covering the columns `[tableId,name]` on the table `TableView` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TableView_tableId_name_key" ON "TableView"("tableId", "name");
