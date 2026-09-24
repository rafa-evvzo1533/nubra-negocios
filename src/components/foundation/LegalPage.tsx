import { legalDocuments } from "@/server/legal";
import { PublicShell } from "./PublicShell";
import s from "./Foundation.module.css";
export async function LegalPage({ slug }: { slug: "privacy" | "terms" }) {
  const doc = (await legalDocuments()).find((d) => d.slug === slug)!;
  return (
    <PublicShell>
      <article className={`${s.card} ${s.legal}`}>
        <span className={s.eyebrow}>Versión {doc.version}</span>
        <h1>{doc.title}</h1>
        <p>Documento en revisión jurídica antes del lanzamiento comercial.</p>
        {doc.content}
      </article>
    </PublicShell>
  );
}
