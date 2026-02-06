import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMessage,
  normalizeEventMessage,
  normalizeReviewMessage,
  normalizeAvailabilityMessage,
} from '../src/mqtt/normalize.js';

test('normalizeEventMessage uses frigate id and camera from topic', () => {
  const payload = {
    type: 'new',
    label: 'person',
    before: { id: 'evt-1', camera: 'front' },
    after: { id: 'evt-1', camera: 'front' },
    snapshot: true,
    clip: false,
    start_time: 1700000000,
  };

  const result = normalizeEventMessage(payload, 'frigate/inst-1/events/front');

  assert.ok(result);
  assert.equal(result.frigateId, 'inst-1');
  assert.equal(result.camera, 'front');
  assert.equal(result.eventId, 'evt-1');
});

test('normalizeReviewMessage uses camera from topic', () => {
  const payload = {
    id: 'rev-1',
    camera: 'garage',
    severity: 'alert',
    retracted: false,
  };

  const result = normalizeReviewMessage(payload, 'frigate/inst-2/reviews/front_porch');

  assert.ok(result);
  assert.equal(result.frigateId, 'inst-2');
  assert.equal(result.camera, 'front_porch');
});

test('normalizeReviewMessage falls back to payload camera when topic lacks camera', () => {
  const payload = {
    id: 'rev-2',
    camera: 'backyard',
    severity: 'detection',
    retracted: false,
  };

  const result = normalizeReviewMessage(payload, 'frigate/reviews');

  assert.ok(result);
  assert.equal(result.camera, 'backyard');
});

test('normalizeAvailabilityMessage handles string payloads', () => {
  const result = normalizeAvailabilityMessage('true', 'frigate/inst-3/available');

  assert.ok(result);
  assert.equal(result.frigateId, 'inst-3');
  assert.equal(result.available, true);
});

test('normalizeMessage routes based on topic', () => {
  const eventPayload = {
    type: 'end',
    label: 'car',
    before: { id: 'evt-2', camera: 'drive' },
    after: { id: 'evt-2', camera: 'drive' },
  };

  const result = normalizeMessage(eventPayload, 'frigate/events/drive');
  assert.ok(result);
  assert.equal('type' in result, true);
});

test('normalizeEventMessage extracts sub_label from before/after payloads', () => {
  const payload = {
    type: 'end',
    label: 'person',
    after: {
      id: 'evt-3',
      camera: 'front',
      sub_label: ['Julian', 0.995],
    },
  };

  const result = normalizeEventMessage(payload, 'frigate/events/front');

  assert.ok(result);
  assert.equal(result.subLabel, 'Julian');
});
