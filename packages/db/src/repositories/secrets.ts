// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import { secrets } from '../schema';
import type { Db } from '../client';

export function secretsRepo(db: Db) {
  return {
    /** Presented list — no ciphertext. */
    async list(orgId: string) {
      return db
        .select({
          name: secrets.name,
          hint: secrets.hint,
          updatedAt: secrets.updatedAt,
          updatedBy: secrets.updatedBy,
        })
        .from(secrets)
        .where(eq(secrets.orgId, orgId));
    },
    async getByName(orgId: string, name: string) {
      const rows = await db.select().from(secrets).where(and(eq(secrets.orgId, orgId), eq(secrets.name, name)));
      return rows[0];
    },
    async create(values: { orgId: string; name: string; valueCiphertext: string; hint: string; createdBy?: string }) {
      const rows = await db
        .insert(secrets)
        .values({ ...values, updatedBy: values.createdBy })
        .returning();
      return rows[0];
    },
    async updateValue(orgId: string, name: string, valueCiphertext: string, hint: string, updatedBy?: string) {
      const rows = await db
        .update(secrets)
        .set({ valueCiphertext, hint, updatedAt: new Date(), updatedBy })
        .where(and(eq(secrets.orgId, orgId), eq(secrets.name, name)))
        .returning();
      return rows[0];
    },
    async remove(orgId: string, name: string) {
      await db.delete(secrets).where(and(eq(secrets.orgId, orgId), eq(secrets.name, name)));
    },
    /** Worker-side: name + ciphertext for an org, to be decrypted in the app layer. */
    async listCiphertexts(orgId: string): Promise<{ name: string; valueCiphertext: string }[]> {
      return db
        .select({ name: secrets.name, valueCiphertext: secrets.valueCiphertext })
        .from(secrets)
        .where(eq(secrets.orgId, orgId));
    },
  };
}
