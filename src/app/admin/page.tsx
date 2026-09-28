"use client";

import { useRouter } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";

export default function AdminPage() {
  const router = useRouter();
  return <AdminView onBack={() => router.push("/")} />;
}
