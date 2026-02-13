import { randomUUID } from 'crypto';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { DomainEventBus } from '../../core/types/domain-events.js';
import { createEvent } from '../../core/types/domain-events.js';
import type { FeedbackEntry, TrainingExample } from '../domain/types.js';
import { FeedbackError } from '../domain/errors.js';
import type { IFeedbackStore } from './feedback-store.js';
import type { IExampleStore } from './example-store.js';
export interface ConversationMessage {
  readonly userInput: string;
  readonly assistantOutput: string;
}

export class FeedbackProcessor {
  constructor(
    private readonly feedbackStore: IFeedbackStore,
    private readonly exampleStore: IExampleStore,
    private readonly eventBus: DomainEventBus
  ) {}

  async processFeedback(
    feedback: FeedbackEntry,
    conversation?: ConversationMessage
  ): Promise<Result<void, FeedbackError>> {
    try {
      // Save feedback
      await this.feedbackStore.save(feedback);

      // Emit event
      const event = createEvent<{ feedback: FeedbackEntry }>(
        'training.feedback.received',
        { feedback },
        'training'
      );
      await this.eventBus.publish(event);

      // Auto-create training example from positive feedback
      if (feedback.rating === 'positive' && conversation) {
        const example: TrainingExample = {
          id: randomUUID(),
          tenantId: feedback.tenantId,
          input: conversation.userInput,
          expectedOutput: conversation.assistantOutput,
          category: 'custom',
          quality: 4, // Default quality for auto-generated examples
          createdAt: new Date(),
          metadata: {
            source: 'positive_feedback',
            feedbackId: feedback.id,
            comment: feedback.comment,
          },
        };

        await this.exampleStore.save(example);
      }

      // If negative, flag for manual review by publishing a review event
      if (feedback.rating === 'negative') {
        const reviewEvent = createEvent<{ feedback: FeedbackEntry; reason: string }>(
          'training.feedback.flagged_for_review',
          {
            feedback,
            reason: feedback.comment
              ? `Negative feedback: ${feedback.comment}`
              : 'Negative feedback received',
          },
          'training'
        );
        await this.eventBus.publish(reviewEvent);
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new FeedbackError(`Failed to process feedback: ${message}`));
    }
  }
}
