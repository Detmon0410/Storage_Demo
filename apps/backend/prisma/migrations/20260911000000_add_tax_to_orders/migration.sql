-- AlterTable
ALTER TABLE `import_order_items`
    ADD COLUMN `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tax_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `import_orders`
    ADD COLUMN `tax_total` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales_order_items`
    ADD COLUMN `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tax_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales_orders`
    ADD COLUMN `tax_total` DECIMAL(14, 2) NOT NULL DEFAULT 0;
