import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { ApiError, errorHandler } from "../../src/http/errors.js";
const app = express();
app.get("/:code", (req, _res, next) => next(req.params.code === "internal" ? new Error("private Prisma details") : new ApiError(req.params.code as "CONFLICT")));
app.use(errorHandler);
it.each(["INVALID_ACTION_TRANSITION", "CONFLICT", "INVALID_STATUS_TRANSITION", "IDEMPOTENCY_CONFLICT"])("API-20 centralized safe %s envelope", async (code) => {
  const response = await request(app).get(`/${code}`);
  expect(response.status).toBe(409); expect(response.body).toMatchObject({ statusCode: 409, code, error: "Conflict" });
  expect(Object.keys(response.body).sort()).toEqual(["code", "error", "message", "statusCode"]);
  if (code === "INVALID_ACTION_TRANSITION") expect(response.body.message).toBe("The requested Action Taken operation is not valid in the current state.");
});
it("API-20 unexpected error never leaks internal details", async () => {
  const response = await request(app).get("/internal");
  expect(response.status).toBe(500); expect(response.body.code).toBe("INTERNAL_SERVER_ERROR"); expect(JSON.stringify(response.body)).not.toContain("Prisma");
});
