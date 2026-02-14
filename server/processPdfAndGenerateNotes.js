import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, rgb } from "pdf-lib"; 
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. USE THE FULL RESOURCE NAME
// This bypasses the SDK's internal path construction that is causing the 404.
const genAI = new GoogleGenerativeAI("AIzaSyBj4ybNmKYyZDW1UI8U3hwcaO58BIV95-8");
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" }); 

// --- Sanitization remains the same ---
function sanitizeText(text) {
  if (!text) return "";
  return String(text)
    .replace(/[•◦▪︎●○]/g, "") 
    .replace(/[""'']/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/[\u0080-\uffff]/g, "")
    .replace(/\s+/g, " ") 
    .trim();
}

// 2. UPDATED: Robust AI Sorting Logic
async function sortTextWithGemini(rawText) {
  if (!rawText || rawText.length < 50) {
    return { easy: "Insufficient text.", medium: "Insufficient text.", hard: "Insufficient text." };
  }

  const prompt = `
    Return ONLY a JSON object with keys "easy", "medium", and "hard".
    "easy": basic summary.
    "medium": process/application.
    "hard": advanced theory.
    
    Text: ${rawText.substring(0, 15000)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // The "Magic" Regex: Extracts only the JSON content between curly braces
    // This ignores markdown code blocks and conversational filler
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid response format");

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("AI Logic Error:", error.message);
    // Fallback data so the PDF is NOT empty
    return { 
        easy: "The AI was unable to parse this section. Please check the PDF content.", 
        medium: "Analysis unavailable.", 
        hard: "Advanced critique unavailable." 
    };
  }
}

// 3. UPDATED: PDF Generation (Ensuring content is visible)
async function generatePdfFromText(title, content) {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont('Helvetica');
    const fontBold = await pdfDoc.embedFont('Helvetica-Bold');
    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 50;
    const bulletMargin = 20; 
    const fontSize = 11; // Slightly larger for readability
    const lineHeight = 15;
    let currentY = height - 90;

    // Header
    page.drawRectangle({
      x: 0, y: height - 60, width, height: 60,
      color: rgb(0.1, 0.2, 0.4) 
    });

    page.drawText(title, { 
      x: margin, y: height - 38, size: 14, font: fontBold, color: rgb(1, 1, 1) 
    });

    // Content Handling
    const paragraphs = content.split("\n\n").filter(p => p.trim() !== "");

    for (const para of paragraphs) {
      const words = para.split(/\s+/);
      let currentLine = "";
      let isFirstLineOfPara = true;

      for (const word of words) {
        const testLine = currentLine + word + " ";
        const maxLineWidth = width - (margin * 2) - bulletMargin;
        
        if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
          if (isFirstLineOfPara) {
            page.drawText("•", { x: margin, y: currentY, size: fontSize, font: fontBold });
          }
          page.drawText(currentLine.trim(), { x: margin + bulletMargin, y: currentY, size: fontSize, font });
          
          currentY -= lineHeight;
          currentLine = word + " ";
          isFirstLineOfPara = false;

          // Page Break
          if (currentY < margin + 40) {
            page = pdfDoc.addPage([612, 792]);
            currentY = height - margin;
          }
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw trailing line
      if (isFirstLineOfPara) {
        page.drawText("•", { x: margin, y: currentY, size: fontSize, font: fontBold });
      }
      page.drawText(currentLine.trim(), { x: margin + bulletMargin, y: currentY, size: fontSize, font });
      currentY -= (lineHeight * 2); // Space between bullet points
    }

    return await pdfDoc.save(); 
  } catch (e) {
    console.error("PDF Gen Error:", e);
    const failDoc = await PDFDocument.create();
    failDoc.addPage().drawText("Critical Render Failure.");
    return await failDoc.save();
  }
}

// 4. MAIN EXPORT
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
    const sortedNotes = await sortTextWithGemini(cleanText);

    // Combine for cumulative logic
    const combinedMed = `${sortedNotes.easy}\n\n${sortedNotes.medium}`;
    const combinedHard = `${sortedNotes.easy}\n\n${sortedNotes.medium}\n\n${sortedNotes.hard}`;

    const [easy, medium, hard] = await Promise.all([
      generatePdfFromText("LEVEL 1: CORE CONCEPTS", sortedNotes.easy),
      generatePdfFromText("LEVEL 2: APPLICATION", combinedMed),
      generatePdfFromText("LEVEL 3: FULL ANALYSIS", combinedHard)
    ]);

    const outputDir = path.join(process.cwd(), "processed_notes");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(path.join(outputDir, "easy.pdf"), easy);
    fs.writeFileSync(path.join(outputDir, "medium.pdf"), medium);
    fs.writeFileSync(path.join(outputDir, "hard.pdf"), hard);

    return {
      easy: Buffer.from(easy).toString('base64'),
      medium: Buffer.from(medium).toString('base64'),
      hard: Buffer.from(hard).toString('base64'),
      folderPath: outputDir 
    };
  } catch (err) {
    console.error("❌ Process Error:", err.message);
    throw err;
  }
}