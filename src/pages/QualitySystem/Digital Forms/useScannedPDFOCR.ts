import React, { useState, useEffect } from "react";
import { useFMSAuth } from "@/context/FMSAuthContext";
import { toast } from "sonner";

export const useScannedPDFOCR = () => {
  const { user } = useFMSAuth();

  const extractTextWithOCR = async (pageUrlOrDataURL: string): Promise<string> => {
    try {
      // Tesseract.js runs in browser - wait for it to be ready
      if ((window as any).Tesseract) {
        const result = await (window as any).Tesseract.recognize(
          pageUrlOrDataURL,
          "eng",
          {
            tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-:() ",
            preserveStyle: false,
          }
        );
        return result.data.text || "";
      }
      return "";
    } catch (error) {
      console.error("OCR error:", error);
      return "";
    }
  };

  const extractTextFromScannedPage = async (
    canvas: HTMLCanvasElement
  ): Promise<string> => {
    try {
      // Convert canvas to data URL for tesseract
      const dataURL = canvas.toDataURL("image/png");
      return await extractTextWithOCR(dataURL);
    } catch (error) {
      console.error("Canvas OCR error:", error);
      return "";
    }
  };

  return {
    extractTextWithOCR,
    extractTextFromScannedPage,
  };
};