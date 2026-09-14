import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { computePermitStatus } from "./permitStatus.js";

export const assertProductsNotBlockedTx = async (tx: Prisma.TransactionClient, productIds: number[]) => {
  const uniqueIds = [...new Set(productIds)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return;

  const licenses = await tx.license.findMany({ where: { productId: { in: uniqueIds } } });
  for (const license of licenses) {
    const { status } = computePermitStatus(license.expiryDate);
    if (status === "EXPIRED") {
      throw new HttpError(400, `Product ${license.productId} has an expired permit (license ${license.licenseNo}) and cannot be ordered until it is resolved`);
    }
  }
};
