import { Router } from 'express';
import cors from 'cors';

export function createResetRoutes(reset: () => void): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    reset();
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
