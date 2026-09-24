export type FiscalEnvironment = "HOMOLOGATION" | "PRODUCTION";
export type FiscalInvoiceStatus = "DRAFT" | "PENDING" | "AUTHORIZED" | "REJECTED" | "UNCERTAIN";

export type FiscalProfile = {
  organizationId: string;
  taxId: string;
  legalName: string;
  fiscalCondition: string;
  address: string;
  environment: FiscalEnvironment;
  serviceName: "WSFEV1";
};

export type FiscalInvoiceDraft = {
  organizationId: string;
  idempotencyKey: string;
  pointOfSale: number;
  invoiceType: string;
  issuerSnapshot: Record<string, unknown>;
  receiverSnapshot: Record<string, unknown>;
  totalsSnapshot: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

export type FiscalAttemptResult = {
  status: FiscalInvoiceStatus;
  message: string;
  officialResponse?: Record<string, unknown>;
};

export interface FiscalProvider {
  getCapabilities(): { service: string; environment: FiscalEnvironment; canIssue: boolean };
  issue(draft: FiscalInvoiceDraft): Promise<FiscalAttemptResult>;
  reconcile(invoiceId: string): Promise<FiscalAttemptResult>;
}