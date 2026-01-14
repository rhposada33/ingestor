import { prisma } from './client.js';

/**
 * Database service with common operations
 * 
 * TODO: Implement tenant operations
 * TODO: Implement camera operations
 * TODO: Implement event operations
 * TODO: Add transaction support
 * TODO: Add error handling and logging
 */

export class DatabaseService {
  /**
   * Create a new tenant
   */
  async createTenant(name: string) {
    // TODO: Implement tenant creation
    return await prisma.tenant.create({
      data: { name },
    });
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id: string) {
    // TODO: Add error handling
    return await prisma.tenant.findUnique({
      where: { id },
      include: {
        cameras: true,
        events: true,
      },
    });
  }

  /**
   * Create a camera
   */
  async createCamera(tenantId: string, key: string, label?: string) {
    // TODO: Validate tenant exists
    // TODO: Validate camera key uniqueness per tenant
    return await prisma.camera.create({
      data: {
        tenantId,
        frigateCameraKey: key,
        label,
      },
    });
  }

  /**
   * Get camera by ID
   */
  async getCamera(id: string) {
    return await prisma.camera.findUnique({
      where: { id },
      include: {
        tenant: true,
        events: true,
      },
    });
  }

  /**
   * Get cameras by tenant
   */
  async getCamerasByTenant(tenantId: string) {
    return await prisma.camera.findMany({
      where: { tenantId },
    });
  }

  /**
   * Create an event
   */
  async createEvent(
    tenantId: string,
    cameraId: string,
    frigateId: string,
    type: string,
    rawPayload: Record<string, unknown>,
    label?: string,
    hasSnapshot?: boolean,
    hasClip?: boolean,
    startTime?: number,
    endTime?: number
  ) {
    // TODO: Validate camera belongs to tenant
    // TODO: Check for duplicate events
    return await prisma.event.create({
      data: {
        tenantId,
        cameraId,
        frigateId,
        type,
        label,
        hasSnapshot: hasSnapshot ?? false,
        hasClip: hasClip ?? false,
        startTime,
        endTime,
        rawPayload: rawPayload as any,
      },
    });
  }

  /**
   * Get event by ID
   */
  async getEvent(id: string) {
    return await prisma.event.findUnique({
      where: { id },
      include: {
        tenant: true,
        camera: true,
      },
    });
  }

  /**
   * Get events by camera
   */
  async getEventsByCamera(cameraId: string, limit: number = 100) {
    return await prisma.event.findMany({
      where: { cameraId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get events by tenant
   */
  async getEventsByTenant(tenantId: string, limit: number = 100) {
    return await prisma.event.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update event
   */
  async updateEvent(
    id: string,
    data: {
      label?: string;
      hasSnapshot?: boolean;
      hasClip?: boolean;
      endTime?: number;
    }
  ) {
    // TODO: Validate update data
    return await prisma.event.update({
      where: { id },
      data,
    });
  }

  // TODO: Implement batch operations
  // TODO: Implement complex queries with filtering and pagination
  // TODO: Implement data cleanup/archival
}

export const dbService = new DatabaseService();
