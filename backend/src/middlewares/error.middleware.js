import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const fieldName = issue.path.join('.');
      fields[fieldName] = issue.message;
    }

    return res.status(400).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid fields.',
        fields
      },
      meta: { requestId: req.id }
    });
  }

  // Generic errors
  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500
    ? 'An unexpected error occurred. Please try again later.'
    : (err.message || 'Error processing request.');

  // Redact internal error traces in response
  return res.status(statusCode).json({
    data: null,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message
    },
    meta: { requestId: req.id }
  });
}

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
