"use client";
import { useState } from "react";
import { Package, ShoppingBag, Wallet, ArrowRight, Check } from "lucide-react";
import { Brand } from "../ui/Brand";
import s from "./Foundation.module.css";
const steps = [
  {
    icon: Package,
    title: "Organizá",
    label: "Tu catálogo, listo",
    description:
      "Productos, precios y existencias en un solo lugar. Encontrá lo que buscás y anticipá lo que falta.",
    items: [
      "Catálogo de productos",
      "Control de existencias",
      "Alertas de stock mínimo",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Vendé",
    label: "De la consulta a la venta",
    description:
      "Prepará un presupuesto, elegí los productos y registrá la venta. El inventario se actualiza en la misma operación.",
    items: [
      "Presupuestos conectados",
      "Venta de varios productos",
      "Stock actualizado",
    ],
  },
  {
    icon: Wallet,
    title: "Controlá",
    label: "Cerrá el día con claridad",
    description:
      "Revisá los cobros, los saldos pendientes y los movimientos de caja. Cada operación conserva su contexto.",
    items: [
      "Cobros y cuenta corriente",
      "Ingresos y egresos",
      "Reportes por período",
    ],
  },
];
export function ProductTour() {
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  return (
    <div className={`${s.productVisual} ${s.tour}`}>
      <div className={s.visualTop}>
        <span>UN RECORRIDO POR NUBRA</span>
        <span className={s.badge}>Todo conectado</span>
      </div>
      <div className={s.tourBrand}>
        <Brand size={116} />
        <div>
          <span className={s.eyebrow}>Tu centro de operaciones</span>
          <h2>Un día más simple.</h2>
        </div>
      </div>
      <div
        className={s.tourTabs}
        role="group"
        aria-label="Explorá cómo funciona Nubra"
      >
        {steps.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <item.icon size={19} />
            {item.title}
          </button>
        ))}
      </div>
      <div key={selected} className={s.tourPanel} aria-live="polite">
        <span className={s.tourNumber}>
          0{selected + 1}
          <ArrowRight size={22} />
        </span>
        <h3>{step.label}</h3>
        <p>{step.description}</p>
        <ul>
          {step.items.map((item) => (
            <li key={item}>
              <Check size={15} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className={s.tourProgress} aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} data-active={selected >= i} />
        ))}
      </div>
    </div>
  );
}
