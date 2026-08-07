import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Camera, X, ScanLine } from 'lucide-react';
import { extractBestScanIdentifier } from '@/lib/scanParser';
interface QRScannerProps {
  onScanResult: (result: string) => void;
  triggerButton?: React.ReactNode;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanResult, triggerButton }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const hasScannedRef = useRef(false);
  const isStartingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    setIsScannerReady(false);
    try {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2 || state === 3) {
            await scannerRef.current.stop();
          }
        } catch { /* ignore */ }
        try {
          scannerRef.current.clear();
        } catch { /* ignore */ }
        scannerRef.current = null;
      }
    } catch {
      scannerRef.current = null;
    }
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    toast.success('QR code scanned successfully!');

    const result = extractBestScanIdentifier(decodedText) || decodedText;

    onScanResult(result);
    setIsOpen(false);
  }, [onScanResult]);

  const startScanner = useCallback(async () => {
    if (isStartingRef.current || scannerRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setIsScannerReady(false);
    hasScannedRef.current = false;

    const containerId = containerIdRef.current;

    // Wait for container to be in DOM
    let containerEl: HTMLElement | null = null;
    for (let i = 0; i < 30; i++) {
      containerEl = document.getElementById(containerId);
      if (containerEl && containerEl.offsetWidth > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (!containerEl) {
      setIsStarting(false);
      isStartingRef.current = false;
      return;
    }

    try {
      // Dynamically import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      // ALWAYS enumerate cameras first - this is critical for laptop/PC
      let cameraId: string | undefined;
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          // On mobile prefer back camera, on desktop just use first available
          const backCam = cameras.find(c =>
            /back|rear|environment/i.test(c.label)
          );
          cameraId = backCam?.id || cameras[0].id;
        }
      } catch {
        // getCameras failed - will try facingMode fallback
      }

      const scanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      const onSuccess = (decodedText: string) => handleScanSuccess(decodedText);
      const onError = () => { /* QR not in frame - normal */ };

      if (cameraId) {
        // Use specific camera ID (works on both desktop and mobile)
        await scanner.start(cameraId, scanConfig, onSuccess, onError);
      } else {
        // Fallback: try environment first, then user-facing
        try {
          await scanner.start({ facingMode: 'environment' }, scanConfig, onSuccess, onError);
        } catch {
          await scanner.start({ facingMode: 'user' }, scanConfig, onSuccess, onError);
        }
      }

      // Force video element to be visible - html5-qrcode sometimes hides it
      requestAnimationFrame(() => {
        const container = document.getElementById(containerId);
        if (container) {
          const videos = container.querySelectorAll('video');
          videos.forEach(v => {
            v.style.display = 'block';
            v.style.width = '100%';
            v.style.height = '300px';
            v.style.objectFit = 'cover';
            v.style.borderRadius = '8px';
          });
          // Also fix any wrapper divs the library creates
          const innerDivs = container.querySelectorAll('div');
          innerDivs.forEach(d => {
            d.style.overflow = 'visible';
          });
        }
      });

      setHasPermission(true);
      setIsScannerReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      setHasPermission(false);
      toast.error('Unable to open camera. Please allow camera permissions and try again.');
      scannerRef.current = null;
      setIsScannerReady(false);
    } finally {
      setIsStarting(false);
      isStartingRef.current = false;
    }
  }, [handleScanSuccess]);

  const handleManualInput = () => {
    const input = prompt('Enter batch number or lot number manually:');
    if (input) {
      onScanResult(input);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog DOM is rendered
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setHasPermission(null);
      setIsStarting(false);
      setIsScannerReady(false);
      hasScannedRef.current = false;
      isStartingRef.current = false;
    }

    return () => { stopScanner(); };
  }, [isOpen, startScanner, stopScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2">
            <Camera className="h-4 w-4" />
            Scan QR
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan QR Code
          </DialogTitle>
          <DialogDescription>
            Point your camera at a QR code to scan it automatically
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black" style={{ minHeight: '320px' }}>
          {hasPermission === false ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center" style={{ minHeight: '320px' }}>
              <Camera className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-white">Camera access denied</p>
              <p className="mb-4 text-xs text-white/60">
                Please allow camera permissions in your browser settings and try again.
              </p>
              <Button variant="outline" onClick={() => { setHasPermission(null); startScanner(); }}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {/* Scanner container - html5-qrcode renders video here */}
              <div
                id={containerIdRef.current}
                style={{ width: '100%', minHeight: '320px', position: 'relative' }}
              />

              {/* Scanning overlay with animated line */}
              {isScannerReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[220px] w-[220px]">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-green-400" />
                    <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-green-400" />
                    <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-green-400" />
                    <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-green-400" />
                    {/* Animated scan line */}
                    <div className="absolute left-1 right-1 h-0.5 bg-green-400/80 animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* Loading overlay - only shows BEFORE camera is ready */}
              {(isStarting || !isScannerReady) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <div className="mb-3 h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <p className="text-sm text-white">Opening camera…</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleManualInput}>
            Enter Manually
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
