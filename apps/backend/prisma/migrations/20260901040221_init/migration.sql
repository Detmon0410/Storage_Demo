-- CreateTable
CREATE TABLE `File` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_code` VARCHAR(191) NOT NULL,
    `category_name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `categories_category_code_key`(`category_code`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `supplier_id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_code` VARCHAR(191) NOT NULL,
    `supplier_name` VARCHAR(191) NOT NULL,
    `contact_name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    UNIQUE INDEX `suppliers_supplier_code_key`(`supplier_code`),
    PRIMARY KEY (`supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `product_id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_code` VARCHAR(191) NOT NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `stock_qty` INTEGER NOT NULL DEFAULT 0,
    `min_stock` INTEGER NOT NULL DEFAULT 0,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `products_product_code_key`(`product_code`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transactions` (
    `transaction_id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_no` VARCHAR(191) NOT NULL,
    `product_id` INTEGER NOT NULL,
    `transaction_type` ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `transaction_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference_no` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `stock_transactions_transaction_no_key`(`transaction_no`),
    PRIMARY KEY (`transaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
