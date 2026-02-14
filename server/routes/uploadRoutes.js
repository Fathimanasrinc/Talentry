const express = require("express");
const multer = require("multer");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;

    // Dynamic import of ES module
    const { processPdfAndGenerateNotes } = await import("../processPdfAndGenerateNotes.mjs");

    // Call AI + PDF processing function
    const notesPdfs = await processPdfAndGenerateNotes(fileBuffer);

    // Send PDFs as base64 strings (frontend can convert to downloadable files)
    res.send({
      message: "PDF processed and notes generated!",
      easy: notesPdfs.easy.toString("base64"),
      medium: notesPdfs.medium.toString("base64"),
      hard: notesPdfs.hard.toString("base64"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing PDF");
  }
});

module.exports = router;
