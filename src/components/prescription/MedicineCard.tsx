import { Badge } from "@/components/ui/badge";
import type { Medicine } from "@/lib/prescription/types";

const STATUS: Record<Medicine["confidence_or_review_status"], { label: string; cls: string }> = {
  confident: { label: "Clearly read", cls: "bg-success text-success-foreground" },
  needs_review: { label: "Needs Review", cls: "bg-warning text-warning-foreground" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
};

function Field({ label, value }: { label: string; value: string | null | string[] }) {
  const empty = value === null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={empty ? "text-sm italic text-muted-foreground" : "text-sm text-foreground"}>
        {empty ? "Unknown" : Array.isArray(value) ? value.join(", ") : value}
      </dd>
    </div>
  );
}

export function MedicineCard({ m, index }: { m: Medicine; index: number }) {
  const s = STATUS[m.confidence_or_review_status];
  return (
    <article className="rounded-xl border bg-card p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">#{index + 1}</p>
          <h3 className="font-display text-2xl leading-tight">{m.medicine_name}</h3>
        </div>
        <Badge className={s.cls}>{s.label}</Badge>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Brand" value={m.brand_name} />
        <Field label="Generic" value={m.generic_name} />
        <Field label="Dosage" value={m.dosage} />
        <Field label="Unit" value={m.dosage_unit} />
        <Field label="Per dose" value={m.quantity_per_dose} />
        <Field label="Route" value={m.route_of_administration} />
        <Field label="Frequency" value={m.frequency} />
        <Field label="Times" value={m.prescribed_times} />
        <Field label="Duration" value={m.duration} />
        <Field label="Total qty" value={m.total_quantity} />
        <div className="col-span-2 sm:col-span-3">
          <Field label="Instructions" value={m.special_instructions} />
        </div>
      </dl>
      <div className="mt-4 rounded-md bg-muted p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Source text</p>
        <p className="font-mono text-xs whitespace-pre-wrap">{m.source_text}</p>
      </div>
      {m.missing_fields.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Missing: {m.missing_fields.join(", ")}</p>
      )}
    </article>
  );
}
