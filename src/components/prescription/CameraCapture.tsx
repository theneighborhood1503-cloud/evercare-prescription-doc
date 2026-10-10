import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (file: File) => void;
  onFallback: () => void;
}

export function CameraCapture({ open, onOpenChange, onCapture, onFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access isn't supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("Camera permission was denied or no camera is available.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) return;
        onCapture(new File([b], `prescription-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.95,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Scan prescription</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { onOpenChange(false); onFallback(); }}>
              Use device camera app instead
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg bg-foreground">
              <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-contain" />
            </div>
            <p className="text-xs text-muted-foreground">Place the prescription flat, in good light, with all edges visible.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}><X /> Cancel</Button>
              <Button onClick={capture}><Camera /> Capture</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
