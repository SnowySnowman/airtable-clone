/*
  Warnings:

  - You are about to drop the column `filters` on the `TableView` table. All the data in the column will be lost.
  - You are about to drop the column `hiddenCols` on the `TableView` table. All the data in the column will be lost.
  - You are about to drop the column `search` on the `TableView` table. All the data in the column will be lost.
  - You are about to drop the column `sort` on the `TableView` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TableView" DROP COLUMN "filters",
DROP COLUMN "hiddenCols",
DROP COLUMN "search",
DROP COLUMN "sort";
