import React from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useFMSAuth } from "@/context/FMSAuthContext";

export const useCompletedPDF = () => {
  const { user } = useFMSAuth();

  const generateCompletedPDF = async (
    templateKey: string,
    formData: any[],
    placedFields: any[]
  ): Promise<Blob> => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      // Get page dimensions
      const pageWidth = doc.internal.pageWidth;
      const pageHeight = doc.internal.pageHeight;

      // 1. Draw the PDF background/template first
      // We'll use the extracted text positions as reference
      // For now, draw a header area
      doc.setFillColor(20, 50, 100); // Dark blue header
      doc.rect(0, 0, pageWidth, 30, "F");

      // Add document title
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("DIGITAL QUALITY FORM", pageWidth / 2, 15, { align: "center" });

      // 2. Draw form fields based on placedFields
      placedFields.forEach((field: any) => {
        const { x, y, width, height, type, label } = field;

        // Add some offset for form margins
        const margin = 10;
        const fieldX = x + margin;
        const fieldY = y + margin;
        const fieldW = width - margin * 2;
        const fieldH = height - margin * 2;

        // Draw field background
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(fieldX, fieldY, fieldW, fieldH, "DF");

        // Add field label
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(label || "", fieldX, fieldY - 5);

        // Add sample data based on type
        doc.setFont("helvetica", "normal");
        let sampleValue = "";
        switch (type) {
          case "text":
            sampleValue = formData.find((f: any) => f.label === label)?.value || "";
            break;
          case "number":
            sampleValue = formData.find((f: any) => f.label === label)?.value || "0";
            break;
          case "date":
            sampleValue = formData.find((f: any) => f.label === label)?.value || "";
            break;
          case "textarea":
            sampleValue = formData.find((f: any) => f.label === label)?.value || "";
            break;
        }

        if (sampleValue) {
          doc.setFontSize(10);
          const inputX = fieldX + 2;
          const inputY = fieldY + 5;
          const inputW = fieldW - 4;
          const inputH = fieldH - 10;

          // Draw white background for input
          doc.setFillColor(255, 255, 255);
          doc.rect(inputX, inputY, inputW, inputH, "F");

          // Write the value
          doc.setTextColor(0, 0, 0);
          doc.text(sampleValue, inputX + 2, inputY + 3);
        }
      });

      // 3. Add footer with document info
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`Document: ${templateKey}`, 10, pageHeight - 10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 100, pageHeight - 10, {
        align: "right",
      });

      // 4. Save the PDF
      const blob = doc.output("blob");
      return blob;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    }
  };

  return { generateCompletedPDF };
};