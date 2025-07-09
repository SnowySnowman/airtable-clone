-- DropForeignKey
ALTER TABLE "TableView" DROP CONSTRAINT "TableView_tableId_fkey";

-- AddForeignKey
ALTER TABLE "TableView" ADD CONSTRAINT "TableView_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
