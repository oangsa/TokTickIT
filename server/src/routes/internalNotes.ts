import { Router, type Request, type Response, type NextFunction } from "express";
import { setPaginationHeader } from "../http/pagination.js";
import { getPrisma } from "../prisma.js";
import { createInternalNote, getInternalNotes } from "../services/internalNoteService.js";

export const internalNotesRouter = Router();

internalNotesRouter.get(
  "/tickets/:publicId/internal-notes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, pagination } = await getInternalNotes(
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

internalNotesRouter.post(
  "/tickets/:publicId/internal-notes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await createInternalNote(
        getPrisma(),
        req.auth!,
        req.params.publicId,
        req.body?.content,
      );
      res.status(201).json(note);
    } catch (error) {
      next(error);
    }
  },
);
