/*
  Warnings:

  - Added the required column `config` to the `TableView` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TableView" ADD COLUMN     "config" JSONB NOT NULL;
