// ─── Application Error Classes ──────────────────────────────────────────────
// Consistent HTTP error responses. Thrown in services, caught by global handler.

export class AppError extends Error {
  status: number
  // Machine-readable reason for clients that branch on it (single auto-
  // retry on VERSION_CONFLICT, hard stop on CHECKOUT_IN_PROGRESS).
  // Optional: omitted from the wire when unset.
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code?: string) {
    super(message, 409, code)
  }
}
