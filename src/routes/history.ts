// src/routes/history.ts
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getUserScans, getDailyScans, getDailyTotals, deleteScan } from '../services/dbService';

const router = Router();

// GET /api/history - all scans
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? '50'), 100);
    const scans = await getUserScans(req.userId!, limit);

    // Group by day
    const grouped: Record<string, typeof scans> = {};
    for (const scan of scans) {
      const date = scan.meal_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(scan);
    }

    res.json({ scans, grouped_by_day: grouped });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/history/day/:date - scans for a specific day
router.get('/day/:date', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const [scans, totals] = await Promise.all([
      getDailyScans(req.userId!, date),
      getDailyTotals(req.userId!, date),
    ]);

    res.json({ date, scans, totals });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/history/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await deleteScan(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
