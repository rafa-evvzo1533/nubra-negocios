"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, TriangleAlert, Info } from "lucide-react";
import { Dialog } from "./Dialog";
type Notice = {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
};
type Confirmation = { message: string; resolve: (value: boolean) => void };
export function notify(message: string, kind: Notice["kind"] = "success") {
  if (!message.trim()) return;
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
    [pending, setPending] = useState<Confirmation | null>(null),
    [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let current: Confirmation | null = null;
    function locateHost() {
      const dialogs = document.querySelectorAll("dialog[open]");
      setHost(dialogs.item(dialogs.length - 1) ?? document.body);
    }
    function notice(event: Event) {
      const n = (event as CustomEvent<Notice>).detail;
      locateHost();
      setItems((v) => [
        ...v
          .filter((x) => x.message !== n.message || x.kind !== n.kind)
          .slice(-2),
        n,
      ]);
      const timer = setTimeout(() => {
        setItems((v) => v.filter((x) => x.id !== n.id));
        timers.delete(timer);
      }, 10000);
      timers.add(timer);
    }
    function confirm(event: Event) {
      current?.resolve(false);
      current = (event as CustomEvent<Confirmation>).detail;
      setPending(current);
    }
    window.addEventListener("nubra:notice", notice);
    window.addEventListener("nubra:confirm", confirm);
    window.addEventListener("nubra:dialog", locateHost);
    return () => {
      window.removeEventListener("nubra:notice", notice);
      window.removeEventListener("nubra:confirm", confirm);
      window.removeEventListener("nubra:dialog", locateHost);
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
      {host &&
        createPortal(
          <NoticeList
            items={items}
            onDismiss={(id) => setItems((v) => v.filter((x) => x.id !== id))}
          />,
          host,
        )}
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

// A popover inside the active dialog stays visible and interactive above its backdrop.
function NoticeList({
  items,
  onDismiss,
}: {
  items: Notice[];
  onDismiss: (id: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    // A save can close the dialog before the portal moves back to document.body.
    // showPopover throws if that dialog has already been removed from the DOM.
    if (!element?.isConnected) return;
    if (element.matches(":popover-open")) element.hidePopover();
    if (items.length) element.showPopover();
    return () => {
      if (element.isConnected && element.matches(":popover-open"))
        element.hidePopover();
    };
  }, [items]);
  return (
    <aside
      ref={ref}
      popover="manual"
      className="notifications"
      aria-label="Notificaciones"
    >
      {items.map((n) => (
        <div
          key={n.id}
          role={n.kind === "error" ? "alert" : "status"}
          className={`notification-card notification-${n.kind}`}
        >
          {n.kind === "error" ? (
            <TriangleAlert size={17} />
          ) : n.kind === "info" ? (
            <Info size={20} />
          ) : (
            <Check size={17} />
          )}
          <div className="notification-content">
            <strong>
              {n.kind === "error"
                ? "No se pudo completar"
                : n.kind === "info"
                  ? "Información"
                  : "Listo"}
            </strong>
            <span>{n.message}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar notificación"
            type="button"
            onClick={() => onDismiss(n.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </aside>
  );
}
