// src/routes/goals.ts
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getUserGoals, upsertUserGoals, getDailyTotals } from '../services/dbService';

const router = Router();

const GoalsSchema = z.object({
  calories: z.number().min(500).max(10000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(500),
});

// GET /api/goals
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goals = await getUserGoals(req.userId!);
    res.json(goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 65 });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/goals
router.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = GoalsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid goals data', details: parsed.error.issues });
    return;
  }

  try {
    await upsertUserGoals(req.userId!, parsed.data);
    res.json({ success: true, goals: parsed.data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/goals/dashboard - today's progress
router.get('/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [goals, totals] = await Promise.all([
      getUserGoals(req.userId!),
      getDailyTotals(req.userId!, today),
    ]);

    const defaultGoals = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 65 };

    res.json({
      date: today,
      consumed: totals,
      goals: defaultGoals,
      progress: {
        calories: Math.round((totals.calories / defaultGoals.calories) * 100),
        protein: Math.round((totals.protein / defaultGoals.protein) * 100),
        carbs: Math.round((totals.carbs / defaultGoals.carbs) * 100),
        fat: Math.round((totals.fat / defaultGoals.fat) * 100),
      },
      remaining: {
        calories: Math.max(0, defaultGoals.calories - totals.calories),
        protein: Math.max(0, defaultGoals.protein - totals.protein),
        carbs: Math.max(0, defaultGoals.carbs - totals.carbs),
        fat: Math.max(0, defaultGoals.fat - totals.fat),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
