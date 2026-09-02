-- DropForeignKey
ALTER TABLE `sales_orders` DROP FOREIGN KEY `sales_orders_product_id_fkey`;

-- CreateTable
CREATE TABLE `sales_order_items` (
    `sales_order_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(5, 2) NOT NULL,
    `net_value` DECIMAL(14, 2) NOT NULL,
    `lot_batch` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`sales_order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `sales_orders`
    DROP COLUMN `product_id`,
    DROP COLUMN `quantity`,
    DROP COLUMN `unit_price`,
    DROP COLUMN `discount`,
    DROP COLUMN `lot_batch`;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`sales_order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
