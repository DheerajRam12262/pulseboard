import { z } from "zod";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "./constants";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(50),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,4}$/, "2-5 chars, letters/digits, starts with a letter"),
  description: z.string().trim().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES);

export const createIssueSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullish(),
  status: issueStatusSchema.default("todo"),
  priority: issuePrioritySchema.default("none"),
  assigneeId: z.string().uuid().nullish(),
  labelIds: z.array(z.string().uuid()).max(10).optional(),
});

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    status: issueStatusSchema,
    priority: issuePrioritySchema,
    assigneeId: z.string().uuid().nullable(),
    labelIds: z.array(z.string().uuid()).max(10),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Empty update" });

// a move sends the target column plus the cards directly above/below the drop
// slot - the server derives the actual rank from those
export const moveIssueSchema = z.object({
  status: issueStatusSchema,
  beforeIssueId: z.string().uuid().nullish(),
  afterIssueId: z.string().uuid().nullish(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const searchQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  q: z.string().trim().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
