import type { FiscalAttemptResult, FiscalEnvironment, FiscalInvoiceDraft, FiscalProvider } from "./types";

export class ArcaWsfev1Provider implements FiscalProvider {
  constructor(private readonly environment: FiscalEnvironment) {}

  getCapabilities() {
    return { service: "WSFEv1", environment: this.environment, canIssue: false };
  }

  async issue(_draft: FiscalInvoiceDraft): Promise<FiscalAttemptResult> {
    void _draft;
    return { status: "UNCERTAIN", message: "ARCA aún no está conectado: faltan certificado X.509, asociación al WSN y credenciales de homologación." };
  }

  async reconcile(_invoiceId: string): Promise<FiscalAttemptResult> {
    void _invoiceId;
    return { status: "UNCERTAIN", message: "No se puede reconciliar hasta configurar el cliente WSAA/WSFEv1 de homologación." };
  }
}