/**
 * MQTT Payload Normalization Module
 *
 * Pure functions to normalize Frigate MQTT event payloads into consistent schemas.
 * Functions are defensive and never throw; they return null on invalid data.
 *
 * Normalized payloads ensure:
 * - Consistent field names and types across Frigate versions
 * - Safe extraction of required fields with null coalescing
 * - Clear audit trail (raw payload preserved)
 * - Future-proof structure for database schema evolution
 */

// ==================== TYPES ====================

/**
 * Normalized Frigate detection event
 *
 * Represents a single detection event from Frigate.
 * Preserves the raw payload for debugging and future schema updates.
 *
 * @todo Add strict validation: enum for type values (new|update|end)
 * @todo Add strict validation: enum for label values (person|car|dog|cat|etc)
 * @todo Validate timestamp ranges (endTime >= startTime)
 * @todo Add confidence/accuracy scores if available in raw payload
 * @todo Add detection region/box coordinates when Frigate includes them
 */
export interface NormalizedFrigateEvent {
  // Frigate instance identifier (from MQTT topic)
  frigateId: string;

  // Event ID from payload (from before.id or after.id)
  eventId: string;

  // Camera name (from MQTT topic)
  camera: string;

  // Event lifecycle type
  type: 'new' | 'update' | 'end';

  // Primary detected object label (person, car, dog, cat, etc.)
  label: string;

  // Availability flags
  hasSnapshot: boolean;
  hasClip: boolean;

  // Timestamps (Unix seconds)
  startTime: number | null;
  endTime: number | null;

  // Raw MQTT payload for audit trail
  raw: Record<string, unknown>;

  // Additional detection metadata
  metadata?: {
    // Top scored label with confidence
    topLabel?: string;
    topConfidence?: number;

    // All detected labels with counts
    detectedLabels?: Record<string, number>;

    // Zone information if available
    zones?: string[];

    // Sub-label/class if available (e.g., "person" -> "person_sitting")
    subLabel?: string;
  };
}

/**
 * Normalized Frigate review event
 *
 * Represents a user review or alert in Frigate.
 * Used for tracking user feedback on events.
 *
 * @todo Add strict validation: enum for severity (alert|detection|review)
 * @todo Validate review timestamp
 * @todo Add user identifier if available
 * @todo Add review comment/note field
 */
export interface NormalizedFrigateReview {
  // Frigate instance identifier
  frigateId: string;

  // Review/event identifier
  reviewId: string;

  // Camera name
  camera: string;

  // Event severity level
  severity: 'alert' | 'detection' | 'review';

  // Whether review was retracted by user
  retracted: boolean;

  // When review was created
  timestamp: number | null;

  // Raw MQTT payload for audit trail
  raw: Record<string, unknown>;

  // Optional additional review data
  metadata?: {
    // User email if available
    reviewerEmail?: string;

    // Review comment/note
    note?: string;

    // Related event ID if available
    eventId?: string;

    // Confidence score if available
    confidence?: number;
  };
}

/**
 * Normalized Frigate availability status
 *
 * Indicates whether Frigate is online/offline.
 *
 * @todo Add more detail on disconnection reasons
 * @todo Add Frigate version information
 * @todo Add uptime/availability metrics
 */
export interface NormalizedFrigateAvailable {
  // Frigate instance identifier
  frigateId: string;

  // Current availability status
  available: boolean;

  // Timestamp of status change
  timestamp: number;

  // Raw MQTT payload
  raw: Record<string, unknown>;

  // Optional metadata
  metadata?: {
    // Previous availability state
    previousState?: boolean;

    // State change duration (ms)
    duration?: number;

    // Frigate version if available
    version?: string;
  };
}

// ==================== UTILITIES ====================

/**
 * Extract Frigate instance ID from MQTT topic
 *
 * Frigate MQTT topics follow pattern: frigate/<frigate_id>/...
 * or just: frigate/... (uses 'default' as ID)
 *
 * @param topic MQTT topic path
 * @returns Frigate instance ID
 *
 * @example
 * extractFrigateId('frigate/events/front_door')        → 'default'
 * extractFrigateId('frigate/my-instance/events/...')   → 'my-instance'
 */
