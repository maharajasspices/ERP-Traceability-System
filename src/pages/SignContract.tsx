import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  PenLine,
  Eraser,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PageState =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "signed"; signed_at?: string }
  | { kind: "ready"; data: ReadyData }
  | { kind: "error"; message: string };

interface ReadyData {
  expires_at: string;
  employee: { first_name: string; last_name: string } | null;
  document: { document_name: string } | null;
  contract_url: string | null;
}

interface SigningPadHandle {
  hasSignature: () => boolean;
  getDataUrl: () => string;
  clear: () => void;
}

// A lightweight draw-a-signature pad using pointer events (mouse + touch).
const SignaturePad = React.forwardRef<SigningPadHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  const getCtx = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    const pos = getPos(e);
    if (!ctx || !pos) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    hasInkRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    const pos = getPos(e);
    if (!ctx || !pos) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
  }, []);

  const getDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    // Trim to the bounding box of the drawn ink for a clean image.
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }, []);

  const hasSignature = useCallback(() => hasInkRef.current, []);

  useImperativeHandle(ref, () => ({ hasSignature, getDataUrl, clear }));

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      className="h-44 w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
      style={{ touchAction: "none" }}
    />
  );
});
SignaturePad.displayName = "SignaturePad";
const SignContract: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [page, setPage] = useState<PageState>({ kind: "loading" });
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const padRef = useRef<SigningPadHandle>(null);

  // Pre-fill the name from the known employee when available.
  useEffect(() => {
    if (page.kind === "ready" && page.data.employee) {
      const full = `${page.data.employee.first_name} ${page.data.employee.last_name}`.trim();
      setSignerName((prev) => prev || full);
    }
  }, [page]);

  // Validate the token + expiry and load the linked contract.
  const loadRequest = useCallback(async () => {
    if (!token) {
      setPage({ kind: "invalid", message: "This signing link is missing its secure token." });
      return;
    }

    setPage({ kind: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("sign-contract", {
        body: { operation: "get", token },
      });

      if (error || data?.error) {
        console.error("sign-contract (get) error:", error || data);
        setPage({ kind: "error", message: data?.error || error?.message || "Could not load this signing request." });
        return;
      }

      if (data.status === "signed") {
        setPage({ kind: "signed", signed_at: data.signed_at });
        return;
      }
      if (data.status === "expired") {
        setPage({ kind: "expired" });
        return;
      }
      if (data.status === "revoked") {
        setPage({ kind: "revoked" });
        return;
      }
      if (data.status === "pending") {
        setPage({
          kind: "ready",
          data: {
            expires_at: data.expires_at,
            employee: data.employee,
            document: data.document,
            contract_url: data.contract_url,
          },
        });
        return;
      }

      setPage({ kind: "invalid", message: "This signing link is no longer valid." });
    } catch (err) {
      console.error("sign-contract (get) unexpected error:", err);
      setPage({ kind: "error", message: "Something went wrong while loading your contract." });
    }
  }, [token]);

  useEffect(() => {
    loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequest]);

  const handleSubmit = async () => {
    if (!token || page.kind !== "ready") return;

    const pad = padRef.current;
    if (!pad || !pad.hasSignature()) {
      toast.error("Please draw your signature before submitting.");
      return;
    }

    const signatureData = pad.getDataUrl();
    if (!signatureData) {
      toast.error("Could not capture your signature. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-contract", {
        body: {
          operation: "complete",
          token,
          signature_data: signatureData,
          signer_name: signerName.trim() || undefined,
        },
      });

      if (error || data?.error) {
        console.error("sign-contract (complete) error:", error || data);
        if (String(data?.error || error?.message).includes("expired")) {
          setPage({ kind: "expired" });
        }
        toast.error(data?.error || error?.message || "Failed to sign the contract.");
        return;
      }

      if (data?.success) {
        setPage({ kind: "signed", signed_at: data.signed_at });
        toast.success("Contract signed successfully");
      } else {
        toast.error("The contract could not be signed.");
      }
    } catch (err) {
      console.error("sign-contract (complete) unexpected error:", err);
      toast.error("Something went wrong while signing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatExpiry = (iso: string) =>
    new Date(iso).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/30">
      {/* Brand header */}
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ef302b] font-bold text-white">MS</span>
          <span className="text-lg font-semibold">Maharaja's Spices</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <PenLine className="h-3.5 w-3.5" />
          Contract Signing
        </span>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 py-10 sm:p-6">
        <div className="w-full max-w-3xl">
          {page.kind === "loading" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading your contract…</p>
              </CardContent>
            </Card>
          )}

          {page.kind === "invalid" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ShieldAlert className="h-10 w-10 text-destructive" />
                <h2 className="text-xl font-bold">Invalid Link</h2>
                <p className="text-sm text-muted-foreground">{page.message}</p>
              </CardContent>
            </Card>
          )}

          {page.kind === "expired" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Clock className="h-10 w-10 text-amber-500" />
                <h2 className="text-xl font-bold">Link Expired</h2>
                <p className="text-sm text-muted-foreground">
                  This signing link has expired. Please contact the HR department to request a new one.
                </p>
              </CardContent>
            </Card>
          )}

          {page.kind === "revoked" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ShieldAlert className="h-10 w-10 text-destructive" />
                <h2 className="text-xl font-bold">Request Cancelled</h2>
                <p className="text-sm text-muted-foreground">
                  This signing request has been cancelled. Please contact the HR department.
                </p>
              </CardContent>
            </Card>
          )}

          {page.kind === "error" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ShieldAlert className="h-10 w-10 text-destructive" />
                <h2 className="text-xl font-bold">Something Went Wrong</h2>
                <p className="text-sm text-muted-foreground">{page.message}</p>
                <Button variant="outline" onClick={loadRequest}>Try Again</Button>
              </CardContent>
            </Card>
          )}

          {page.kind === "signed" && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Contract Signed</h2>
                <p className="text-sm text-muted-foreground">
                  Thank you! Your employment contract has been successfully signed
                  {page.signed_at ? (
                    <> on <strong>{new Date(page.signed_at).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</strong></>
                  ) : null}
                  . A record has been saved with the HR department.
                </p>
              </CardContent>
            </Card>
          )}


          {page.kind === "ready" && (
            <Card>
              <CardHeader>
                <CardTitle>Sign Your Employment Contract</CardTitle>
                <CardDescription>
                  {page.data.employee
                    ? `Hi ${page.data.employee.first_name} ${page.data.employee.last_name}, `
                    : ""}
                  please review your contract below and sign it electronically to complete your onboarding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contract preview */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    {page.data.document?.document_name || "Contract document"}
                  </p>
                  {page.data.contract_url ? (
                    <>
                      <div className="overflow-hidden rounded-lg border">
                        <iframe
                          src={page.data.contract_url}
                          title="Contract document"
                          className="h-[420px] w-full"
                        />
                      </div>
                      <a
                        href={page.data.contract_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open contract in a new tab
                      </a>
                    </>
                  ) : (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      The contract document could not be displayed. Please contact the HR department.
                    </p>
                  )}
                </div>

                {/* Expiry note */}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  This link expires on {formatExpiry(page.data.expires_at)}.
                </p>

                {/* Signer name */}
                <div className="space-y-2">
                  <label htmlFor="signer-name" className="text-sm font-medium">
                    Full name
                  </label>
                  <input
                    id="signer-name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Type your full name"
                    className="w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Signature pad */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Draw your signature</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => padRef.current?.clear()}
                    >
                      <Eraser className="mr-1.5 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                  <SignaturePad ref={padRef} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Use your mouse or finger to sign within the box above.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" onClick={loadRequest}>
                    Reload
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing…
                      </>
                    ) : (
                      <>
                        <PenLine className="mr-2 h-4 w-4" />
                        Sign &amp; Submit
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t bg-card px-6 py-4 text-center text-xs text-muted-foreground">
        This document is processed securely by Maharaja's Spices. Link is for the named recipient only.
      </footer>
    </div>
  );
};

export default SignContract;

