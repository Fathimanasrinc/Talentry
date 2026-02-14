import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
// Import your illustration image here
// import heroIllustration from '../assets/hero-illustration.png'; 

export default function front() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      {/* Navbar / Header */}
      <header className="landing-header">
        <h1 className="landing-logo">TALENTRY</h1>
        <div className="plus-icon-header">+</div>
      </header>

      {/* Main Content Area */}
      <main className="hero-section">
        <div className="hero-left">
          <h2 className="hero-title">
            Convert Your Lecture Notes into <br />
            Structured Exam Preparation — Easy, <br />
            Medium, Hard.
          </h2>
          <button 
            className="cta-btn" 
            onClick={() => navigate('/upload')}
          >
            Upload your Notes
          </button>
        </div>

        <div className="hero-right">
          {/* Placeholder for the illustration from your Figma file */}
          <div className="illustration-wrapper">
             <img 
               src="https://img.freepik.com/free-vector/learning-concept-illustration_114360-6186.jpg" 
               alt="Studying Illustration" 
               className="hero-image"
             />
          </div>
        </div>
      </main>
    </div>
  );
}