function extractFrigateId(topic: string): string {
  const parts = topic.split('/');

  // Format: frigate/events/... or frigate/<id>/events/...
  if (parts[0] !== 'frigate') {
    return 'default';
  }

  // If second part is not a known event type, it's the frigate ID
  if (parts[1] && !['events', 'reviews', 'available'].includes(parts[1])) {
    return parts[1];
  }

  return 'default';
}

/**
 * Extract camera name from MQTT topic
 *
 * Topics follow pattern: frigate/[id/]events/<camera> or frigate/[id/]reviews/<camera>
 *
 * @param topic MQTT topic path
 * @returns Camera name or 'unknown'
 */
function extractCameraFromTopic(topic: string): string {
  const parts = topic.split('/');

  // Format: frigate/events/<camera> or frigate/<id>/events/<camera>
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'events' && parts[i + 1]) {
      return parts[i + 1];
    }
  }

  // Format: frigate/reviews/<camera> or frigate/<id>/reviews/<camera>
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'reviews' && parts[i + 1]) {
      return parts[i + 1];
    }
  }

  return 'unknown';
}

/**
 * Safely get value from object with type checking
 *
 * @param obj Object to query
 * @param key Property key
 * @param defaultValue Value if key missing or type incorrect
 * @returns Value or default
 */
function safeGet<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue?: T
): T | null {
  if (!obj || typeof obj !== 'object' || !(key in obj)) {
    return defaultValue ?? null;
  }

  const value = obj[key];

  // Return as-is; caller responsible for type safety
  return value as T;
}

/**
 * Convert value to number safely
 *
 * @param value Value to convert
 * @param defaultValue Fallback if conversion fails
 * @returns Number or default
 */
function toNumber(value: unknown, defaultValue: number | null = null): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Convert value to boolean safely
 *
 * @param value Value to convert
 * @returns Boolean value
 */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', ''].includes(normalized)) {
      return false;
    }
    // Non-empty string (e.g., file path) should be treated as truthy
    return true;
  }
  if (value === 1) {
    return true;
  }
  return false;
}

// ==================== NORMALIZERS ====================

/**
 * Normalize Frigate detection event message
 *
 * Converts raw MQTT payload into consistent NormalizedFrigateEvent format.
 * Never throws; returns null on invalid data.
 *
 * Handles various Frigate payload formats:
 * - Old format: type, label, before, after
 * - New format: type, label, snapshot, clip
 * - Timezone variations
 *
 * @param rawPayload Raw MQTT message payload (parsed JSON)
 * @param topic MQTT topic (for extracting camera name and frigate ID)
 * @returns Normalized event or null if invalid
 *
 * @example
 * const event = normalizeEventMessage({
 *   type: 'end',
 *   label: 'person',
 *   snapshot: true,
 *   clip: true,
 *   start_time: 1702200000,
 *   end_time: 1702200010
 * }, 'frigate/events/front_door');
 *
 * // Returns:
 * // {
 * //   frigateId: 'default',
 * //   camera: 'front_door',
 * //   type: 'end',
 * //   label: 'person',
 * //   hasSnapshot: true,
 * //   hasClip: true,
 * //   startTime: 1702200000,
 * //   endTime: 1702200010,
 * //   raw: { ... }
 * // }
 */
