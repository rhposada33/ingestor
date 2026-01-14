import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/db/client.js';
import {
  handleFrigateEvent,
  handleFrigateReview,
  handleFrigateAvailability,
} from '../src/ingest/handler.js';

type TenantRecord = { id: string; name: string };
type CameraRecord = { id: string; tenantId: string; key: string; label?: string | null };
type EventRecord = {
  id: string;
  tenantId: string;
  cameraId: string;
  frigateId: string;
};
type ReviewRecord = {
  id: string;
  tenantId: string;
  cameraId: string;
  reviewId: string;
  cameraName: string;
};

function createPrismaStub() {
  const prismaAny = prisma as any;
  const tenants = new Map<string, TenantRecord>();
  const cameras = new Map<string, CameraRecord>();
  const events = new Map<string, EventRecord>();
  const reviews = new Map<string, ReviewRecord>();
  const availabilityLogs: Array<{ tenantId: string; available: boolean }> = [];
  let idCounter = 1;

  const nextId = () => `id-${idCounter++}`;

  const original = {
    tenant: {
      findUnique: prismaAny.tenant.findUnique,
      create: prismaAny.tenant.create,
    },
    camera: {
      findUnique: prismaAny.camera.findUnique,
      create: prismaAny.camera.create,
    },
    event: {
      upsert: prismaAny.event.upsert,
    },
    review: {
      upsert: prismaAny.review?.upsert,
    },
    availabilityLog: {
      create: prismaAny.availabilityLog?.create,
    },
    $transaction: prismaAny.$transaction,
  };

  prismaAny.tenant.findUnique = async ({ where }: { where: { id: string } }) => {
    return tenants.get(where.id) || null;
  };

  prismaAny.tenant.create = async ({ data }: { data: { id?: string; name: string } }) => {
    const id = data.id ?? nextId();
    const tenant = { id, name: data.name };
    tenants.set(id, tenant);
    return tenant;
  };

  prismaAny.camera.findUnique = async ({
    where,
  }: {
    where: { id?: string; tenantId_key?: { tenantId: string; key: string } };
  }) => {
    if (where.id) {
      return cameras.get(where.id) || null;
    }
    if (where.tenantId_key) {
      for (const camera of cameras.values()) {
        if (
          camera.tenantId === where.tenantId_key.tenantId &&
          camera.key === where.tenantId_key.key
        ) {
          return camera;
        }
      }
    }
    return null;
  };

  prismaAny.camera.create = async ({
    data,
  }: {
    data: { tenantId: string; key: string; label?: string | null };
  }) => {
    const camera = {
      id: nextId(),
      tenantId: data.tenantId,
      key: data.key,
      label: data.label ?? null,
    };
    cameras.set(camera.id, camera);
    return camera;
  };

  prismaAny.event.upsert = async ({
    where,
    create,
    update,
  }: {
    where: { tenantId_frigateId: { tenantId: string; frigateId: string } };
    create: any;
    update: any;
  }) => {
    const key = `${where.tenantId_frigateId.tenantId}:${where.tenantId_frigateId.frigateId}`;
    const existing = events.get(key);
    if (existing) {
      const updated = { ...existing, ...update };
      events.set(key, updated);
      return updated;
    }
    const created = { id: nextId(), ...create };
    events.set(key, created);
    return created;
  };

  prismaAny.review = prismaAny.review || {};
  prismaAny.review.upsert = async ({
    where,
    create,
    update,
  }: {
    where: { tenantId_reviewId: { tenantId: string; reviewId: string } };
    create: any;
    update: any;
  }) => {
    const key = `${where.tenantId_reviewId.tenantId}:${where.tenantId_reviewId.reviewId}`;
    const existing = reviews.get(key);
    if (existing) {
      const updated = { ...existing, ...update };
      reviews.set(key, updated);
      return updated;
    }
    const created = { id: nextId(), ...create };
    reviews.set(key, created);
    return created;
  };

  prismaAny.availabilityLog = prismaAny.availabilityLog || {};
  prismaAny.availabilityLog.create = async ({ data }: { data: any }) => {
    availabilityLogs.push({ tenantId: data.tenantId, available: data.available });
    return { id: nextId(), ...data };
  };

  prismaAny.$transaction = async (fn: (tx: any) => Promise<any>) => {
    return fn(prismaAny);
  };

  const restore = () => {
    prismaAny.tenant.findUnique = original.tenant.findUnique;
    prismaAny.tenant.create = original.tenant.create;
    prismaAny.camera.findUnique = original.camera.findUnique;
    prismaAny.camera.create = original.camera.create;
    prismaAny.event.upsert = original.event.upsert;
    if (original.review?.upsert) {
      prismaAny.review.upsert = original.review.upsert;
    }
    if (original.availabilityLog?.create) {
      prismaAny.availabilityLog.create = original.availabilityLog.create;
    }
    prismaAny.$transaction = original.$transaction;
  };

  return { restore, events, reviews, availabilityLogs };
}

test('handleFrigateEvent persists event with tenant and camera', async () => {
  const { restore, events } = createPrismaStub();
  try {
    const result = await handleFrigateEvent({
      frigateId: 'default',
      eventId: 'evt-1',
      camera: 'front',
      type: 'new',
      label: 'person',
      hasSnapshot: true,
      hasClip: false,
      startTime: 1700000000,
      endTime: null,
      raw: {},
    });

    assert.equal(result.success, true);
    assert.equal(events.size, 1);
  } finally {
    restore();
  }
});

test('handleFrigateReview persists review', async () => {
  const { restore, reviews } = createPrismaStub();
  try {
    const result = await handleFrigateReview({
      frigateId: 'default',
      reviewId: 'rev-1',
      camera: 'front',
      severity: 'alert',
      retracted: false,
      timestamp: 1700000100,
      raw: {},
    });

    assert.equal(result.success, true);
    assert.equal(reviews.size, 1);
  } finally {
    restore();
  }
});

test('handleFrigateAvailability persists availability log', async () => {
  const { restore, availabilityLogs } = createPrismaStub();
  try {
    const result = await handleFrigateAvailability({
      frigateId: 'default',
      available: true,
      timestamp: 1700000200,
      raw: {},
    });

    assert.equal(result.success, true);
    assert.equal(availabilityLogs.length, 1);
  } finally {
    restore();
  }
});
