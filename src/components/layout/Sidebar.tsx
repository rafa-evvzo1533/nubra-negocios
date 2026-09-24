"use client";

import { ArrowUpRight, ChevronDown, LayoutGrid, MessageCircle, Settings, Target, X } from "lucide-react";
import type { Section } from "../data";
import { navItems } from "../data";
import styles from "./Sidebar.module.css";

type SidebarProps = { activeSection: Section; mobileOpen: boolean; onSectionChange: (section: Section) => void; onMobileClose: () => void };

export function Sidebar({ activeSection, mobileOpen, onSectionChange, onMobileClose }: SidebarProps) {
  return <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}><div className={styles.brandRow}><div className={styles.brandMark}>N</div><span className={styles.brandName}>nubra<span>.</span></span><button className={`${styles.iconButton} ${styles.mobileClose}`} aria-label="Cerrar menu" onClick={onMobileClose}><X size={18} /></button></div><button className={styles.workspacePicker}><div className={styles.workspaceAvatar}>?</div><div><strong>Organizacion actual</strong><span>Seleccionar workspace</span></div><ChevronDown size={16} /></button><nav className={styles.nav} aria-label="Navegacion principal"><span className={styles.caption}>Workspace</span>{navItems.map(({ label, icon: Icon, active }) => <button className={`${styles.navItem} ${active && activeSection === "dashboard" ? styles.navActive : ""}`} key={label} onClick={() => { onSectionChange("dashboard"); onMobileClose(); }}><Icon size={18} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span></button>)}<span className={`${styles.caption} ${styles.spaced}`}>Gestion</span><button className={styles.navItem}><LayoutGrid size={18} /><span>Reportes</span></button><button className={styles.navItem}><Target size={18} /><span>Automatizaciones</span><span className={styles.soon}>Pronto</span></button><button className={styles.navItem}><Settings size={18} /><span>Configuracion</span></button></nav><div className={styles.footer}><div className={styles.support}><div><MessageCircle size={17} /></div><div><strong>Centro de ayuda</strong><span>Conecta tu workspace para comenzar</span></div><ArrowUpRight size={15} /></div></div></aside>;
}