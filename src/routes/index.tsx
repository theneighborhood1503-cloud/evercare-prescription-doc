import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, Camera, Copy, FileText, Loader2, RefreshCw, RotateCcw, ScanText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/prescription/CameraCapture";
import { MedicineCard } from "@/components/prescription/MedicineCard";
import { usePrescriptionExtractor } from "@/hooks/use-prescription-extractor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EVERCARE Prescription Extractor" },
      { name: "description", content: "Upload or scan a prescription to extract its text and medicine details." },
      { property: "og:title", content: "EVERCARE Prescription Extractor" },
      { property: "og:description", content: "Read prescriptions and list every medicine in a structured format." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const x = usePrescriptionExtractor();
  const uploadRef = useRef<HTMLInputElement>(null);
  const nativeCamRef = useRef<HTMLInputElement>(null);
  const [camOpen, setCamOpen] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) x.select(f);
    e.target.value = "";
  };

  const copy = async () => {
    if (!x.result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(x.result, null, 2));
      toast.success("Results copied as JSON");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const isPdf = x.file?.type === "application/pdf";
  const p = x.result?.prescription;

  return (
    <div className="min-h-screen font-sans">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="font-mono text-xs uppercase tracking-[0.25em] opacity-80">EVERCARE</p>
          <h1 className="font-display text-4xl sm:text-5xl">Prescription Extractor</h1>
          <p className="mt-2 max-w-xl text-sm opacity-90">
            Upload or scan a prescription. We read every line and list each medicine exactly as written — nothing guessed.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: input */}
        <section className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => uploadRef.current?.click()} disabled={x.status === "loading"}>
                <Upload /> Upload
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setCamOpen(true)} disabled={x.status === "loading"}>
                <Camera /> Scan
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">JPG, JPEG, PNG or PDF · up to 10 MB · not stored</p>
            <input ref={uploadRef} type="file" hidden accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={onPick} />
            <input ref={nativeCamRef} type="file" hidden accept="image/*" capture="environment" onChange={onPick} />
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-card">
            {x.previewUrl && x.file ? (
              <div className="space-y-3">
                {isPdf ? (
                  <object data={x.previewUrl} type="application/pdf" className="h-[420px] w-full rounded-md">
                    <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <FileText /> {x.file.name}
                    </div>
                  </object>
                ) : (
                  <img src={x.previewUrl} alt="Prescription preview" className="max-h-[480px] w-full rounded-md object-contain bg-muted" />
                )}
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="truncate text-xs text-muted-foreground">{x.file.name} · {(x.file.size / 1024).toFixed(0)} KB</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => uploadRef.current?.click()} disabled={x.status === "loading"}>
                      <RefreshCw /> Replace
                    </Button>
                    <Button size="sm" variant="ghost" onClick={x.reset} disabled={x.status === "loading"}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground">
                <ScanText className="size-8" />
                <p className="text-sm">No prescription selected</p>
              </div>
            )}
          </div>

          <Button size="lg" className="w-full" onClick={x.run} disabled={!x.file || x.status === "loading"}>
            {x.status === "loading" ? <><Loader2 className="animate-spin" /> Extracting…</> : <><ScanText /> Extract Prescription Details</>}
          </Button>
        </section>

        {/* Right: output */}
        <section className="space-y-4" aria-live="polite">
          {x.status === "error" && x.error && (
            <div className="rounded-xl border border-destructive/40 bg-card p-5 shadow-card">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-destructive" />
                <div className="space-y-3">
                  <p className="font-medium">Couldn't extract this prescription</p>
                  <p className="text-sm text-muted-foreground">{x.error.message}</p>
                  <div className="flex gap-2">
                    {x.file && <Button size="sm" onClick={x.run}><RefreshCw /> Retry</Button>}
                    <Button size="sm" variant="outline" onClick={x.reset}><RotateCcw /> Start over</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {x.status === "loading" && (
            <div className="space-y-3 rounded-xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-3"><Loader2 className="animate-spin text-primary" /><p className="font-medium">Reading prescription…</p></div>
              <p className="text-sm text-muted-foreground">Transcribing text, then identifying medicines. This usually takes 10–30 seconds.</p>
            </div>
          )}

          {(x.status === "idle" || x.status === "ready") && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              <p className="font-display text-2xl text-foreground">Results will appear here</p>
              <p className="mt-1 text-sm">Each medicine is listed separately with its original wording.</p>
            </div>
          )}

          {x.status === "success" && x.result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-3xl">{x.result.medicines.length} medicine{x.result.medicines.length === 1 ? "" : "s"} found</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copy}><Copy /> Copy Results</Button>
                  <Button variant="ghost" size="sm" onClick={x.reset}><RotateCcw /> Reset</Button>
                </div>
              </div>

              {p && (p.prescription_date || p.patient_name || p.prescriber_name || p.prescriber_details) && (
                <div className="grid gap-3 rounded-xl border bg-secondary p-4 text-sm sm:grid-cols-2">
                  {p.prescription_date && <div><span className="text-muted-foreground">Date: </span>{p.prescription_date}</div>}
                  {p.patient_name && <div><span className="text-muted-foreground">Patient: </span>{p.patient_name}</div>}
                  {p.prescriber_name && <div><span className="text-muted-foreground">Prescriber: </span>{p.prescriber_name}</div>}
                  {p.prescriber_details && <div className="sm:col-span-2"><span className="text-muted-foreground">Details: </span>{p.prescriber_details}</div>}
                </div>
              )}

              {x.result.warnings.length > 0 && (
                <div className="rounded-xl border border-warning bg-card p-4">
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warning-foreground" /> Please review</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {x.result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {x.result.medicines.length === 0 ? (
                <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No medicines were identified. Check the raw text below.</div>
              ) : (
                <div className="space-y-4">
                  {x.result.medicines.map((m, i) => <MedicineCard key={i} m={m} index={i} />)}
                </div>
              )}

              <div className="rounded-xl border bg-card p-5 shadow-card">
                <h3 className="mb-2 font-display text-xl">Complete raw text</h3>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{x.result.raw_text}</pre>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">
        Always verify extracted details against the original prescription. Not a substitute for a pharmacist's review.
      </footer>

      <CameraCapture open={camOpen} onOpenChange={setCamOpen} onCapture={x.select} onFallback={() => nativeCamRef.current?.click()} />
    </div>
  );
}
