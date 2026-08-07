import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Simple export that takes pre-formatted data objects (key-value pairs)
export const exportToPDF = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;
  
  const doc = new jsPDF();
  const headers = Object.keys(data[0]);
  
  // Title
  doc.setFontSize(18);
  doc.text(filename.replace(/_/g, ' '), 14, 22);
  
  // Subtitle with date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 30);
  
  // Table
  const tableData = data.map(row => headers.map(h => row[h] ?? ''));
  
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  doc.save(`${filename}.pdf`);
};

// Simple export that takes pre-formatted data objects
export const exportToExcel = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  // Auto-size columns
  const headers = Object.keys(data[0]);
  const colWidths = headers.map(h => ({
    wch: Math.max(h.length, 15)
  }));
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
