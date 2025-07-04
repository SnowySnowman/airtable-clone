/*
  Warnings:

  - Made the column `search` on table `TableView` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TableView" ALTER COLUMN "search" SET NOT NULL;
