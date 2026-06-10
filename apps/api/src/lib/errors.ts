export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  unauthorized: (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have access to this resource") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (resource = "Resource") => new AppError(404, "NOT_FOUND", `${resource} not found`),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, "BAD_REQUEST", message, details),
};
