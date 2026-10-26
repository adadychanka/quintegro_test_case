import { Request, Response, NextFunction } from 'express';
import { shouldBypassFaults } from './faultBypass';

export const delayMiddleware = (delayMs: number = 3000, enabled: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled || shouldBypassFaults(req)) {
      return next();
    }
    setTimeout(() => {
      next();
    }, delayMs);
  };
};
