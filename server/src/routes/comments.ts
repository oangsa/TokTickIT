import { Router, type Request, type Response, type NextFunction } from "express";
import { setPaginationHeader } from "../http/pagination.js";
import { getPrisma } from "../prisma.js";
import {
  createReplyComment,
  createRootComment,
  getCommentReplies,
  getRootComments,
} from "../services/publicCommentService.js";

export const commentsRouter = Router();

commentsRouter.get(
  "/tickets/:publicId/comments",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, pagination } = await getRootComments(
        getPrisma(),
        req.auth!,
        req.params.publicId,
        req.query as Record<string, unknown>,
      );
      setPaginationHeader(res, pagination);
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
);

commentsRouter.post(
  "/tickets/:publicId/comments",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await createRootComment(
        getPrisma(),
        req.auth!,
        req.params.publicId,
        req.body?.content,
      );
      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

commentsRouter.get(
  "/tickets/:publicId/comments/:rootCommentPublicId/replies",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, pagination } = await getCommentReplies(
        getPrisma(),
        req.auth!,
        req.params.publicId,
        req.params.rootCommentPublicId,
        req.query as Record<string, unknown>,
      );
      setPaginationHeader(res, pagination);
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
);

commentsRouter.post(
  "/tickets/:publicId/comments/:commentPublicId/replies",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await createReplyComment(
        getPrisma(),
        req.auth!,
        req.params.publicId,
        req.params.commentPublicId,
        req.body?.content,
      );
      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);
