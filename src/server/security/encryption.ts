import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
export interface KeyManagementProvider {
  readonly name: string;
  wrap(
    key: Buffer,
    context: string,
  ): Promise<{ wrapped: string; reference: string }>;
  unwrap(wrapped: string, reference: string, context: string): Promise<Buffer>;
}
export type OrganizationKey = {
  organizationId: string;
  version: number;
  provider: string;
  reference: string;
  wrapped: string;
};
export interface OrganizationKeyRepository {
  current(organizationId: string): Promise<OrganizationKey | null>;
  get(organizationId: string, version: number): Promise<OrganizationKey | null>;
  insert(key: OrganizationKey): Promise<void>;
}
export type Envelope = {
  algorithm: "AES-256-GCM";
  version: 1;
  keyVersion: number;
  iv: string;
  tag: string;
  ciphertext: string;
};
export class EncryptionService {
  constructor(
    private readonly provider: KeyManagementProvider,
    private readonly keys: OrganizationKeyRepository,
  ) {}
  async rotate(organizationId: string) {
    const previous = await this.keys.current(organizationId),
      version = (previous?.version ?? 0) + 1,
      key = randomBytes(32);
    try {
      const wrapped = await this.provider.wrap(
        key,
        organizationId + ":" + version,
      );
      const record = {
        organizationId,
        version,
        provider: this.provider.name,
        reference: wrapped.reference,
        wrapped: wrapped.wrapped,
      };
      await this.keys.insert(record);
      return record;
    } finally {
      key.fill(0);
    }
  }
  private aad(org: string, record: string, field: string, version: number) {
    return Buffer.from(
      JSON.stringify(["NUBRA", 1, org, record, field, version]),
    );
  }
  async encrypt(
    org: string,
    record: string,
    field: string,
    plaintext: string,
  ): Promise<Envelope> {
    const meta = (await this.keys.current(org)) ?? (await this.rotate(org));
    if (meta.provider !== this.provider.name)
      throw new Error("Organization key provider mismatch");
    const key = await this.provider.unwrap(
      meta.wrapped,
      meta.reference,
      org + ":" + meta.version,
    );
    try {
      if (key.length !== 32) throw new Error("Invalid data key");
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(this.aad(org, record, field, meta.version));
      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      return {
        algorithm: "AES-256-GCM",
        version: 1,
        keyVersion: meta.version,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: encrypted.toString("base64"),
      };
    } finally {
      key.fill(0);
    }
  }
  async decrypt(org: string, record: string, field: string, value: Envelope) {
    if (value.algorithm !== "AES-256-GCM" || value.version !== 1)
      throw new Error("Unsupported encryption format");
    const meta = await this.keys.get(org, value.keyVersion);
    if (!meta || meta.provider !== this.provider.name)
      throw new Error("Organization key unavailable");
    const key = await this.provider.unwrap(
      meta.wrapped,
      meta.reference,
      org + ":" + meta.version,
    );
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(value.iv, "base64"),
      );
      decipher.setAAD(this.aad(org, record, field, value.keyVersion));
      decipher.setAuthTag(Buffer.from(value.tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } finally {
      key.fill(0);
    }
  }
}
// Vault transit keeps the KEK outside the application/database. No local-master-key fallback.
export class VaultKeyManagementProvider implements KeyManagementProvider {
  readonly name = "vault-transit";
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
    private readonly keyName: string,
  ) {
    if (
      new URL(endpoint).protocol !== "https:" ||
      !/^[a-zA-Z0-9_-]+$/.test(keyName)
    )
      throw new Error("Vault requires HTTPS and a valid key name");
  }
  private async request(action: string, body: unknown) {
    const r = await fetch(
      new URL("/v1/transit/" + action + "/" + this.keyName, this.endpoint),
      {
        method: "POST",
        headers: {
          "X-Vault-Token": this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      },
    );
    if (!r.ok) throw new Error("Key service unavailable");
    return (await r.json()).data;
  }
  async wrap(key: Buffer, context: string) {
    const data = await this.request("encrypt", {
      plaintext: key.toString("base64"),
      context: Buffer.from(context).toString("base64"),
    });
    if (
      typeof data?.ciphertext !== "string" ||
      !data.ciphertext.startsWith("vault:v")
    )
      throw new Error("Invalid key service response");
    return { wrapped: data.ciphertext, reference: this.keyName };
  }
  async unwrap(wrapped: string, reference: string, context: string) {
    if (reference !== this.keyName) throw new Error("Unknown key reference");
    const data = await this.request("decrypt", {
      ciphertext: wrapped,
      context: Buffer.from(context).toString("base64"),
    });
    if (typeof data?.plaintext !== "string")
      throw new Error("Invalid key service response");
    const key = Buffer.from(data.plaintext, "base64");
    if (key.length !== 32) {
      key.fill(0);
      throw new Error("Invalid data key");
    }
    return key;
  }
}
