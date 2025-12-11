#!/usr/bin/env tsx

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run(): Promise<void> {
  try {
    console.log('🔎 Verifying database contents...');

    const tenantCount = await prisma.tenant.count();
    const cameraCount = await prisma.camera.count();
    const eventCount = await prisma.event.count();

    console.log(`
Tenants: ${tenantCount}
Cameras: ${cameraCount}
Events: ${eventCount}
`);

    const recentEvents = await prisma.event.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        frigateId: true,
        type: true,
        label: true,
        startTime: true,
        endTime: true,
        createdAt: true,
      },
    });

    if (recentEvents.length === 0) {
      console.log('No events found in the database.');
    } else {
      console.log('Recent events:');
      recentEvents.forEach((e) => {
        console.log(JSON.stringify(e, null, 2));
      });
    }
  } catch (err) {
    console.error('Error while verifying DB:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
