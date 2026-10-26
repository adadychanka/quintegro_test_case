import { Request, Response, NextFunction } from 'express';
import { shouldBypassFaults } from './faultBypass';

// Returns 500 on every 5th counted request. Each app instance gets its own counter.
export const createErrorTestMiddleware = (enabled: boolean = true) => {
  let requestCount = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled || shouldBypassFaults(req)) {
      return next();
    }

    requestCount++;

    // Return error on every 5th request
    if (requestCount % 5 === 0) {
      return res.status(500).json({
        error: 'Test planned server error',
        message: 'This is a planned error for testing purposes'
      });
    }

    next();
  };
};
