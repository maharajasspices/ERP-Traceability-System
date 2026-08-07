// QR Code generation utilities using the qrcode library
// Generates scannable QR codes client-side with no external API calls or limits

import QRCode from 'qrcode';

export interface QRCodeData {
  id: string;
  data: string;
  imageDataUrl: string;
  createdAt: string;
  expiresAt: string; // 1 month from creation
}

// HTML escape function to prevent XSS attacks
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Generate a scannable QR code image using the qrcode library
export async function generateQRCodeImage(text: string, size: number = 200): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

// Generate a pair of identical QR codes for a batch
export async function generateQRCodePair(batchNumber: string, batchData: Record<string, any>): Promise<{ qr1: string; qr2: string }> {
  const dataString = JSON.stringify({
    batch: batchNumber,
    ...batchData,
    generated: new Date().toISOString(),
  });
  
  const qrImage = await generateQRCodeImage(dataString);
  
  return {
    qr1: qrImage,
    qr2: qrImage, // Same QR code twice as requested
  };
}

// Note: QR codes are now generated on-demand rather than stored
// This eliminates localStorage security risks (XSS vulnerability)
// Old storage functions removed for security reasons

// Download QR code as image with label text below
export async function downloadQRCodeWithLabel(
  dataUrl: string, 
  filename: string, 
  label: string,
  sublabel?: string
): Promise<void> {
  // Create a canvas to combine QR code with text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.src = dataUrl;
  
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const padding = 20;
      const textHeight = 30;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textHeight;
      
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code
      ctx.drawImage(img, padding, padding);
      
      // Draw only the batch/lot number label (bold, compact)
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(label, canvas.width / 2, img.height + padding + 20);
      
      resolve();
    };
  });

  // Download the combined image
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Simple download QR code as image (legacy)
export function downloadQRCode(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Build a labeled QR canvas (same look used for the download)
async function buildLabeledQRCanvas(dataUrl: string, label: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const padding = 20;
      const textHeight = 30;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(label, canvas.width / 2, img.height + padding + 20);
      resolve();
    };
  });
  return canvas;
}

// Copy QR code (with label baked in) to the system clipboard as a PNG image
export async function copyQRCodeWithLabel(dataUrl: string, label: string): Promise<void> {
  const canvas = await buildLabeledQRCanvas(dataUrl, label);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to create QR image');
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard image copy is not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

// Print QR codes (two copies)
export function printQRCodes(qr1: string, qr2: string, batchNumber: string, additionalInfo?: { product?: string; date?: string }): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  // Escape all user-controlled data to prevent XSS
  const safeBatchNumber = escapeHtml(batchNumber);
  
  // Build composite images with batch number baked in, so saving the image includes the text
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Codes - ${safeBatchNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        .qr-container { display: inline-block; margin: 20px; padding: 20px; border: 1px solid #ccc; }
        .qr-container canvas { display: block; margin: 0 auto; }
        .qr-container h3 { margin: 10px 0 5px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h2 class="no-print">Batch: ${safeBatchNumber}</h2>
      <div class="qr-container">
        <h3>Copy 1</h3>
        <canvas id="qr1canvas"></canvas>
      </div>
      <div class="qr-container">
        <h3>Copy 2</h3>
        <canvas id="qr2canvas"></canvas>
      </div>
      <br/><br/>
      <button class="no-print" onclick="window.print()">Print QR Codes</button>
      <script>
        function drawQRWithLabel(canvasId, imgSrc, label) {
          var canvas = document.getElementById(canvasId);
          var ctx = canvas.getContext('2d');
          var img = new Image();
          img.onload = function() {
            var padding = 16;
            var textH = 28;
            canvas.width = img.width + padding * 2;
            canvas.height = img.height + padding * 2 + textH;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding, padding);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, canvas.width / 2, img.height + padding + 18);
          };
          img.src = imgSrc;
        }
        drawQRWithLabel('qr1canvas', '${qr1}', '${safeBatchNumber}');
        drawQRWithLabel('qr2canvas', '${qr2}', '${safeBatchNumber}');
        setTimeout(function() { window.print(); }, 800);
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
