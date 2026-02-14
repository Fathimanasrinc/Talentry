import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, rgb } from "pdf-lib"; 

// --- Improved Text Sanitization ---
function sanitizeText(text) {
  return String(text)
    .replace(/[•◦▪︎●○]/g, "") // Remove bullet symbols to force paragraph flow
    .replace(/[""'']/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/[\u0080-\uffff]/g, "")
    .replace(/\s+/g, " ") 
    .trim();
}

// --- HUMAN LOGIC: Keyword Definitions ---
const LOGIC_CONFIG = {
  easy: ["definition", "basic", "what", "who", "summary", "simple", "overview", "main", "start", "introduction", "fact", "example"],
  medium: ["how", "why", "process", "function", "connect", "between", "result", "method", "application", "interaction", "develop", "system"],
  hard: ["theory", "critique", "advanced", "implication", "analysis", "nuance", "complex", "theoretical", "evaluation", "framework", "consequence", "structure", "mechanism", "attribute", "significant"]
};

function sortTextByLogic(rawText) {
  const sentences = rawText.split(/[.!?]+\s/);
  const sorted = { easy: [], medium: [], hard: [] };

  sentences.forEach(sentence => {
    const cleanSentence = sentence.toLowerCase().trim();
    if (cleanSentence.length < 20) return; 

    const scores = {
      easy: LOGIC_CONFIG.easy.filter(word => cleanSentence.includes(word)).length,
      medium: LOGIC_CONFIG.medium.filter(word => cleanSentence.includes(word)).length,
      hard: LOGIC_CONFIG.hard.filter(word => cleanSentence.includes(word)).length
    };

    if (scores.hard > 0 || cleanSentence.length > 150) {
      sorted.hard.push(sentence.trim());
    } else if (scores.medium > 0 || scores.easy === 0) {
      sorted.medium.push(sentence.trim());
    } else {
      sorted.easy.push(sentence.trim());
    }
  });

  const createParagraphs = (arr) => {
    let paragraphs = [];
    for (let i = 0; i < arr.length; i += 4) {
      paragraphs.push(arr.slice(i, i + 4).join(". ") + ".");
    }
    return paragraphs.join("\n\n");
  };

  return {
    easy: sorted.easy.length ? createParagraphs(sorted.easy) : "Foundational overview.",
    medium: sorted.medium.length ? createParagraphs(sorted.medium) : "Detailed process analysis.",
    hard: sorted.hard.length ? createParagraphs(sorted.hard) : "Advanced structural implications."
  };
}

async function generatePdfFromText(title, content) {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont('Helvetica');
    const fontBold = await pdfDoc.embedFont('Helvetica-Bold');

    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    
    const margin = 50;
    const bulletMargin = 20; // Extra indent for the text after the bullet
    const fontSize = 10;
    const lineHeight = 14;
    let currentY = height - 90;

    // --- Header ---
    page.drawRectangle({
      x: 0, y: height - 60, width, height: 60,
      color: rgb(0.1, 0.2, 0.4) 
    });

    page.drawText(title, { 
      x: margin, y: height - 38, size: 16, font: fontBold, color: rgb(1, 1, 1) 
    });

    // Split content by sentences or paragraphs to create points
    // Using \n\n as defined in your sortTextByLogic function
    const points = content.split("\n\n").filter(p => p.trim() !== "");

    for (const point of points) {
      const words = point.split(/\s+/);
      let currentLine = "";
      let isFirstLineOfPoint = true;

      for (const word of words) {
        const testLine = currentLine + word + " ";
        // Text width limit depends on whether we are indented for a bullet
        const maxLineWidth = width - (margin * 2) - bulletMargin;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxLineWidth) {
          // Draw the line
          const xPos = isFirstLineOfPoint ? margin + bulletMargin : margin + bulletMargin;
          
          if (isFirstLineOfPoint) {
            page.drawText("•", { x: margin, y: currentY, size: fontSize, font: fontBold });
          }

          page.drawText(currentLine.trim(), { x: xPos, y: currentY, size: fontSize, font });
          
          currentY -= lineHeight;
          currentLine = word + " ";
          isFirstLineOfPoint = false;

          // Page Overflow Check
          if (currentY < margin + 40) {
            page = pdfDoc.addPage([612, 792]);
            currentY = height - margin;
          }
        } else {
          currentLine = testLine;
        }
      }

      // Draw the last remaining line of the point
      if (isFirstLineOfPoint) {
         page.drawText("•", { x: margin, y: currentY, size: fontSize, font: fontBold });
      }
      page.drawText(currentLine.trim(), { x: margin + bulletMargin, y: currentY, size: fontSize, font });
      
      // Add extra spacing between bullet points
      currentY -= (lineHeight * 1.5); 
    }

    return await pdfDoc.save(); 
  } catch (e) {
    console.error("PDF Component Failure:", e.message);
    const fallbackDoc = await PDFDocument.create();
    fallbackDoc.addPage().drawText("Error generating document content.");
    return await fallbackDoc.save();
  }
}

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
    const sortedNotes = sortTextByLogic(cleanText);

    // --- CUMULATIVE LOGIC ---
    // Medium = Easy + Medium
    const combinedMedium = `${sortedNotes.easy}\n\n${sortedNotes.medium}`;
    // Hard = Easy + Medium + Hard
    const combinedHard = `${sortedNotes.easy}\n\n${sortedNotes.medium}\n\n${sortedNotes.hard}`;

    const [easy, medium, hard] = await Promise.all([
      generatePdfFromText("CORE CONCEPTS & DEFINITIONS", sortedNotes.easy),
      generatePdfFromText("PROCESS & APPLICATION (INCLUDES CORE)", combinedMedium),
      generatePdfFromText("COMPLETE ADVANCED THEORETICAL FRAMEWORK", combinedHard)
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
    console.error("❌ Processing Error:", err.message);
    throw err;
  }
}