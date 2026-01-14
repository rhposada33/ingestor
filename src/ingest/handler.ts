/**
 * Frigate Event Handler Module
 *
 * Processes normalized Frigate MQTT events and persists them to the database.
 * Handles:
 * - Detection events (new, update, end)
 * - Review events (user feedback, alerts)
 * - Availability status changes
 *
 * All operations use Prisma transactions for data consistency.
 */

import { prisma } from '../db/client.js';
import {
  NormalizedFrigateEvent,
  NormalizedFrigateReview,
  NormalizedFrigateAvailable,
} from '../mqtt/normalize.js';

// ==================== TYPES ====================

/**
 * Result of event ingestion
 */
export interface EventHandlerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  reason?: string;
}

/**
 * Event persistence record
 */
export interface PersistedEvent {
  id: string;
  tenantId: string;
  cameraId: string;
  frigateId: string;
  type: string;
  label?: string | null;
  hasSnapshot: boolean;
  hasClip: boolean;
  startTime?: number | null;
  endTime?: number | null;
  rawPayload: any; // JSON from Prisma
  createdAt: Date;
}

/**
 * Review persistence record
 */
export interface PersistedReview {
  id: string;
  tenantId: string;
  reviewId: string;
  cameraName: string;
  severity: string;
  retracted: boolean;
  timestamp?: Date | null;
  rawPayload: Record<string, unknown>;
  createdAt: Date;
}

// ==================== HELPERS ====================

/**
 * Resolve camera by name and get its tenant
 *
 * Since Frigate can be multi-instance, we use frigateId as tenant.
 * For single instance, frigateId is 'default'.
 *
 * @param frigateId Frigate instance ID (maps to tenant)
 * @param cameraName Camera name from Frigate
 * @returns Camera with tenant info, or null if not found
 */
async function resolveCameraByName(
  frigateId: string,
  cameraName: string
): Promise<{ id: string; tenantId: string } | null> {
  try {
    // First, find or create tenant for this Frigate instance
    const tenant = await resolveTenantByFrigateId(frigateId);

    if (!tenant) {
      return null;
    }

    // Then find camera by key (name) within tenant
    const camera = await prisma.camera.findUnique({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: cameraName,
        },
      },
    });

    if (!camera) {
      console.warn('Camera not found, auto-creating', {
        frigateId,
        camera: cameraName,
      });

      // Auto-create camera if it doesn't exist
      const newCamera = await prisma.camera.create({
        data: {
          tenantId: tenant.id,
          key: cameraName,
          label: cameraName,
        },
      });

      return {
        id: newCamera.id,
        tenantId: newCamera.tenantId,
      };
    }

    return {
      id: camera.id,
      tenantId: camera.tenantId,
    };
  } catch (error) {
    console.error('Error resolving camera', { frigateId, cameraName, error });
    return null;
  }
}

/**
 * Resolve or create tenant by Frigate instance ID
 */
async function resolveTenantByFrigateId(
  frigateId: string
): Promise<{ id: string } | null> {
  try {
    let tenant = await prisma.tenant.findUnique({
      where: { id: frigateId },
    });

    if (!tenant) {
      console.info('Creating new tenant for Frigate instance', { frigateId });
      tenant = await prisma.tenant.create({
        data: {
          id: frigateId,
          name: `Frigate ${frigateId}`,
        },
      });
    }

    return { id: tenant.id };
  } catch (error) {
    console.error('Error resolving tenant', { frigateId, error });
    return null;
  }
}
/**
 * Create or update event in database
 *
 * Uses upsert to handle duplicate events gracefully:
 * - If event already exists (same frigateId), update it
 * - Otherwise, create new event
 *
 * @param tenantId Tenant ID
 * @param cameraId Camera ID
 * @param frigateId Event ID from Frigate
 * @param type Event type (new, update, end)
 * @param label Primary detection label
 * @param hasSnapshot Snapshot available?
 * @param hasClip Clip available?
 * @param startTime Event start timestamp
 * @param endTime Event end timestamp
 * @param rawPayload Original normalized payload
 * @returns Created or updated event
 */
async function createOrUpdateEvent(
  tenantId: string,
  cameraId: string,
  frigateId: string,
  type: string,
  label: string | undefined,
  hasSnapshot: boolean,
  hasClip: boolean,
  startTime: number | null,
  endTime: number | null,
  rawPayload: Record<string, unknown>
): Promise<PersistedEvent> {
  return await prisma.event.upsert({
    where: {
      tenantId_frigateId: {
        tenantId,
        frigateId,
      },
    },
    create: {
      tenantId,
      cameraId,
      frigateId,
      type,
      label,
      hasSnapshot,
      hasClip,
      startTime,
      endTime,
      rawPayload: rawPayload as any,
    },
    update: {
      type,
      label: label || undefined,
      hasSnapshot,
      hasClip,
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      rawPayload: rawPayload as any,
    },
  });
}

// ==================== EVENT HANDLERS ====================

