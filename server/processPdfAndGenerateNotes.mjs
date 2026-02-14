import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, rgb } from "pdf-lib"; 

// --- Improved Text Sanitization ---
function sanitizeText(text) {
  return String(text)
    .replace(/[•◦▪︎●○]/g, "") 
    .replace(/[""'']/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/[\u0080-\uffff]/g, "")
    .replace(/\s+/g, " ") 
    .trim();
}

// --- LOGIC ENGINE: Weighted Scoring ---
const SCORING = {
  easy: { words: ["is", "are", "defined", "basic", "simple", "who", "what", "fact", "example"], weight: 1 },
  medium: { words: ["how", "process", "function", "connect", "result", "method", "application", "interaction", "system", "because"], weight: 3 },
  hard: { words: ["theory", "critique", "advanced", "implication", "analysis", "framework", "mechanism", "structure", "significant", "hypothesis"], weight: 5 }
};

function sortTextByLogic(rawText) {
  // Regex to split by sentence without breaking on abbreviations like "e.g."
  const sentences = rawText.match(/[^.!?]+[.!?]+/g) || [];
  const sorted = { easy: [], medium: [], hard: [] };

  sentences.forEach(sentence => {
    const clean = sentence.toLowerCase().trim();
    if (clean.length < 25) return; 

    let scoreHard = 0, scoreMedium = 0, scoreEasy = 0;

    SCORING.hard.words.forEach(w => { if (clean.includes(w)) scoreHard += SCORING.hard.weight; });
    SCORING.medium.words.forEach(w => { if (clean.includes(w)) scoreMedium += SCORING.medium.weight; });
    SCORING.easy.words.forEach(w => { if (clean.includes(w)) scoreEasy += SCORING.easy.weight; });

    // Logical Tiering
    if (scoreHard >= 5 || clean.length > 200) {
      sorted.hard.push(sentence.trim());
    } else if (scoreMedium >= 3 || (scoreMedium > 0 && scoreEasy > 0)) {
      sorted.medium.push(sentence.trim());
    } else {
      sorted.easy.push(sentence.trim());
    }
  });

  const createParagraphs = (arr) => {
    let paragraphs = [];
    for (let i = 0; i < arr.length; i += 4) {
      paragraphs.push(arr.slice(i, i + 4).join(" "));
    }
    return paragraphs.join("\n\n");
  };

  return {
    easy: sorted.easy.length ? createParagraphs(sorted.easy) : "Foundational overview.",
    medium: sorted.medium.length ? createParagraphs(sorted.medium) : "Process analysis.",
    hard: sorted.hard.length ? createParagraphs(sorted.hard) : "Theoretical framework."
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
    const bulletMargin = 20;
    const fontSize = 10;
    const lineHeight = 14;
    let currentY = height - 90;

    // Header
    page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: rgb(0.15, 0.25, 0.45) });
    page.drawText(title, { x: margin, y: height - 38, size: 14, font: fontBold, color: rgb(1, 1, 1) });

    const points = content.split("\n\n").filter(p => p.trim() !== "");

    for (const point of points) {
      const words = point.split(/\s+/);
      let currentLine = "";
      let isFirstLineOfPoint = true;

      for (const word of words) {
        const testLine = currentLine + word + " ";
        const maxLineWidth = width - (margin * 2) - bulletMargin;
        if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
          
          if (currentY < margin + 20) {
            page = pdfDoc.addPage([612, 792]);
            currentY = height - margin;
          }

          if (isFirstLineOfPoint) {
            page.drawText("•", { x: margin, y: currentY, size: fontSize, font: fontBold });
          }
          page.drawText(currentLine.trim(), { x: margin + bulletMargin, y: currentY, size: fontSize, font });
          
          currentLine = word + " ";
          currentY -= lineHeight;
          isFirstLineOfPoint = false;
        } else {
          currentLine = testLine;
        }
      }
      // Final line of point
      page.drawText(currentLine.trim(), { x: margin + bulletMargin, y: currentY, size: fontSize, font });
      currentY -= (lineHeight * 1.5);
    }

    return await pdfDoc.save(); 
  } catch (e) {
    return (await PDFDocument.create()).save();
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
    
    for (let i = 1; i <= Math.min(pdfDoc.numPages, 15); i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      
      // FIX: Added safe check for item.str to prevent "undefined" errors
      rawText += content.items
        .map(item => item.str || "") 
        .join(" ") + " ";
    }

    const cleanText = sanitizeText(rawText);
    const sorted = sortTextByLogic(cleanText);

    const [easy, medium, hard] = await Promise.all([
      generatePdfFromText("CORE CONCEPTS", sorted.easy),
      generatePdfFromText("DETAILED PROCESSES", `${sorted.easy}\n\n${sorted.medium}`),
      generatePdfFromText("FULL THEORETICAL ANALYSIS", `${sorted.easy}\n\n${sorted.medium}\n\n${sorted.hard}`)
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