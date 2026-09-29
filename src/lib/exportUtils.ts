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

// Quote a single CSV field if needed (commas, quotes, newlines, or padding spaces)
const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralise CSV formula injection (=, +, -, @) by prefixing an apostrophe
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Export pre-formatted data objects to a CSV file.
 * Follows the same shape as exportToExcel: an array of flat key-value rows.
 */
export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;

  // Union of all keys so rows with sparse fields still line up
  const headers: string[] = [];
  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    });
  });

  const lines = [headers.map(escapeCsvValue).join(',')];
  data.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','));
  });

  // BOM so Excel opens UTF-8 (e.g. accented descriptions) correctly
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