/**
 * Handle Frigate detection event
 *
 * Processing flow:
 * 1. Resolve camera by name and tenant
 * 2. If camera doesn't exist, auto-create it (with warning)
 * 3. Create or update event in database
 * 4. Store normalized payload and metadata
 * 5. Return persisted event
 *
 * Uses transaction for atomicity.
 *
 * @param normalized Normalized event from MQTT
 * @returns Handler result with persisted event
 *
 * @example
 * ```typescript
 * const result = await handleFrigateEvent(normalizedEvent);
 * if (result.success) {
 *   console.log(`Event saved: ${result.data.id}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
export async function handleFrigateEvent(
  normalized: NormalizedFrigateEvent
): Promise<EventHandlerResult<PersistedEvent>> {
  try {
    // 1. Resolve camera
    const camera = await resolveCameraByName(normalized.frigateId, normalized.camera);

    if (!camera) {
      const error = `Failed to resolve camera: ${normalized.camera}`;
      console.warn(error, { frigateId: normalized.frigateId });
      return {
        success: false,
        error,
        reason: 'camera_resolution_failed',
      };
    }

    // 2-5. Create or update event within transaction
    const event = await prisma.$transaction(async (tx) => {
      // Verify camera still belongs to tenant
      const verifyCamera = await tx.camera.findUnique({
        where: { id: camera.id },
      });

      if (!verifyCamera || verifyCamera.tenantId !== camera.tenantId) {
        throw new Error('Camera tenant mismatch');
      }

      // Create or update event
      return await tx.event.upsert({
        where: {
          tenantId_frigateId: {
            tenantId: camera.tenantId,
            frigateId: normalized.eventId,
          },
        },
        create: {
          tenantId: camera.tenantId,
          cameraId: camera.id,
          frigateId: normalized.eventId,
          type: normalized.type,
          label: normalized.label,
          hasSnapshot: normalized.hasSnapshot,
          hasClip: normalized.hasClip,
          startTime: normalized.startTime,
          endTime: normalized.endTime,
          rawPayload: normalized.raw as any,
        },
        update: {
          type: normalized.type,
          label: normalized.label,
          hasSnapshot: normalized.hasSnapshot,
          hasClip: normalized.hasClip,
          startTime: normalized.startTime ?? undefined,
          endTime: normalized.endTime ?? undefined,
          rawPayload: normalized.raw as any,
        },
      });
    });

    return {
      success: true,
      data: event as PersistedEvent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error handling Frigate event', {
      error: errorMessage,
      frigateId: normalized.frigateId,
      camera: normalized.camera,
    });

    return {
      success: false,
      error: errorMessage,
      reason: 'handler_error',
    };
  }
}

/**
 * Handle Frigate review event
 *
 * Reviews represent user feedback or alerts on detection events.
 * Stores review metadata separately from events for analysis.
 *
 * Processing flow:
 * 1. Resolve camera by name and tenant
 * 2. If camera doesn't exist, auto-create it
 * 3. Store review record with metadata
 * 4. Return persisted review
 *
 * Uses transaction for atomicity.
 *
 * @param normalized Normalized review from MQTT
 * @returns Handler result with persisted review
 *
 * @example
 * ```typescript
 * const result = await handleFrigateReview(normalizedReview);
 * if (result.success) {
 *   console.log(`Review saved: ${result.data.id}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 *
 * @todo Add Review model to Prisma schema
 * @todo Store review severity levels
 * @todo Track review timestamps
 * @todo Store reviewer email/user
 */
export async function handleFrigateReview(
  normalized: NormalizedFrigateReview
): Promise<EventHandlerResult<PersistedReview>> {
  try {
    // 1. Resolve camera
    const camera = await resolveCameraByName(normalized.frigateId, normalized.camera);

    if (!camera) {
      const error = `Failed to resolve camera: ${normalized.camera}`;
      console.warn(error, { frigateId: normalized.frigateId });
      return {
        success: false,
        error,
        reason: 'camera_resolution_failed',
      };
    }

    const timestamp = normalized.timestamp
      ? new Date(normalized.timestamp * 1000)
      : null;

    const review = await prisma.review.upsert({
      where: {
        tenantId_reviewId: {
          tenantId: camera.tenantId,
          reviewId: normalized.reviewId,
        },
      },
      create: {
        tenantId: camera.tenantId,
        cameraId: camera.id,
        reviewId: normalized.reviewId,
        cameraName: normalized.camera,
        severity: normalized.severity,
        retracted: normalized.retracted,
        timestamp,
        rawPayload: normalized.raw as any,
      },
      update: {
        severity: normalized.severity,
        retracted: normalized.retracted,
        timestamp: timestamp ?? undefined,
        rawPayload: normalized.raw as any,
      },
    });

    console.info('Review persisted', {
      reviewId: review.reviewId,
      frigateId: normalized.frigateId,
      camera: normalized.camera,
      severity: normalized.severity,
      retracted: normalized.retracted,
    });

    return {
      success: true,
      data: review as PersistedReview,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error handling Frigate review', {
      error: errorMessage,
      frigateId: normalized.frigateId,
      camera: normalized.camera,
    });

    return {
      success: false,
      error: errorMessage,
      reason: 'handler_error',
    };
  }
}

