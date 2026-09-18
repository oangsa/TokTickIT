import { Router, type Request, type Response, type NextFunction } from "express";
import { setPaginationHeader } from "../http/pagination.js";
import { requireRole } from "../middleware/authentication.js";
import { getPrisma } from "../prisma.js";
import { parseUserListQuery } from "../services/userQueryValidator.js";
import {
  createUser,
  getUser,
  listUsers,
  resetInitialPassword,
  updateUser,
} from "../services/userService.js";

export const adminUsersRouter = Router();

adminUsersRouter.use(requireRole("ADMINISTRATOR"));

adminUsersRouter.get(
  "/users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseUserListQuery(req.query);
      const { items, pagination } = await listUsers(getPrisma(), query);
      setPaginationHeader(res, pagination);
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
);

adminUsersRouter.post(
  "/users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createUser(getPrisma(), req.auth!, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

adminUsersRouter.get(
  "/users/:publicId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUser(getPrisma(), req.params.publicId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

adminUsersRouter.patch(
  "/users/:publicId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await updateUser(getPrisma(), req.auth!, req.params.publicId, req.body);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

adminUsersRouter.post(
  "/users/:publicId/initial-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await resetInitialPassword(getPrisma(), req.auth!, req.params.publicId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
