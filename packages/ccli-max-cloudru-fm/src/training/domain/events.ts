import type { DomainEvent } from '../../core/types/domain-events.js';
import type { TrainingExample, FeedbackEntry, TrainingContext } from './types.js';

export interface ExampleAdded extends DomainEvent {
  type: 'training.example.added';
  payload: {
    example: TrainingExample;
  };
}

export interface ExampleRemoved extends DomainEvent {
  type: 'training.example.removed';
  payload: {
    exampleId: string;
    tenantId: string;
  };
}

export interface ExampleRated extends DomainEvent {
  type: 'training.example.rated';
  payload: {
    exampleId: string;
    quality: number;
  };
}

export interface FeedbackReceived extends DomainEvent {
  type: 'training.feedback.received';
  payload: {
    feedback: FeedbackEntry;
  };
}

export interface ContextBuilt extends DomainEvent {
  type: 'training.context.built';
  payload: {
    context: TrainingContext;
    exampleCount: number;
  };
}

export interface ContextInvalidated extends DomainEvent {
  type: 'training.context.invalidated';
  payload: {
    tenantId: string;
    reason: string;
  };
}

export interface FeedbackFlaggedForReview extends DomainEvent {
  type: 'training.feedback.flagged_for_review';
  payload: {
    feedback: FeedbackEntry;
    reason: string;
  };
}
