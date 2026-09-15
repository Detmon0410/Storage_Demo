-- AlterTable: add inventory_stock_id to sales_order_items as nullable first so existing
-- rows can be backfilled before the NOT NULL constraint is enforced (avoids destructive
-- clearing of existing demo sales-order-item rows).
ALTER TABLE `sales_order_items` ADD COLUMN `inventory_stock_id` INTEGER NULL;

-- Backfill: match each existing sales_order_items row to the InventoryStock row for the
-- same product with the same lot_batch label.
UPDATE `sales_order_items` soi
INNER JOIN `inventory_stock` inv
  ON inv.product_id = soi.product_id AND inv.lot_batch = soi.lot_batch
SET soi.inventory_stock_id = inv.inventory_stock_id;

-- Fallback backfill: for any row that didn't have an exact lot_batch label match (e.g. a
-- stale/renamed lot label), fall back to the same product's only available lot.
UPDATE `sales_order_items` soi
SET soi.inventory_stock_id = (
  SELECT inv.inventory_stock_id FROM `inventory_stock` inv
  WHERE inv.product_id = soi.product_id
  LIMIT 1
)
WHERE soi.inventory_stock_id IS NULL;

-- AlterTable: now enforce NOT NULL and drop the old free-text lot_batch column.
ALTER TABLE `sales_order_items`
  MODIFY COLUMN `inventory_stock_id` INTEGER NOT NULL,
  DROP COLUMN `lot_batch`;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_inventory_stock_id_fkey` FOREIGN KEY (`inventory_stock_id`) REFERENCES `inventory_stock`(`inventory_stock_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: StockTransaction gains a nullable lot reference.
ALTER TABLE `stock_transactions` ADD COLUMN `inventory_stock_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_inventory_stock_id_fkey` FOREIGN KEY (`inventory_stock_id`) REFERENCES `inventory_stock`(`inventory_stock_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: SalesOrder gains the interim approval flag and last-editor tracking.
ALTER TABLE `sales_orders`
  ADD COLUMN `requires_approval` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `updated_by_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