export function normalizeEventMessage(
  rawPayload: unknown,
  topic: string
): NormalizedFrigateEvent | null {
  // Validate input is object
  if (!rawPayload || typeof rawPayload !== 'object') {
    console.warn('normalizeEventMessage: Invalid payload type', { rawPayload, topic });
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;

  // Extract required fields with fallbacks
  const type = safeGet<string>(payload, 'type');
  const frigateId = extractFrigateId(topic);
  const cameraFromTopic = extractCameraFromTopic(topic);
  const cameraFromPayload =
    safeGet<string>(payload, 'camera') ||
    safeGet<string>(safeGet<Record<string, unknown>>(payload, 'after'), 'camera') ||
    safeGet<string>(safeGet<Record<string, unknown>>(payload, 'before'), 'camera');
  const camera = cameraFromTopic !== 'unknown' ? cameraFromTopic : cameraFromPayload || 'unknown';

  // Validate event type
  if (!type || !['new', 'update', 'end'].includes(type)) {
    console.warn('normalizeEventMessage: Invalid or missing type', { type, topic });
    return null;
  }

  const before_data = safeGet<Record<string, unknown>>(payload, 'before');
  const after_data = safeGet<Record<string, unknown>>(payload, 'after');

  // Extract snapshot and clip availability
  // Handle both old (snapshot/clip booleans) and new (has_snapshot/has_clip) formats
  const hasSnapshot =
    toBoolean(safeGet(payload, 'snapshot')) ||
    toBoolean(safeGet(payload, 'has_snapshot')) ||
    toBoolean(safeGet(before_data, 'snapshot')) ||
    toBoolean(safeGet(before_data, 'has_snapshot')) ||
    toBoolean(safeGet(after_data, 'snapshot')) ||
    toBoolean(safeGet(after_data, 'has_snapshot'));
  const hasClip =
    toBoolean(safeGet(payload, 'clip')) ||
    toBoolean(safeGet(payload, 'has_clip')) ||
    toBoolean(safeGet(before_data, 'clip')) ||
    toBoolean(safeGet(before_data, 'has_clip')) ||
    toBoolean(safeGet(after_data, 'clip')) ||
    toBoolean(safeGet(after_data, 'has_clip'));

  // Extract timestamps
  // Handle formats: start_time, startTime, unix seconds, milliseconds
  let startTime: number | null = null;
  let endTime: number | null = null;

  const rawStartTime = safeGet(payload, 'start_time') || safeGet(payload, 'startTime');
  if (rawStartTime !== null) {
    startTime = toNumber(rawStartTime);
  }

  const rawEndTime = safeGet(payload, 'end_time') || safeGet(payload, 'endTime');
  if (rawEndTime !== null) {
    endTime = toNumber(rawEndTime);
  }

  const label =
    safeGet<string>(payload, 'label') ||
    safeGet<string>(before_data, 'label') ||
    safeGet<string>(after_data, 'label') ||
    'unknown';

  // Extract event ID from before or after
  const eventId = safeGet<string>(payload, 'id') ||
    safeGet<string>(before_data, 'id') ||
    safeGet<string>(after_data, 'id') ||
    'unknown';

  // Build metadata
  const metadata: NormalizedFrigateEvent['metadata'] = {};

  // Extract detected labels from before/after counts
  if (before_data || after_data) {
    const detectedLabels: Record<string, number> = {};

    if (after_data) {
      for (const [key, value] of Object.entries(after_data)) {
        if (typeof value === 'number' && key !== 'count') {
          detectedLabels[key] = value;
        }
      }
    }

    if (Object.keys(detectedLabels).length > 0) {
      metadata.detectedLabels = detectedLabels;
      // Top label is the one with highest count
      const topLabelEntry = Object.entries(detectedLabels).sort(
        ([, a], [, b]) => b - a
      )[0];
      if (topLabelEntry) {
        metadata.topLabel = topLabelEntry[0];
        metadata.topConfidence = topLabelEntry[1];
      }
    }
  }

  // Extract zones if available
  const zones = safeGet<string[]>(payload, 'zones');
  if (zones && Array.isArray(zones) && zones.length > 0) {
    metadata.zones = zones;
  }

  // Extract sub-label if available
  const subLabel = safeGet<string>(payload, 'sub_label') || safeGet<string>(payload, 'subLabel');
  if (subLabel) {
    metadata.subLabel = subLabel;
  }

  return {
    frigateId,
    eventId,
    camera,
    type: type as 'new' | 'update' | 'end',
    label,
    hasSnapshot,
    hasClip,
    startTime,
    endTime,
    raw: payload,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Normalize Frigate review/alert message
 *
 * Converts raw MQTT payload into consistent NormalizedFrigateReview format.
 * Never throws; returns null on invalid data.
 *
 * @param rawPayload Raw MQTT message payload (parsed JSON)
 * @param topic MQTT topic (for extracting camera name and frigate ID)
 * @returns Normalized review or null if invalid
 *
 * @example
 * const review = normalizeReviewMessage({
 *   id: 'review-123',
 *   severity: 'alert',
 *   retracted: false,
 *   timestamp: 1702200000
 * }, 'frigate/reviews/front_door');
 *
 * // Returns:
 * // {
 * //   frigateId: 'default',
 * //   reviewId: 'review-123',
 * //   camera: 'front_door',
 * //   severity: 'alert',
 * //   retracted: false,
 * //   timestamp: 1702200000,
 * //   raw: { ... }
 * // }
 */
export function normalizeReviewMessage(
  rawPayload: unknown,
  topic: string
): NormalizedFrigateReview | null {
  // Validate input is object
  if (!rawPayload || typeof rawPayload !== 'object') {
    console.warn('normalizeReviewMessage: Invalid payload type', { rawPayload, topic });
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;

  // Extract required fields
  const reviewId = safeGet<string>(payload, 'id');
  const severity = safeGet<string>(payload, 'severity');
  const frigateId = extractFrigateId(topic);
  const cameraFromTopic = extractCameraFromTopic(topic);
  const camera = cameraFromTopic !== 'unknown'
    ? cameraFromTopic
    : safeGet<string>(payload, 'camera') || 'unknown';

  // Validate required fields
  if (!reviewId) {
    console.warn('normalizeReviewMessage: Missing review ID', { topic });
    return null;
  }

  if (!severity || !['alert', 'detection', 'review'].includes(severity)) {
    console.warn('normalizeReviewMessage: Invalid or missing severity', { severity, topic });
    return null;
  }

  // Extract optional fields
  const retracted = toBoolean(safeGet(payload, 'retracted'));
  const rawTimestamp = safeGet(payload, 'timestamp');
  const timestamp = rawTimestamp ? toNumber(rawTimestamp) : null;

  // Build metadata
  const metadata: NormalizedFrigateReview['metadata'] = {};

  const reviewerEmail = safeGet<string>(payload, 'reviewer_email');
  if (reviewerEmail) {
    metadata.reviewerEmail = reviewerEmail;
  }

  const note = safeGet<string>(payload, 'note');
  if (note) {
    metadata.note = note;
  }

  const eventId = safeGet<string>(payload, 'event_id');
  if (eventId) {
    metadata.eventId = eventId;
  }

  const confidence = safeGet<number>(payload, 'confidence');
  if (confidence !== null) {
    metadata.confidence = toNumber(confidence) || undefined;
  }

  return {
    frigateId,
    reviewId,
    camera,
    severity: severity as 'alert' | 'detection' | 'review',
    retracted,
    timestamp,
    raw: payload,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Normalize Frigate availability status message
 *
 * Converts raw MQTT payload into consistent NormalizedFrigateAvailable format.
 * Never throws; returns null on invalid data.
 *
 * Topic: frigate/available (for default instance) or frigate/<id>/available
 *
 * @param rawPayload Raw MQTT message payload (can be string 'true'/'false' or parsed JSON)
 * @param topic MQTT topic
 * @returns Normalized availability or null if invalid
 *
 * @example
 * // Frigate sends "true" or "false" as plain string
 * const avail = normalizeAvailabilityMessage('true', 'frigate/available');
 *
 * // Returns:
 * // {
 * //   frigateId: 'default',
 * //   available: true,
 * //   timestamp: 1702200000,
 * //   raw: { value: true }
 * // }
 */
export function normalizeAvailabilityMessage(
  rawPayload: unknown,
  topic: string
): NormalizedFrigateAvailable | null {
  const frigateId = extractFrigateId(topic);
  const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds

  // Handle string payload (Frigate sends "true" or "false")
  let available: boolean;
  let rawObject: Record<string, unknown>;

  if (typeof rawPayload === 'string') {
    available = rawPayload.toLowerCase() === 'true';
    rawObject = { value: rawPayload };
  } else if (typeof rawPayload === 'object' && rawPayload !== null) {
    const payload = rawPayload as Record<string, unknown>;
    const value = safeGet(payload, 'available') || safeGet(payload, 'online');

    if (value === null) {
      console.warn('normalizeAvailabilityMessage: Missing availability status', { topic });
      return null;
    }

    available = toBoolean(value);
    rawObject = payload;
  } else {
    console.warn('normalizeAvailabilityMessage: Invalid payload type', {
      type: typeof rawPayload,
      topic,
    });
    return null;
  }

  return {
    frigateId,
    available,
    timestamp,
    raw: rawObject,
  };
}

// ==================== BATCH OPERATIONS ====================

/**
 * Attempt to normalize a message based on MQTT topic
 *
 * Automatically routes to appropriate normalizer based on topic pattern.
 *
 * @param rawPayload Raw MQTT message
 * @param topic MQTT topic
 * @returns Normalized message (any type) or null if invalid
 *
 * @example
 * const normalized = normalizeMessage(payload, 'frigate/events/front_door');
 * if (normalized && 'type' in normalized) {
 *   // It's a NormalizedFrigateEvent
 * }
 */
export function normalizeMessage(
  rawPayload: unknown,
  topic: string
): NormalizedFrigateEvent | NormalizedFrigateReview | NormalizedFrigateAvailable | null {
  if (!topic || typeof topic !== 'string') {
    return null;
  }

  try {
    if (topic === 'frigate/events' || topic.includes('/events/')) {
      return normalizeEventMessage(rawPayload, topic);
    }

    if (topic === 'frigate/reviews' || topic.includes('/reviews')) {
      return normalizeReviewMessage(rawPayload, topic);
    }

    if (topic === 'frigate/available' || topic.includes('/available')) {
      return normalizeAvailabilityMessage(rawPayload, topic);
    }

    console.warn('normalizeMessage: Unknown topic pattern', { topic });
    return null;
  } catch (error) {
    console.error('normalizeMessage: Unexpected error during normalization', {
      error,
      topic,
    });
    return null;
  }
}

// ==================== VALIDATION ====================

/**
 * Validate normalized event is ready for persistence
 *
 * Checks that all required fields are present and valid.
 *
 * @param event Normalized event
 * @returns true if valid, false otherwise
 *
 * @todo Add more strict validation as schema stabilizes
 */
export function isValidNormalizedEvent(event: NormalizedFrigateEvent | null): event is NormalizedFrigateEvent {
  if (!event) {
    return false;
  }

  // Required fields
  if (!event.frigateId || !event.camera || !event.type || !event.label) {
    return false;
  }

  // Valid types
  if (!['new', 'update', 'end'].includes(event.type)) {
    return false;
  }

  // Raw payload present
  if (!event.raw || typeof event.raw !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validate normalized review is ready for persistence
 *
 * @param review Normalized review
 * @returns true if valid, false otherwise
 */
export function isValidNormalizedReview(review: NormalizedFrigateReview | null): review is NormalizedFrigateReview {
  if (!review) {
    return false;
  }

  // Required fields
  if (!review.frigateId || !review.reviewId || !review.camera || !review.severity) {
    return false;
  }

  // Valid severity
  if (!['alert', 'detection', 'review'].includes(review.severity)) {
    return false;
  }

  // Raw payload present
  if (!review.raw || typeof review.raw !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validate normalized availability is ready for persistence
 *
 * @param available Normalized availability
 * @returns true if valid, false otherwise
 */
export function isValidNormalizedAvailable(
  available: NormalizedFrigateAvailable | null
): available is NormalizedFrigateAvailable {
  if (!available) {
    return false;
  }

  // Required fields
  if (!available.frigateId || typeof available.available !== 'boolean' || !available.timestamp) {
    return false;
  }

  // Raw payload present
  if (!available.raw || typeof available.raw !== 'object') {
    return false;
  }

  return true;
}
