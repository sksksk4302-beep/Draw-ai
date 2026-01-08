import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import GalleryPage from './pages/GalleryPage';
import CanvasPage from './pages/CanvasPage';
// import PhotoUploadPage from './pages/PhotoUploadPage'; // Placeholder
import ChatModePage from './pages/ChatModePage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-blue-50 font-sans text-gray-800">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/draw" element={<CanvasPage />} />
          <Route path="/chat" element={<ChatModePage />} />
          {/* <Route path="/upload" element={<PhotoUploadPage />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
