-- AlterTable
ALTER TABLE `import_orders` ADD COLUMN `created_by_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_orders` ADD COLUMN `created_by_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
    `audit_log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_action_idx`(`action` ASC),
    INDEX `audit_logs_created_at_idx`(`created_at` ASC),
    INDEX `audit_logs_entity_entity_id_idx`(`entity` ASC, `entity_id` ASC),
    INDEX `audit_logs_user_id_idx`(`user_id` ASC),
    PRIMARY KEY (`audit_log_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `permission_id` INTEGER NOT NULL AUTO_INCREMENT,
    `permission_code` VARCHAR(191) NOT NULL,
    `permission_name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `permissions_permission_code_key`(`permission_code` ASC),
    PRIMARY KEY (`permission_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    INDEX `role_permissions_permission_id_fkey`(`permission_id` ASC),
    PRIMARY KEY (`role_id` ASC, `permission_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_code` VARCHAR(191) NOT NULL,
    `role_name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `roles_role_code_key`(`role_code` ASC),
    PRIMARY KEY (`role_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    INDEX `user_roles_role_id_fkey`(`role_id` ASC),
    PRIMARY KEY (`user_id` ASC, `role_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `import_orders_created_by_id_fkey` ON `import_orders`(`created_by_id` ASC);

-- CreateIndex
CREATE INDEX `sales_orders_created_by_id_fkey` ON `sales_orders`(`created_by_id` ASC);

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_orders` ADD CONSTRAINT `import_orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`permission_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

