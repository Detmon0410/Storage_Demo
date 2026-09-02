-- DropForeignKey
ALTER TABLE `customers` DROP FOREIGN KEY `customers_license_no_fkey`;

-- DropIndex
DROP INDEX `customers_license_no_fkey` ON `customers`;

-- AlterTable
ALTER TABLE `customers` DROP COLUMN `license_expiry_date`,
    DROP COLUMN `license_no`;

-- AlterTable
ALTER TABLE `sales_orders` ADD COLUMN `customer_license_id` INTEGER NULL,
    ADD COLUMN `license_expiry_snapshot` DATE NULL,
    ADD COLUMN `license_number_snapshot` VARCHAR(191) NULL,
    ADD COLUMN `license_type_snapshot` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `customer_licenses` (
    `customer_license_id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `license_number` VARCHAR(191) NOT NULL,
    `license_type` VARCHAR(191) NOT NULL,
    `applicable_channel` VARCHAR(191) NULL,
    `issue_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `document_url` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_by` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `status_changed_by` VARCHAR(191) NULL,
    `status_changed_at` DATETIME(3) NULL,
    `renewed_from_id` INTEGER NULL,

    UNIQUE INDEX `customer_licenses_license_number_key`(`license_number`),
    UNIQUE INDEX `customer_licenses_renewed_from_id_key`(`renewed_from_id`),
    PRIMARY KEY (`customer_license_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_licenses` ADD CONSTRAINT `customer_licenses_renewed_from_id_fkey` FOREIGN KEY (`renewed_from_id`) REFERENCES `customer_licenses`(`customer_license_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_licenses` ADD CONSTRAINT `customer_licenses_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_customer_license_id_fkey` FOREIGN KEY (`customer_license_id`) REFERENCES `customer_licenses`(`customer_license_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
