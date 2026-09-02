-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `country` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `products`
    ADD COLUMN `cost_price` DECIMAL(12, 2) NULL,
    ADD COLUMN `suggested_price` DECIMAL(12, 2) NULL,
    ADD COLUMN `abv_percent` DECIMAL(5, 2) NULL,
    ADD COLUMN `package_size_ml` INTEGER NULL;

-- CreateTable
CREATE TABLE `import_orders` (
    `import_order_id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(191) NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `incoterms` VARCHAR(191) NOT NULL,
    `order_date` DATE NOT NULL,
    `eta_date` DATE NOT NULL,
    `sku_item_count` INTEGER NOT NULL,
    `total_value` DECIMAL(14, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `approver` VARCHAR(191) NULL,
    `customs_entry_no` VARCHAR(191) NULL,

    UNIQUE INDEX `import_orders_order_no_key`(`order_no`),
    PRIMARY KEY (`import_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `licenses` (
    `license_id` INTEGER NOT NULL AUTO_INCREMENT,
    `license_no` VARCHAR(191) NOT NULL,
    `license_type` VARCHAR(191) NOT NULL,
    `holder_name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `issue_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `days_remaining` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `licenses_license_no_key`(`license_no`),
    PRIMARY KEY (`license_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `customer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_code` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `channel_type` VARCHAR(191) NOT NULL,
    `license_no` VARCHAR(191) NULL,
    `license_expiry_date` DATE NULL,
    `credit_limit` DECIMAL(14, 2) NOT NULL,
    `current_balance` DECIMAL(14, 2) NOT NULL,
    `available_credit` DECIMAL(14, 2) NOT NULL,
    `standard_discount` DECIMAL(5, 2) NOT NULL,
    `credit_status` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `customers_customer_code_key`(`customer_code`),
    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_orders` (
    `sales_order_id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(191) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(5, 2) NOT NULL,
    `net_value` DECIMAL(14, 2) NOT NULL,
    `lot_batch` VARCHAR(191) NOT NULL,
    `delivery_status` VARCHAR(191) NOT NULL,
    `invoice_no` VARCHAR(191) NOT NULL,
    `approver` VARCHAR(191) NULL,

    UNIQUE INDEX `sales_orders_order_no_key`(`order_no`),
    PRIMARY KEY (`sales_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_stock` (
    `inventory_stock_id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `lot_batch` VARCHAR(191) NOT NULL,
    `received_date` DATE NOT NULL,
    `quantity_on_hand` INTEGER NOT NULL,
    `stock_age_days` INTEGER NOT NULL,
    `stock_status` VARCHAR(191) NOT NULL,
    `warehouse` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `inventory_stock_product_id_lot_batch_key`(`product_id`, `lot_batch`),
    PRIMARY KEY (`inventory_stock_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dashboard_kpis` (
    `dashboard_kpi_id` INTEGER NOT NULL AUTO_INCREMENT,
    `metric_name` VARCHAR(191) NOT NULL,
    `current_value` DECIMAL(14, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `month_trend` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `dashboard_kpis_metric_name_key`(`metric_name`),
    PRIMARY KEY (`dashboard_kpi_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `import_orders` ADD CONSTRAINT `import_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_license_no_fkey` FOREIGN KEY (`license_no`) REFERENCES `licenses`(`license_no`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_stock` ADD CONSTRAINT `inventory_stock_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
