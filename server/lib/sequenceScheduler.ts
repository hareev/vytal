import { eq, and, lte } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { dispatchWebhook } from './webhookDispatcher.js';

async function processEnrollments(): Promise<void> {
  const now = new Date();

  // Find all active enrollments that are due
  const dueEnrollments = await db
    .select()
    .from(schema.sequence_enrollments)
    .where(
      and(
        eq(schema.sequence_enrollments.status, 'active'),
        lte(schema.sequence_enrollments.next_send_at, now),
      ),
    );

  for (const enrollment of dueEnrollments) {
    try {
      // Get the sequence's steps ordered by position
      const steps = await db
        .select()
        .from(schema.sequence_steps)
        .where(eq(schema.sequence_steps.sequence_id, enrollment.sequence_id))
        .orderBy(schema.sequence_steps.position);

      const totalSteps = steps.length;
      const currentStepIndex = enrollment.current_step;

      // If we've already completed all steps, mark as completed
      if (currentStepIndex >= totalSteps) {
        await db
          .update(schema.sequence_enrollments)
          .set({ status: 'completed', completed_at: now })
          .where(eq(schema.sequence_enrollments.id, enrollment.id));

        await dispatchWebhook(enrollment.org_id, 'sequence.completed', {
          sequenceId: enrollment.sequence_id,
          contactId: enrollment.contact_id,
          enrollmentId: enrollment.id,
        });

        continue;
      }

      const currentStep = steps[currentStepIndex];

      if (!currentStep) continue;

      const nextStepIndex = currentStepIndex + 1;

      if (currentStep.type === 'email') {
        // In a real system this would call an email provider
        console.log(
          `[sequenceScheduler] Sending email step ${currentStepIndex} for enrollment ${enrollment.id} (contact: ${enrollment.contact_id})`,
        );

        if (nextStepIndex >= totalSteps) {
          // Last step — mark completed
          await db
            .update(schema.sequence_enrollments)
            .set({
              current_step: nextStepIndex,
              status: 'completed',
              next_send_at: null,
              completed_at: now,
            })
            .where(eq(schema.sequence_enrollments.id, enrollment.id));

          await dispatchWebhook(enrollment.org_id, 'sequence.completed', {
            sequenceId: enrollment.sequence_id,
            contactId: enrollment.contact_id,
            enrollmentId: enrollment.id,
          });
        } else {
          const nextStep = steps[nextStepIndex];
          const delayMs = (nextStep?.delay_hours ?? 0) * 60 * 60 * 1000;
          const nextSendAt = new Date(now.getTime() + delayMs);

          await db
            .update(schema.sequence_enrollments)
            .set({ current_step: nextStepIndex, next_send_at: nextSendAt })
            .where(eq(schema.sequence_enrollments.id, enrollment.id));
        }
      } else if (currentStep.type === 'wait') {
        // Advance time by the delay
        const delayMs = (currentStep.delay_hours ?? 0) * 60 * 60 * 1000;
        const nextSendAt = new Date(now.getTime() + delayMs);

        await db
          .update(schema.sequence_enrollments)
          .set({ current_step: nextStepIndex, next_send_at: nextSendAt })
          .where(eq(schema.sequence_enrollments.id, enrollment.id));
      } else {
        // 'condition' or unknown — just advance
        if (nextStepIndex >= totalSteps) {
          await db
            .update(schema.sequence_enrollments)
            .set({
              current_step: nextStepIndex,
              status: 'completed',
              next_send_at: null,
              completed_at: now,
            })
            .where(eq(schema.sequence_enrollments.id, enrollment.id));

          await dispatchWebhook(enrollment.org_id, 'sequence.completed', {
            sequenceId: enrollment.sequence_id,
            contactId: enrollment.contact_id,
            enrollmentId: enrollment.id,
          });
        } else {
          const nextStep = steps[nextStepIndex];
          const delayMs = (nextStep?.delay_hours ?? 0) * 60 * 60 * 1000;
          const nextSendAt = new Date(now.getTime() + delayMs);

          await db
            .update(schema.sequence_enrollments)
            .set({ current_step: nextStepIndex, next_send_at: nextSendAt })
            .where(eq(schema.sequence_enrollments.id, enrollment.id));
        }
      }
    } catch (err) {
      console.error(
        `[sequenceScheduler] Error processing enrollment ${enrollment.id}:`,
        err,
      );
    }
  }
}

export function startSequenceScheduler(): NodeJS.Timeout {
  console.log('[sequenceScheduler] Starting — polling every 60 seconds');

  // Run once immediately, then on interval
  processEnrollments().catch((err) => {
    console.error('[sequenceScheduler] Initial run error:', err);
  });

  return setInterval(() => {
    processEnrollments().catch((err) => {
      console.error('[sequenceScheduler] Poll error:', err);
    });
  }, 60_000);
}
