import "@fontsource-variable/inter";
import type { Metadata } from "next";
import "./globals.css";
import {Notifications} from '@/components/ui/Notifications';
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nubra Negocios | Business OS",
  description: "Gestion empresarial para negocios que quieren avanzar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}<Notifications/></body>
    </html>
  );
}
