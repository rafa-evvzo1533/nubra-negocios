"use client";

import { Bell, Command, Menu, Search } from "lucide-react";
import type { Section } from "../data";
import styles from "./Header.module.css";

type HeaderProps = {
  section: Section;
  onMenuOpen: () => void;
  onSearchOpen: () => void;
};

export function Header({ section, onMenuOpen, onSearchOpen }: HeaderProps) {
  return (
    <header className={styles.header}>
      <button
        className={`${styles.iconButton} ${styles.menuTrigger}`}
        aria-label="Abrir menu"
        onClick={onMenuOpen}
      >
        <Menu size={21} />
      </button>
      <div className={styles.crumb}>
        <span>Workspace</span>
        <span>/</span>
        <strong>{section === "dashboard" ? "Inicio" : "Administracion"}</strong>
      </div>
      <div className={styles.actions}>
        <button className={styles.searchTrigger} onClick={onSearchOpen}>
          <Search size={17} />
          <span>Buscar en Nubra</span>
          <kbd>
            <Command size={11} /> K
          </kbd>
        </button>
        <button
          className={`${styles.iconButton} ${styles.notification}`}
          aria-label="Notificaciones"
        >
          <Bell size={19} />
          <i />
        </button>
        <button
          className={styles.avatar}
          aria-label="Cuenta sin iniciar sesion"
        >
          Cuenta
        </button>
      </div>
    </header>
  );
}
