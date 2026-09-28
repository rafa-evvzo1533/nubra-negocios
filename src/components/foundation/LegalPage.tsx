import { legalDocuments } from "@/server/legal";
import { PublicShell } from "./PublicShell";
import s from "./Foundation.module.css";
export async function LegalPage({ slug }: { slug: "privacy" | "terms" }) {
  const doc = (await legalDocuments()).find((d) => d.slug === slug)!;
  const paragraphs = doc.content
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sections = paragraphs.map((text, index) => ({
    id: "seccion-" + index,
    title: index === 0 ? "Sobre este documento" : text.split(". ")[0],
    text: index === 0 ? text : text.slice(text.indexOf(". ") + 2),
  }));
  return (
    <PublicShell>
      <article className={`${s.card} ${s.legal}`}>
        <span className={s.eyebrow}>Versión {doc.version}</span>
        <h1>{doc.title}</h1>
        <p>Documento en revisión jurídica antes del lanzamiento comercial.</p>
        <p>Actualización: septiembre de 2026</p>
        <nav aria-label="Contenido del documento" className={s.legalToc}>
          {sections.map((section) => (
            <a key={section.id} href={"#" + section.id}>
              {section.title}
            </a>
          ))}
        </nav>
        {sections.map((section) => (
          <section key={section.id} id={section.id} className={s.legalSection}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
