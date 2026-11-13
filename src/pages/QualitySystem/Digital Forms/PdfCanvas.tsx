
import React, { useRef, useEffect, useState } from "react";
import * as pdfjsDist from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsDist.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfPageProps {
  pdf: any;
  pageNumber: number;
  scale?: number;
}

export const PdfPage: React.FC<PdfPageProps> = ({
  pdf,
  pageNumber,
  scale = 1.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);

        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;

        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error("PDF page rendering error:", error);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="border rounded max-w-full h-auto mx-auto"
    />
  );
};

interface PdfCanvasProps {
  pdfUrl?: string;
  onPageChange?: (page: number) => void;
  factory?: "rockwood" | "nguni" | "both";
}

export const PdfCanvas: React.FC<PdfCanvasProps> = ({
  pdfUrl,
  onPageChange,
  factory,
}) => {
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ocrTexts, setOcrTexts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let loadedPdf: any = null;

    const loadPdf = async () => {
      setLoading(true);
      setError("");
      setPdf(null);
      setCurrentPage(1);

      if (!pdfUrl) {
        setLoading(false);
        return;
      }

      try {
        loadedPdf = await pdfjsDist.getDocument({
          url: pdfUrl,
        }).promise;

        if (!cancelled) {
          setPdf(loadedPdf);
        } else {
          await loadedPdf.destroy();
        }
      } catch (err) {
        console.error("PDF loading error:", err);

        if (!cancelled) {
          setError("Unable to load this PDF. Please check the file and its access permissions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (loadedPdf) {
        loadedPdf.destroy();
      }
    };
  }, [pdfUrl]);

  const changePage = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  // OCR handler for current page
  const handleOcrPage = async () => {
    if (!pdf) return;
    
    try {
      const pageObj = await pdf.getPage(currentPage);
      const viewport = pageObj.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d")!;
      
      const renderContext = {
        canvasContext: context,
        viewport,
      };
      
      pageObj.render(renderContext).promise.then(() => {
        const dataURL = canvas.toDataURL("image/png");
        
        if ((window as any).Tesseract) {
          const result = await (window as any).Tesseract.recognize(
            dataURL,
            "eng",
            {
              tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-:() ",
              preserveStyle: false,
            }
          );
          setOcrTexts(prev => {
            const newTexts = [...prev];
            newTexts[currentPage - 1] = result.data.text;
            return newTexts;
          });
          toast.success('OCR completed for page ' + currentPage);
        } else {
          toast.error('Tesseract not available. Please ensure the page loads first.');
        }
      });
    } catch (err) {
      console.error('OCR error:', err);
      toast.error('OCR processing failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading PDF...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">{error}</div>;
  }

  if (!pdf) {
    return <div className="p-8 text-center text-muted-foreground">Select a PDF to view.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => changePage(page)}
            className={`px-3 py-2 rounded ${
              currentPage === page
                ? "bg-primary text-white"
                : "bg-background text-muted-foreground border"
            }`}
          >
            Page {page}
          </button>
        ))}
      </div>

      <div className="border rounded w-full max-h-[800px] overflow-auto bg-secondary p-2">
        <PdfPage pdf={pdf} pageNumber={currentPage} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => changePage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded bg-secondary disabled:opacity-50"
        >
          Previous
        </button>

        <span className="text-sm">
          Page {currentPage} of {pdf.numPages}
        </span>

        <button
          onClick={() => changePage(Math.min(pdf.numPages, currentPage + 1))}
          disabled={currentPage === pdf.numPages}
          className="px-3 py-2 rounded bg-secondary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};
