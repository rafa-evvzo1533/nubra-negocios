import type { LucideIcon } from "lucide-react";
import { CalendarDays, Check, CircleDollarSign, FileText, Home, Inbox, Package, Users } from "lucide-react";

export type Section = "dashboard";
export type NavItem = { label: string; icon: LucideIcon; active?: boolean };

export const navItems: NavItem[] = [
  { label: "Inicio", icon: Home, active: true },
  { label: "Clientes", icon: Users },
  { label: "Ventas", icon: CircleDollarSign },
  { label: "Productos", icon: Package },
  { label: "Pedidos", icon: Inbox },
  { label: "Presupuestos", icon: FileText },
  { label: "Tareas", icon: Check },
  { label: "Agenda", icon: CalendarDays },
];