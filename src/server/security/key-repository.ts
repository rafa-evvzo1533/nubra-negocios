import { postgres } from "../postgres";
import type { OrganizationKey, OrganizationKeyRepository } from "./encryption";
// RLS requires an authenticated organization context for every lookup.
export class PostgresOrganizationKeyRepository implements OrganizationKeyRepository {
  async current(organizationId: string) {
    return this.find(organizationId);
  }
  async get(organizationId: string, version: number) {
    return this.find(organizationId, version);
  }
  private async find(
    org: string,
    version?: number,
  ): Promise<OrganizationKey | null> {
    const result = await postgres.query<OrganizationKey>(
      `SELECT organization_id AS "organizationId",key_version AS version,provider,key_reference AS reference,wrapped_key AS wrapped FROM organization_encryption_keys WHERE organization_id=$1 ${version === undefined ? "" : "AND key_version=$2"} ORDER BY key_version DESC LIMIT 1`,
      version === undefined ? [org] : [org, version],
    );
    return result.rows[0] ?? null;
  }
  async insert(key: OrganizationKey) {
    await postgres.query(
      "INSERT INTO organization_encryption_keys(organization_id,key_version,provider,key_reference,wrapped_key) VALUES($1,$2,$3,$4,$5)",
      [
        key.organizationId,
        key.version,
        key.provider,
        key.reference,
        key.wrapped,
      ],
    );
  }
}
