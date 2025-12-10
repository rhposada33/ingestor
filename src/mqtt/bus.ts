import { EventEmitter } from 'events';

/**
 * Frigate event type definitions
 */
export interface FrigateEvent {
  before: {
    id: string;
    camera: string;
    frame_time: number;
    snapshot?: string;
    label: string;
    top_score: number;
    false_positive: boolean;
    start_time: number;
    end_time: number | null;
    score?: number;
  };
  after: {
    id: string;
    camera: string;
    frame_time: number;
    snapshot?: string;
    label: string;
    top_score: number;
    false_positive: boolean;
    start_time: number;
    end_time: number | null;
    score?: number;
  };
  type: 'new' | 'update' | 'end';
}

export interface FrigateReview {
  id: string;
  camera: string;
  frame_time: number;
  severity: 'alert' | 'detection';
  data: {
    type: string;
    objects: string[];
  };
  retracted: boolean;
}

export interface FrigateAvailable {
  available: boolean;
}

/**
 * Typed EventEmitter for Frigate events
 */
export class IngestorBus extends EventEmitter {
  /**
   * Emit a Frigate event
   */
  emitFrigateEvent(event: FrigateEvent): boolean {
    return this.emit('frigate:event', event);
  }

  /**
   * Emit a Frigate review
   */
  emitFrigateReview(review: FrigateReview): boolean {
    return this.emit('frigate:review', review);
  }

  /**
   * Emit a Frigate availability status
   */
  emitFrigateAvailable(available: FrigateAvailable): boolean {
    return this.emit('frigate:available', available);
  }

  /**
   * Listen for Frigate events
   */
  onFrigateEvent(listener: (event: FrigateEvent) => void): this {
    return this.on('frigate:event', listener);
  }

  /**
   * Listen for Frigate reviews
   */
  onFrigateReview(listener: (review: FrigateReview) => void): this {
    return this.on('frigate:review', listener);
  }

  /**
   * Listen for Frigate availability
   */
  onFrigateAvailable(listener: (available: FrigateAvailable) => void): this {
    return this.on('frigate:available', listener);
  }

  /**
   * Remove listener for Frigate events
   */
  offFrigateEvent(listener: (event: FrigateEvent) => void): this {
    return this.off('frigate:event', listener);
  }

  /**
   * Remove listener for Frigate reviews
   */
  offFrigateReview(listener: (review: FrigateReview) => void): this {
    return this.off('frigate:review', listener);
  }

  /**
   * Remove listener for Frigate availability
   */
  offFrigateAvailable(listener: (available: FrigateAvailable) => void): this {
    return this.off('frigate:available', listener);
  }

  /**
   * Listen once for Frigate event
   */
  onceFrigateEvent(listener: (event: FrigateEvent) => void): this {
    return this.once('frigate:event', listener);
  }

  /**
   * Listen once for Frigate review
   */
  onceFrigateReview(listener: (review: FrigateReview) => void): this {
    return this.once('frigate:review', listener);
  }

  /**
   * Listen once for Frigate availability
   */
  onceFrigateAvailable(listener: (available: FrigateAvailable) => void): this {
    return this.once('frigate:available', listener);
  }
}

/**
 * Global singleton instance of the ingestor event bus
 */
const globalForIngestorBus = global as unknown as {
  ingestorBus: IngestorBus | undefined;
};

/**
 * Get or create the singleton IngestorBus instance
 */
export function getIngestorBus(): IngestorBus {
  if (!globalForIngestorBus.ingestorBus) {
    globalForIngestorBus.ingestorBus = new IngestorBus();
  }
  return globalForIngestorBus.ingestorBus;
}

/**
 * Export singleton instance as default
 */
export const ingestorBus = getIngestorBus();
