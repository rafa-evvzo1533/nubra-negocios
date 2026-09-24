"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Upload, LoaderCircle } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { send } from "../business/client";
import { readReceiptText } from "@/domain/receipt";
import styles from "../business/BusinessModule.module.css";
export function PhotoSale({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [image, setImage] = useState("");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [soldOn, setSoldOn] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const worker = useRef<Awaited<
    ReturnType<typeof import("tesseract.js").createWorker>
  > | null>(null);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
      void worker.current?.terminate();
    },
    [],
  );
  async function load(file?: File) {
    if (!file) return;
    const run = ++version.current;
    setError("");
    setImage("");
    setText("");
    setAmount("");
    setReference("");
    setSoldOn("");
    setReading(true);
    setProgress(0);
    try {
      if (
        file.size > 15000000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error("Elegí una foto JPEG, PNG o WebP de hasta 15 MB.");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) {
        bitmap.close();
        throw new Error(
          "La imagen tiene demasiada resolución. Usá una foto más pequeña.",
        );
      }
      const ratio = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const photo = canvas.toDataURL("image/jpeg", 0.88);
      if (photo.length > 4000000)
        throw new Error(
          "La imagen es demasiado grande. Acercá el encuadre al comprobante.",
        );
      if (run !== version.current) return;
      setImage(photo);
      const { createWorker } = await import("tesseract.js");
      const current = await createWorker("spa", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        logger: (m) => {
          if (run === version.current && m.status === "recognizing text")
            setProgress(Math.round(m.progress * 100));
        },
      });
      if (run !== version.current) {
        await current.terminate();
        return;
      }
      worker.current = current;
      const result = await current.recognize(photo);
      if (run !== version.current) return;
      const parsed = readReceiptText(result.data.text);
      setText(result.data.text);
      setAmount(parsed.total);
      setReference(parsed.reference);
      setSoldOn(parsed.soldOn);
      if (!parsed.total)
        setError("No se pudo identificar el total. Completalo según la foto.");
    } catch (e) {
      if (run === version.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo leer la foto. Probá con más luz y el comprobante completo.",
        );
    } finally {
      await worker.current?.terminate();
      worker.current = null;
      if (run === version.current) setReading(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      const result = await send<{ id: string; duplicate: boolean }>(
        "receipts",
        {
          image: image.split(",")[1],
          totalCents: Math.round(Number(amount) * 100),
          reference,
          soldOn,
          description: String(f.get("description")),
          confirmed: f.get("confirmed") === "on",
        },
      );
      if (result.duplicate) {
        setError(
          `Este comprobante ya está registrado en la venta ${result.id.slice(0, 8)}. No se creó otra venta.`,
        );
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Nueva venta desde una foto"
      onClose={onClose}
      busy={busy}
      wide
    >
      <div className={styles.form}>
        <p className={styles.help}>
          Sacá una foto nítida o elegí una imagen. La lectura se realiza en este
          dispositivo; revisá los datos antes de guardar.
        </p>
        <div className={styles.formGrid}>
          <label className="secondary-button">
            <Camera size={18} /> Sacar foto
            <input
              aria-label="Sacar foto del comprobante"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={reading || busy}
              onChange={(e) => void load(e.target.files?.[0])}
            />
          </label>
          <label className="secondary-button">
            <Upload size={18} /> Subir boleta
            <input
              aria-label="Subir boleta"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={reading || busy}
              onChange={(e) => void load(e.target.files?.[0])}
            />
          </label>
        </div>
        {reading && (
          <p role="status">
            <LoaderCircle className="spinner" size={18} /> Leyendo comprobante…{" "}
            {progress}%
          </p>
        )}
        {image && (
          <a
            href={image}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver foto completa"
          >
            <Image
              width={800}
              height={600}
              unoptimized
              src={image}
              alt="Comprobante a revisar"
              style={{
                maxWidth: "100%",
                maxHeight: 300,
                objectFit: "contain",
                borderRadius: 12,
              }}
            />
          </a>
        )}
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        {image && !reading && (
          <form className={styles.form} onSubmit={submit}>
            <fieldset disabled={busy}>
              <div className={styles.formGrid}>
                <label>
                  Total de la venta
                  <input
                    type="number"
                    min="0.01"
                    max="10000000000"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Fecha de la venta
                  <input
                    type="date"
                    required
                    value={soldOn}
                    onChange={(e) => setSoldOn(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Referencia única del comprobante
                <input
                  required
                  maxLength={160}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej.: 0001-00001234"
                />
              </label>
              <label>
                Descripción
                <input
                  name="description"
                  required
                  minLength={3}
                  maxLength={500}
                  defaultValue="Venta registrada desde comprobante"
                />
              </label>
              <details>
                <summary>Texto detectado</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                  {text ||
                    "Sin texto legible. Podés completar los datos manualmente."}
                </pre>
              </details>
              <p className={styles.help}>
                Registra una venta ya realizada. No descuenta stock ni registra
                un cobro automáticamente. Si es el comprobante de una venta ya
                cargada, registrá su cobro desde Pagos y caja.
              </p>
              <label>
                <input
                  name="confirmed"
                  type="checkbox"
                  required
                  style={{ width: "auto" }}
                />{" "}
                Confirmo que corresponde a una venta de mi negocio y revisé el
                importe, la fecha y la referencia.
              </label>
            </fieldset>
            <button className="primary-button" disabled={busy}>
              {busy ? "Guardando…" : "Registrar venta del comprobante"}
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
