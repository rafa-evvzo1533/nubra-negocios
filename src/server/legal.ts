import { postgres } from "./postgres";
export async function legalDocuments() {
  return (
    await postgres.query<{
      id: string;
      slug: string;
      title: string;
      version: string;
      content: string;
      review_status: string;
    }>(
      `SELECT v.id,d.slug,d.title,v.version,v.content,v.review_status FROM legal_documents d JOIN legal_document_versions v ON v.document_id=d.id WHERE v.current ORDER BY d.slug`,
    )
  ).rows;
}
