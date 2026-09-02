-- CreateTable
CREATE TABLE `import_order_items` (
    `import_order_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `import_order_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`import_order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `inventory_stock` ADD COLUMN `import_order_item_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `import_order_items` ADD CONSTRAINT `import_order_items_import_order_id_fkey` FOREIGN KEY (`import_order_id`) REFERENCES `import_orders`(`import_order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_order_items` ADD CONSTRAINT `import_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_stock` ADD CONSTRAINT `inventory_stock_import_order_item_id_fkey` FOREIGN KEY (`import_order_item_id`) REFERENCES `import_order_items`(`import_order_item_id`) ON DELETE SET NULL ON UPDATE CASCADE;
