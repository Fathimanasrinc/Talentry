import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/front";
import UploadPage from "./components/UploadPage";
import ResultDisplay from "./components/ResultDisplay";

function App() {
  return (
    <Router>
      <Routes>
        {/* The new front page you requested */}
        <Route path="/" element={<LandingPage />} />
        
        {/* The upload functionality */}
        <Route path="/upload" element={<UploadPage />} />
        
        {/* The results screen with Easy, Medium, Hard options */}
        <Route path="/result" element={<ResultDisplay />} />
      </Routes>
    </Router>
  );
}

export default App;