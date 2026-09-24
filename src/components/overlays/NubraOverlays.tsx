"use client";

import { ArrowUpRight, Command, Search, Sparkles, X } from "lucide-react";
import styles from "./NubraOverlays.module.css";

export function CopilotButton({ onOpen }: { onOpen: () => void }) { return <button className={styles.fab} onClick={onOpen}><Sparkles size={19} /><span>Preguntale a Nubra</span></button>; }

export function CopilotDrawer({ onClose }: { onClose: () => void }) { return <aside className={styles.drawer}><div className={styles.drawerHeading}><div className={styles.drawerBrand}><div className={styles.sparkle}><Sparkles size={16} /></div><div><strong>Nubra AI</strong><span>Tu copiloto de negocio</span></div></div><button className={styles.close} onClick={onClose} aria-label="Cerrar copiloto"><X size={18} /></button></div><div className={styles.drawerBody}><p>Que te gustaria revisar?</p><div className={styles.suggestions}><button>Que deberia revisar hoy? <ArrowUpRight size={15} /></button><button>Mostrame clientes sin seguimiento <ArrowUpRight size={15} /></button><button>Como vienen mis ventas? <ArrowUpRight size={15} /></button></div></div><div className={styles.drawerInput}><input placeholder="Escribi una pregunta..." /><button aria-label="Enviar pregunta"><ArrowUpRight size={17} /></button></div></aside>; }

export function SearchModal({ onClose }: { onClose: () => void }) { return <div className={styles.overlay} onClick={onClose}><div className={styles.searchModal} onClick={(event) => event.stopPropagation()}><div className={styles.searchInput}><Search size={19} /><input autoFocus placeholder="Buscar clientes, ventas, productos..." /><kbd>ESC</kbd></div><div className={styles.searchHint}><Command size={14} /> Escribi para buscar en todo tu workspace</div></div></div>; }