-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(191) NULL,
    `collaborator` BOOLEAN NULL DEFAULT false,
    `emailVerified` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discount_codes` (
    `id` VARCHAR(191) NOT NULL,
    `discountTitle` VARCHAR(191) NOT NULL,
    `discountCode` VARCHAR(191) NOT NULL,
    `customerGid` VARCHAR(191) NULL,
    `codeUsage` INTEGER NOT NULL DEFAULT 0,
    `discountPercentage` DOUBLE NOT NULL,
    `startingPercentage` DOUBLE NOT NULL,
    `incrementBy` DOUBLE NOT NULL,
    `endingPercentage` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endingDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `discount_codes_discountCode_key`(`discountCode`),
    INDEX `discount_codes_discountCode_idx`(`discountCode`),
    INDEX `discount_codes_customerGid_idx`(`customerGid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
