import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './DifficultySelection.css';

const ResultDisplay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get the data passed from the UploadPage via navigation state
  const pdfData = location.state?.pdfData;

  const openPdf = (base64String) => {
    if (!base64String) {
      alert("PDF content not available for this difficulty.");
      return;
    }
    
    try {
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL);
    } catch (e) {
      console.error("Error opening PDF:", e);
      alert("Invalid PDF data.");
    }
  };

  // Fallback if user navigates here without data
  if (!pdfData) {
    return (
      <div className="container">
        <div className="mainContent">
          <h2>No data found.</h2>
          <button className="backBtn" onClick={() => navigate("/")}>Go to Upload</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo">TALENTRY</h1>
      </header>

      <main className="mainContent">
        <div className="buttonGroup">
          <button 
            className="resultBtn" 
            onClick={() => openPdf(pdfData.easy)}
          >
            EASY
          </button>
          <button 
            className="resultBtn" 
            onClick={() => openPdf(pdfData.medium)}
          >
            MEDIUM
          </button>
          <button 
            className="resultBtn" 
            onClick={() => openPdf(pdfData.hard)}
          >
            HARD
          </button>
        </div>

        <div className="backContainer">
          <button className="backBtn" onClick={() => navigate("/")}>
            BACK
          </button>
        </div>
      </main>
    </div>
  );
};

export default ResultDisplay;