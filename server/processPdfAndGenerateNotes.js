import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, rgb } from "pdf-lib"; 

// --- ADD THESE LINES ---
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API (Replace with your actual API key or use process.env)
const genAI = new GoogleGenerativeAI("AIzaSyAq7j5ZhL3HcpAcMFsx9Nop6_1QTiBSuJY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// -----------------------

// ... rest of your sanitizeText and existing code ...
// Add your Gemini SDK import at the top
// import { GoogleGenerativeAI } from "@google/generative-ai";

export async function processPdfAndGenerateNotes(fileBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      disableFontFace: true,
      verbosity: 0 
    });

    const pdfDoc = await loadingTask.promise;
    let rawText = "";
    const pagesToRead = Math.min(pdfDoc.numPages, 15); 
    
    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      rawText += content.items.map(s => s.str).join(" ") + " ";
    }

    const cleanText = sanitizeText(rawText);

    // --- NEW: AI SORTING LOGIC ---
    // Instead of keyword matching, we use the AI
    const sortedNotes = await sortTextWithGemini(cleanText);

    // Cumulative logic remains the same
    const combinedMedium = `${sortedNotes.easy}\n\n${sortedNotes.medium}`;
    const combinedHard = `${sortedNotes.easy}\n\n${sortedNotes.medium}\n\n${sortedNotes.hard}`;

    const [easy, medium, hard] = await Promise.all([
      generatePdfFromText("CORE CONCEPTS & DEFINITIONS", sortedNotes.easy),
      generatePdfFromText("PROCESS & APPLICATION (INCLUDES CORE)", combinedMedium),
      generatePdfFromText("COMPLETE ADVANCED THEORETICAL FRAMEWORK", combinedHard)
    ]);

    // ... (rest of your file saving logic)
  } catch (err) {
    console.error("❌ Processing Error:", err.message);
    throw err;
  }
}