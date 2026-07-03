// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, isNull, lt, desc } from 'drizzle-orm';
import { agentEnrollmentKeys, agentDevices, agentSoftware } from '../schema';
import { createRecordRepository } from './records';
import type { Db } from '../client';

type DeviceInsert = typeof agentDevices.$inferInsert;
type SoftwareInsert = typeof agentSoftware.$inferInsert;

export function agentEnrollmentKeysRepo(db: Db) {
  return {
    async create(values: { orgId: string; label: string; keyHash: string; hint: string; createdBy?: string }) {
      const rows = await db.insert(agentEnrollmentKeys).values(values).returning();
      return rows[0];
    },
    /** Presented list — no key hash. */
    async list(orgId: string) {
      return db
        .select({
          id: agentEnrollmentKeys.id,
          label: agentEnrollmentKeys.label,
          hint: agentEnrollmentKeys.hint,
          createdAt: agentEnrollmentKeys.createdAt,
          revokedAt: agentEnrollmentKeys.revokedAt,
        })
        .from(agentEnrollmentKeys)
        .where(eq(agentEnrollmentKeys.orgId, orgId))
        .orderBy(desc(agentEnrollmentKeys.createdAt));
    },
    /** Enrollment lookup: an active (non-revoked) key by its hash, across all orgs. */
    async findActiveByHash(keyHash: string) {
      const rows = await db
        .select()
        .from(agentEnrollmentKeys)
        .where(and(eq(agentEnrollmentKeys.keyHash, keyHash), isNull(agentEnrollmentKeys.revokedAt)));
      return rows[0];
    },
    async revoke(orgId: string, id: string) {
      const rows = await db
        .update(agentEnrollmentKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(agentEnrollmentKeys.orgId, orgId), eq(agentEnrollmentKeys.id, id), isNull(agentEnrollmentKeys.revokedAt)))
        .returning();
      return rows[0];
    },
  };
}

export function agentDevicesRepo(db: Db) {
  const base = createRecordRepository(db, agentDevices);
  return {
    ...base,

    /** A device by (orgId, machineId) regardless of soft-delete state; used to guard re-enrollment. */
    async findByMachineId(orgId: string, machineId: string) {
      const rows = await db
        .select()
        .from(agentDevices)
        .where(and(eq(agentDevices.orgId, orgId), eq(agentDevices.machineId, machineId)));
      return rows[0];
    },

    /**
     * Enroll/re-enroll: insert by (orgId, machineId), refreshing the device token on
     * conflict. Deliberately does NOT clear `deletedAt`: a device an admin removed must
     * not be silently resurrected (and handed a fresh working token) by a holder of the
     * shared enrollment key. The enroll route rejects re-enrollment onto a deleted row.
     */
    async upsertByMachineId(values: {
      orgId: string;
      machineId: string;
      enrollmentKeyId: string;
      tokenHash: string;
      hostname: string;
      osType: DeviceInsert['osType'];
      agentVersion: string;
    }) {
      const rows = await db
        .insert(agentDevices)
        .values(values)
        .onConflictDoUpdate({
          target: [agentDevices.orgId, agentDevices.machineId],
          set: {
            tokenHash: values.tokenHash,
            enrollmentKeyId: values.enrollmentKeyId,
            hostname: values.hostname,
            agentVersion: values.agentVersion,
            status: 'online',
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0];
    },

    /** Resolve a live device by its bearer-token hash (for ingest auth). */
    async findByTokenHash(tokenHash: string) {
      const rows = await db
        .select()
        .from(agentDevices)
        .where(and(eq(agentDevices.tokenHash, tokenHash), isNull(agentDevices.deletedAt)));
      return rows[0];
    },

    /** Apply a full inventory snapshot to a device. */
    async applySnapshot(
      id: string,
      fields: Partial<DeviceInsert>,
    ) {
      const rows = await db
        .update(agentDevices)
        .set({ ...fields, status: 'online', lastSeenAt: new Date(), lastReportAt: new Date(), updatedAt: new Date() })
        .where(and(eq(agentDevices.id, id), isNull(agentDevices.deletedAt)))
        .returning();
      return rows[0];
    },

    async heartbeat(id: string) {
      await db
        .update(agentDevices)
        .set({ status: 'online', lastSeenAt: new Date(), updatedAt: new Date() })
        .where(and(eq(agentDevices.id, id), isNull(agentDevices.deletedAt)));
    },

    async linkAsset(orgId: string, id: string, assetId: string, updatedBy?: string) {
      const rows = await db
        .update(agentDevices)
        .set({ linkedAssetId: assetId, updatedBy, updatedAt: new Date() })
        .where(and(eq(agentDevices.orgId, orgId), eq(agentDevices.id, id), isNull(agentDevices.deletedAt)))
        .returning();
      return rows[0];
    },

    async unlinkAsset(orgId: string, id: string, updatedBy?: string) {
      const rows = await db
        .update(agentDevices)
        .set({ linkedAssetId: null, updatedBy, updatedAt: new Date() })
        .where(and(eq(agentDevices.orgId, orgId), eq(agentDevices.id, id), isNull(agentDevices.deletedAt)))
        .returning();
      return rows[0];
    },

    /** Worker tick: flip devices with no recent heartbeat to offline. Returns affected ids. */
    async markOfflineStale(staleBefore: Date) {
      const rows = await db
        .update(agentDevices)
        .set({ status: 'offline', updatedAt: new Date() })
        .where(and(eq(agentDevices.status, 'online'), lt(agentDevices.lastSeenAt, staleBefore), isNull(agentDevices.deletedAt)))
        .returning({ id: agentDevices.id });
      return rows;
    },
  };
}

export function agentSoftwareRepo(db: Db) {
  return {
    async listForDevice(deviceId: string) {
      return db
        .select()
        .from(agentSoftware)
        .where(eq(agentSoftware.deviceId, deviceId))
        .orderBy(agentSoftware.name);
    },
    /** Replace a device's entire software list in one transaction. */
    async replaceForDevice(orgId: string, deviceId: string, items: Omit<SoftwareInsert, 'id' | 'orgId' | 'deviceId'>[]) {
      await db.transaction(async (tx) => {
        await tx.delete(agentSoftware).where(eq(agentSoftware.deviceId, deviceId));
        if (items.length > 0) {
          await tx.insert(agentSoftware).values(items.map((it) => ({ ...it, orgId, deviceId })));
        }
      });
    },
  };
}
