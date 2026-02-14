import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./UploadPage.css";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const inputRef = useRef();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleAnalyse = async (file) => {
    if (!file) return alert("Please select a file first!");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:5000/api/uploads", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      navigate("/result", { state: { pdfData: data } }); 
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to analyze notes.");
    }
  };

  return (
    <div className="upload-container">
      <div
        className="upload-box"
        onClick={() => inputRef.current.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input type="file" ref={inputRef} onChange={handleFileChange} hidden />
        <div className="upload-content">
          <span className="plus">+</span>
          <p>{file ? file.name : "Upload your notes here"}</p>
        </div>
      </div>

      <button className="analyse-btn" onClick={() => handleAnalyse(file)}>
        Analyse
      </button>
    </div>
  );
}