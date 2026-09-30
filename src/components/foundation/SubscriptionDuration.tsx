"use client";
import { useState } from "react";
export function SubscriptionDuration() {
  const [duration, setDuration] = useState("KEEP");
  return (
    <>
      <label>
        Duración de la suscripción
        <select
          name="duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          <option value="KEEP">Mantener vigencia actual</option>
          <option value="DAYS_14">14 días desde ahora</option>
          <option value="MONTHLY">1 mes desde ahora</option>
          <option value="QUARTERLY">3 meses desde ahora</option>
          <option value="YEARLY">1 año desde ahora</option>
          <option value="CUSTOM">Elegir fecha de vencimiento</option>
          <option value="UNLIMITED">Sin vencimiento</option>
        </select>
      </label>
      {duration === "CUSTOM" && (
        <label>
          Fecha y hora de vencimiento
          <input type="datetime-local" name="expiresAt" required />
          <small>Hora local de tu dispositivo.</small>
        </label>
      )}
      {!["KEEP", "CUSTOM", "UNLIMITED"].includes(duration) && (
        <p>
          La duración comienza al guardar. Reemplaza el vencimiento anterior.
        </p>
      )}
    </>
  );
}
