import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, sequenceEnrollments, emailSequences, sequenceSteps } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// List enrollments (filter by dealId or sequenceId)
router.get('/', async (req, res) => {
  const dealId = req.query.dealId as string | undefined;
  const sequenceId = req.query.sequenceId as string | undefined;
  const conditions = [];

  if (dealId) conditions.push(eq(sequenceEnrollments.dealId, dealId));
  if (sequenceId) conditions.push(eq(sequenceEnrollments.sequenceId, sequenceId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db.select({
    enrollment: sequenceEnrollments,
    sequenceName: emailSequences.name,
  })
    .from(sequenceEnrollments)
    .leftJoin(emailSequences, eq(sequenceEnrollments.sequenceId, emailSequences.id))
    .where(where)
    .orderBy(sequenceEnrollments.enrolledAt);

  res.json({
    data: data.map(d => ({ ...d.enrollment, sequenceName: d.sequenceName })),
  });
});

// Enroll a deal in a sequence
router.post('/', async (req, res) => {
  const { dealId, sequenceId, contactId } = req.body;

  // Check for existing active enrollment for this deal+sequence
  const existing = await db.select().from(sequenceEnrollments)
    .where(and(
      eq(sequenceEnrollments.dealId, dealId),
      eq(sequenceEnrollments.sequenceId, sequenceId),
      eq(sequenceEnrollments.status, 'active'),
    ))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: 'Deal is already enrolled in this sequence' });
    return;
  }

  // Get first step to determine initial next_send_at
  const [firstStep] = await db.select().from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.stepNumber)
    .limit(1);

  const nextSendAt = new Date();
  if (firstStep?.delayDays > 0) {
    nextSendAt.setDate(nextSendAt.getDate() + firstStep.delayDays);
  }

  const [enrollment] = await db.insert(sequenceEnrollments).values({
    dealId,
    sequenceId,
    contactId,
    currentStep: 1,
    status: 'active',
    nextSendAt,
    enrolledBy: req.user!.userId,
  }).returning();

  res.status(201).json(enrollment);
});

// Pause enrollment
router.patch('/:id/pause', async (req, res) => {
  const { reason } = req.body;

  const [enrollment] = await db.update(sequenceEnrollments)
    .set({
      status: 'paused',
      pausedReason: reason || 'manual',
      nextSendAt: null,
    })
    .where(eq(sequenceEnrollments.id, req.params.id))
    .returning();

  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }
  res.json(enrollment);
});

// Resume enrollment
router.patch('/:id/resume', async (req, res) => {
  const [current] = await db.select().from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, req.params.id))
    .limit(1);

  if (!current) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }

  if (current.status !== 'paused') {
    res.status(400).json({ error: 'Enrollment is not paused' });
    return;
  }

  // Calculate next send time based on current step
  const [step] = await db.select().from(sequenceSteps)
    .where(and(
      eq(sequenceSteps.sequenceId, current.sequenceId),
      eq(sequenceSteps.stepNumber, current.currentStep),
    ))
    .limit(1);

  const nextSendAt = new Date();
  if (step?.delayDays > 0) {
    nextSendAt.setDate(nextSendAt.getDate() + step.delayDays);
  }

  const [enrollment] = await db.update(sequenceEnrollments)
    .set({
      status: 'active',
      pausedReason: null,
      nextSendAt,
    })
    .where(eq(sequenceEnrollments.id, req.params.id))
    .returning();

  res.json(enrollment);
});

// Cancel enrollment
router.patch('/:id/cancel', async (req, res) => {
  const [enrollment] = await db.update(sequenceEnrollments)
    .set({
      status: 'cancelled',
      nextSendAt: null,
    })
    .where(eq(sequenceEnrollments.id, req.params.id))
    .returning();

  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }
  res.json(enrollment);
});

export default router;
