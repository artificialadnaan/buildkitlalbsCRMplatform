import { Router } from 'express';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db, deals, pipelineStages, users, activities } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/analytics/pipeline/:pipelineId
router.get('/pipeline/:pipelineId', async (req, res) => {
  const { pipelineId } = req.params;

  // Get stages for this pipeline in order
  const stages = await db.select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(pipelineStages.position);

  if (stages.length === 0) {
    res.status(404).json({ error: 'Pipeline not found or has no stages' });
    return;
  }

  // Get deal counts, values per stage
  const stageMetrics = await db.select({
    stageId: deals.stageId,
    dealCount: sql<number>`count(*)::int`,
    avgValue: sql<number>`coalesce(avg(${deals.value}), 0)::int`,
    totalValue: sql<number>`coalesce(sum(${deals.value}), 0)::int`,
  })
    .from(deals)
    .where(eq(deals.pipelineId, pipelineId))
    .groupBy(deals.stageId);

  const metricsMap = new Map(stageMetrics.map(m => [m.stageId, m]));

  // Calculate total deals in pipeline
  const [totalResult] = await db.select({
    total: sql<number>`count(*)::int`,
  }).from(deals).where(eq(deals.pipelineId, pipelineId));

  const totalDeals = totalResult.total;

  // Win rate
  const [winLoss] = await db.select({
    won: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
    lost: sql<number>`count(*) filter (where ${deals.status} = 'lost')::int`,
    closed: sql<number>`count(*) filter (where ${deals.status} in ('won', 'lost'))::int`,
  })
    .from(deals)
    .where(eq(deals.pipelineId, pipelineId));

  const winRate = winLoss.closed > 0 ? Math.round((winLoss.won / winLoss.closed) * 100) : 0;

  // Average cycle time for closed deals
  const [avgCycleResult] = await db.select({
    avgDays: sql<number>`coalesce(avg(extract(epoch from (${deals.closedAt} - ${deals.createdAt})) / 86400), 0)::int`,
  })
    .from(deals)
    .where(and(
      eq(deals.pipelineId, pipelineId),
      sql`${deals.closedAt} is not null`,
    ));

  const avgDaysPerStage = stages.length > 0 ? Math.round(avgCycleResult.avgDays / stages.length) : 0;

  // Total pipeline value (open deals)
  const [pipelineValue] = await db.select({
    total: sql<number>`coalesce(sum(${deals.value}), 0)::int`,
  })
    .from(deals)
    .where(and(
      eq(deals.pipelineId, pipelineId),
      eq(deals.status, 'open'),
    ));

  // Build stage data with conversion rates
  const stageData = stages.map((stage, idx) => {
    const metrics = metricsMap.get(stage.id);
    const currentCount = metrics?.dealCount ?? 0;
    const nextStage = stages[idx + 1];
    const nextMetrics = nextStage ? metricsMap.get(nextStage.id) : null;
    const nextCount = nextMetrics?.dealCount ?? 0;
    const conversionRate = currentCount > 0 ? Math.round((nextCount / currentCount) * 100) : 0;

    return {
      id: stage.id,
      name: stage.name,
      position: stage.position,
      color: stage.color,
      dealCount: currentCount,
      avgValue: metrics?.avgValue ?? 0,
      totalValue: metrics?.totalValue ?? 0,
      avgDaysInStage: avgDaysPerStage,
      conversionRate: idx < stages.length - 1 ? conversionRate : null,
    };
  });

  res.json({
    pipelineId,
    stages: stageData,
    summary: {
      totalDeals,
      totalPipelineValue: pipelineValue.total,
      winRate,
      wonCount: winLoss.won,
      lostCount: winLoss.lost,
      avgCycleDays: avgCycleResult.avgDays,
    },
  });
});

// GET /api/analytics/rep-performance
router.get('/rep-performance', async (req, res) => {
  const repStats = await db.select({
    userId: users.id,
    name: users.name,
    email: users.email,
    dealsWon: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
    wonValue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won'), 0)::int`,
    dealsLost: sql<number>`count(*) filter (where ${deals.status} = 'lost')::int`,
    totalClosed: sql<number>`count(*) filter (where ${deals.status} in ('won', 'lost'))::int`,
    avgCycleDays: sql<number>`coalesce(avg(extract(epoch from (${deals.closedAt} - ${deals.createdAt})) / 86400) filter (where ${deals.closedAt} is not null), 0)::int`,
  })
    .from(users)
    .leftJoin(deals, eq(deals.assignedTo, users.id))
    .groupBy(users.id, users.name, users.email);

  // Activities this month per user
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const activityCounts = await db.select({
    userId: activities.userId,
    count: sql<number>`count(*)::int`,
  })
    .from(activities)
    .where(gte(activities.createdAt, monthStart))
    .groupBy(activities.userId);

  const activityMap = new Map(activityCounts.map(a => [a.userId, a.count]));

  const data = repStats.map(rep => ({
    userId: rep.userId,
    name: rep.name,
    email: rep.email,
    dealsWon: rep.dealsWon,
    wonValue: rep.wonValue,
    dealsLost: rep.dealsLost,
    winRate: rep.totalClosed > 0 ? Math.round((rep.dealsWon / rep.totalClosed) * 100) : 0,
    avgCycleDays: rep.avgCycleDays,
    activitiesThisMonth: activityMap.get(rep.userId) ?? 0,
  }));

  res.json(data);
});

// GET /api/analytics/overview
router.get('/overview', async (req, res) => {
  // Monthly deal count + revenue trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyTrend = await db.select({
    month: sql<string>`to_char(${deals.closedAt}, 'YYYY-MM')`,
    dealCount: sql<number>`count(*)::int`,
    revenue: sql<number>`coalesce(sum(${deals.value}), 0)::int`,
  })
    .from(deals)
    .where(and(
      eq(deals.status, 'won'),
      gte(deals.closedAt, sixMonthsAgo),
    ))
    .groupBy(sql`to_char(${deals.closedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${deals.closedAt}, 'YYYY-MM')`);

  // Win/loss overall
  const [winLoss] = await db.select({
    won: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
    lost: sql<number>`count(*) filter (where ${deals.status} = 'lost')::int`,
  }).from(deals);

  const winLossRatio = winLoss.lost > 0 ? +(winLoss.won / winLoss.lost).toFixed(2) : winLoss.won;

  res.json({
    monthlyTrend,
    winLoss: {
      won: winLoss.won,
      lost: winLoss.lost,
      ratio: winLossRatio,
    },
  });
});

export default router;
