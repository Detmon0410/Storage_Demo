import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A record with this value already exists" });
    }
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
