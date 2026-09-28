"use client";
import { useEffect, useState } from "react";
import { Check, X, TriangleAlert } from "lucide-react";
import { Dialog } from "./Dialog";
type Notice = {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
};
type Confirmation = { message: string; resolve: (value: boolean) => void };
export function notify(message: string, kind: Notice["kind"] = "success") {
  window.dispatchEvent(
    new CustomEvent("nubra:notice", {
      detail: { id: crypto.randomUUID(), message, kind },
    }),
  );
}
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent("nubra:confirm", { detail: { message, resolve } }),
    ),
  );
}
export function Notifications() {
  const [items, setItems] = useState<Notice[]>([]),
    [pending, setPending] = useState<Confirmation | null>(null);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let current: Confirmation | null = null;
    function notice(event: Event) {
      const n = (event as CustomEvent<Notice>).detail;
      setItems((v) => [...v.slice(-2), n]);
      const timer = setTimeout(() => {
        setItems((v) => v.filter((x) => x.id !== n.id));
        timers.delete(timer);
      }, 7000);
      timers.add(timer);
    }
    function confirm(event: Event) {
      current?.resolve(false);
      current = (event as CustomEvent<Confirmation>).detail;
      setPending(current);
    }
    window.addEventListener("nubra:notice", notice);
    window.addEventListener("nubra:confirm", confirm);
    return () => {
      window.removeEventListener("nubra:notice", notice);
      window.removeEventListener("nubra:confirm", confirm);
      timers.forEach(clearTimeout);
      current?.resolve(false);
    };
  }, []);
  function decide(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }
  return (
    <>
      <aside className="notifications" aria-label="Notificaciones">
        {items.map((n) => (
          <div
            key={n.id}
            role={n.kind === "error" ? "alert" : "status"}
            className={n.kind === "error" ? "notice-error" : "notice-success"}
          >
            {n.kind === "error" ? (
              <TriangleAlert size={17} />
            ) : (
              <Check size={17} />
            )}
            <span>{n.message}</span>
            <button
              className="icon-button"
              aria-label="Cerrar notificación"
              onClick={() => setItems((v) => v.filter((x) => x.id !== n.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </aside>
      {pending && (
        <Dialog title="Confirmar acción" onClose={() => decide(false)}>
          <p>{pending.message}</p>
          <div className="confirmation-actions">
            <button className="secondary-button" onClick={() => decide(false)}>
              Volver
            </button>
            <button className="primary-button" onClick={() => decide(true)}>
              Confirmar
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