/**
 * Handle Frigate availability status change
 *
 * Tracks when Frigate comes online or goes offline.
 * Used for monitoring system health and availability metrics.
 *
 * @param normalized Normalized availability status from MQTT
 * @returns Handler result with status
 *
 * @example
 * ```typescript
 * const result = await handleFrigateAvailability(normalizedStatus);
 * if (result.success) {
 *   console.log(`Frigate ${normalized.frigateId} is ${normalized.available ? 'online' : 'offline'}`);
 * }
 * ```
 *
 * @todo Add SystemStatus or AvailabilityLog model to Prisma schema
 * @todo Track availability history
 * @todo Calculate uptime metrics
 * @todo Send alerts on status changes
 * @todo Store previous state for duration calculation
 */
export async function handleFrigateAvailability(
  normalized: NormalizedFrigateAvailable
): Promise<EventHandlerResult<{ frigateId: string; available: boolean }>> {
  try {
    const tenant = await resolveTenantByFrigateId(normalized.frigateId);

    if (!tenant) {
      const error = `Failed to resolve tenant: ${normalized.frigateId}`;
      console.warn(error, { frigateId: normalized.frigateId });
      return {
        success: false,
        error,
        reason: 'tenant_resolution_failed',
      };
    }

    await prisma.availabilityLog.create({
      data: {
        tenantId: tenant.id,
        available: normalized.available,
        timestamp: new Date(normalized.timestamp * 1000),
        rawPayload: normalized.raw as any,
      },
    });

    console.info('Frigate availability', {
      frigateId: normalized.frigateId,
      available: normalized.available,
      timestamp: normalized.timestamp,
    });

    return {
      success: true,
      data: {
        frigateId: normalized.frigateId,
        available: normalized.available,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error handling Frigate availability', {
      error: errorMessage,
      frigateId: normalized.frigateId,
    });

    return {
      success: false,
      error: errorMessage,
      reason: 'handler_error',
    };
  }
}

// ==================== BATCH OPERATIONS ====================

/**
 * Handle multiple events in batch
 *
 * Process an array of normalized events efficiently.
 * Continues processing even if individual events fail.
 *
 * @param events Array of normalized events
 * @returns Array of results (success or failure for each)
 *
 * @example
 * ```typescript
 * const events = [event1, event2, event3];
 * const results = await handleFrigateEventsBatch(events);
 *
 * const successful = results.filter(r => r.success).length;
 * const failed = results.filter(r => !r.success).length;
 * console.log(`Processed: ${successful} success, ${failed} failed`);
 * ```
 *
 * @todo Add parallel processing with concurrency limit
 * @todo Add metrics collection (success rate, duration)
 * @todo Add dead-letter queue for failed items
 */
export async function handleFrigateEventsBatch(
  events: NormalizedFrigateEvent[]
): Promise<EventHandlerResult<PersistedEvent>[]> {
  const results: EventHandlerResult<PersistedEvent>[] = [];

  for (const event of events) {
    const result = await handleFrigateEvent(event);
    results.push(result);
  }

  return results;
}

/**
 * Handle multiple reviews in batch
 *
 * @param reviews Array of normalized reviews
 * @returns Array of results
 *
 * @example
 * ```typescript
 * const results = await handleFrigateReviewsBatch(reviews);
 * ```
 */
export async function handleFrigateReviewsBatch(
  reviews: NormalizedFrigateReview[]
): Promise<EventHandlerResult<PersistedReview>[]> {
  const results: EventHandlerResult<PersistedReview>[] = [];

  for (const review of reviews) {
    const result = await handleFrigateReview(review);
    results.push(result);
  }

  return results;
}

/**
 * Safe event handler wrapper
 *
 * Calls handler and guarantees safe return (never throws).
 * Useful for MQTT message handlers.
 *
 * @param normalized Normalized event
 * @returns Handler result (always resolves)
 *
 * @example
 * ```typescript
 * subscriber.onFrigateEvent((normalized) => {
 *   safeFrigateEventHandler(normalized).catch(err => {
 *     console.error('Unexpected error:', err);
 *   });
 * });
 * ```
 */
export async function safeFrigateEventHandler(
  normalized: NormalizedFrigateEvent
): Promise<EventHandlerResult<PersistedEvent>> {
  try {
    return await handleFrigateEvent(normalized);
  } catch (error) {
    console.error('Unexpected error in safe handler', { error });
    return {
      success: false,
      error: 'Unexpected error',
      reason: 'uncaught_exception',
    };
  }
}

// ==================== EXPORTS ====================

export {
  resolveCameraByName,
  resolveTenantByFrigateId,
  createOrUpdateEvent,
};

/**
 * Export all handlers as object for convenience
 *
 * @example
 * ```typescript
 * import { handlers } from './handler.js';
 *
 * ingestorBus.onFrigateEvent((event) => {
 *   handlers.event(event);
 * });
 * ```
 */
export const handlers = {
  event: handleFrigateEvent,
  review: handleFrigateReview,
  availability: handleFrigateAvailability,
};
