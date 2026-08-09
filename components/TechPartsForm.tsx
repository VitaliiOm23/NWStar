"use client";

import { useState } from "react";
import { submitTechParts } from "@/app/tech/actions";

const units = ["ea", "set", "kit", "qt", "gal", "L", "mL", "oz", "lb", "ft", "in", "bottle", "tube"];

type PartRow = { description: string; partNumber: string; quantity: string; unit: string; notes: string };
const blankRow = (): PartRow => ({ description: "", partNumber: "", quantity: "1", unit: "ea", notes: "" });

export function TechPartsForm({ repairOrderId, jobId }: { repairOrderId: string; jobId: string }) {
  const [rows, setRows] = useState<PartRow[]>([blankRow()]);

  function update(index: number, field: keyof PartRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }
  function addRow() { setRows((current) => [...current, blankRow()]); }
  function removeRow(index: number) { setRows((current) => current.length === 1 ? [blankRow()] : current.filter((_, i) => i !== index)); }

  const payload = JSON.stringify(rows.filter((row) => row.description.trim()).map((row) => ({
    description: row.description.trim(),
    partNumber: row.partNumber.trim(),
    quantity: Number(row.quantity || 1),
    unit: row.unit || "ea",
    notes: row.notes.trim(),
  })));

  return (
    <form action={submitTechParts} className="tech-structured-parts-form">
      <input type="hidden" name="repairOrderId" value={repairOrderId} />
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="partsJson" value={payload} />
      <div className="tech-parts-rows">
        {rows.map((row, index) => (
          <div className="tech-parts-input-row" key={index}>
            <div className="field tech-part-description"><label>Part / material</label><input value={row.description} onChange={(event) => update(index, "description", event.target.value)} placeholder="Seal, oil, NOx sensor, hose..." /></div>
            <div className="field"><label>Qty</label><input type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => update(index, "quantity", event.target.value)} /></div>
            <div className="field"><label>Unit</label><select value={row.unit} onChange={(event) => update(index, "unit", event.target.value)}>{units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></div>
            <div className="field"><label>Part #</label><input value={row.partNumber} onChange={(event) => update(index, "partNumber", event.target.value)} /></div>
            <div className="field tech-part-notes"><label>Note</label><input value={row.notes} onChange={(event) => update(index, "notes", event.target.value)} placeholder="Optional" /></div>
            <button className="text-button danger tech-remove-part-row" type="button" onClick={() => removeRow(index)} aria-label="Remove part row">Remove</button>
          </div>
        ))}
      </div>
      <div className="tech-parts-form-actions"><button className="button secondary" type="button" onClick={addRow}>+ Add another</button><button className="button" type="submit">Submit parts needed</button></div>
    </form>
  );
}
