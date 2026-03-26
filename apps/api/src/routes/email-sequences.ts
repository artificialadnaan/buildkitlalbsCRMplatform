import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, emailSequences, sequenceSteps, emailTemplates } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// List sequences
router.get('/', async (req, res) => {
  const pipelineType = req.query.pipelineType as string | undefined;
  const where = pipelineType ? eq(emailSequences.pipelineType, pipelineType as 'local' | 'construction') : undefined;

  const sequences = await db.select().from(emailSequences).where(where).orderBy(emailSequences.createdAt);

  // Get step counts for each sequence
  const data = await Promise.all(
    sequences.map(async (seq) => {
      const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id));
      return { ...seq, stepCount: steps.length };
    })
  );

  res.json({ data });
});

// Get single sequence with steps + template info
router.get('/:id', async (req, res) => {
  const [sequence] = await db.select().from(emailSequences).where(eq(emailSequences.id, req.params.id)).limit(1);
  if (!sequence) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }

  const steps = await db.select({
    step: sequenceSteps,
    templateName: emailTemplates.name,
    templateSubject: emailTemplates.subject,
  })
    .from(sequenceSteps)
    .leftJoin(emailTemplates, eq(sequenceSteps.templateId, emailTemplates.id))
    .where(eq(sequenceSteps.sequenceId, sequence.id))
    .orderBy(sequenceSteps.stepNumber);

  res.json({
    sequence,
    steps: steps.map(s => ({
      ...s.step,
      templateName: s.templateName,
      templateSubject: s.templateSubject,
    })),
  });
});

// Create sequence with steps (atomic)
router.post('/', async (req, res) => {
  const { name, pipelineType, steps } = req.body;

  const [sequence] = await db.insert(emailSequences).values({
    name,
    pipelineType,
  }).returning();

  const insertedSteps = steps?.length
    ? await db.insert(sequenceSteps).values(
        steps.map((s: { templateId: string; stepNumber: number; delayDays: number }) => ({
          sequenceId: sequence.id,
          templateId: s.templateId,
          stepNumber: s.stepNumber,
          delayDays: s.delayDays,
        }))
      ).returning()
    : [];

  res.status(201).json({ sequence, steps: insertedSteps });
});

// Update sequence — replaces all steps
router.patch('/:id', async (req, res) => {
  const { name, pipelineType, steps } = req.body;

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (pipelineType) updates.pipelineType = pipelineType;

  let sequence;
  if (Object.keys(updates).length > 0) {
    [sequence] = await db.update(emailSequences)
      .set(updates)
      .where(eq(emailSequences.id, req.params.id))
      .returning();
  } else {
    [sequence] = await db.select().from(emailSequences).where(eq(emailSequences.id, req.params.id)).limit(1);
  }

  if (!sequence) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }

  // Replace steps if provided
  let updatedSteps;
  if (steps) {
    await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequence.id));
    updatedSteps = steps.length > 0
      ? await db.insert(sequenceSteps).values(
          steps.map((s: { templateId: string; stepNumber: number; delayDays: number }) => ({
            sequenceId: sequence.id,
            templateId: s.templateId,
            stepNumber: s.stepNumber,
            delayDays: s.delayDays,
          }))
        ).returning()
      : [];
  } else {
    updatedSteps = await db.select().from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, sequence.id))
      .orderBy(sequenceSteps.stepNumber);
  }

  res.json({ sequence, steps: updatedSteps });
});

// Delete sequence (cascade deletes steps)
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(emailSequences).where(eq(emailSequences.id, req.params.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
