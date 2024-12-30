/*
  Warnings:

  - A unique constraint covering the columns `[discountId]` on the table `discount_codes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `discount_codes_discountId_key` ON `discount_codes`(`discountId`);
