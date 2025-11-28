import { useState, useRef } from 'react'
import Canvas, { type CanvasHandle } from './components/Canvas'
import { Camera, Pencil, Undo, Trash2, Wand2, Image as ImageIcon, Loader2 } from 'lucide-react'
import axios from 'axios'

function App() {
  const [mode, setMode] = useState<'draw' | 'camera'>('draw')
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cameraImage, setCameraImage] = useState<string | null>(null)
  const canvasRef = useRef<CanvasHandle>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      let imageData = ''
      if (mode === 'draw') {
        imageData = canvasRef.current?.getDataUrl() || ''
      } else {
        imageData = cameraImage || ''
      }

      if (!imageData) {
        alert('Please draw something or upload an image!')
        setIsLoading(false)
        return
      }

      // Convert base64 to blob
      const res = await fetch(imageData)
      const blob = await res.blob()
      const file = new File([blob], "input.png", { type: "image/png" })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('style_prompt', '3D render') // Default or selectable

      // Use env var for backend URL
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
      const response = await axios.post(`${backendUrl}/generate-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setResultImage(response.data.image)
    } catch (error) {
      console.error(error)
      alert('Failed to generate magic! Make sure the backend is running.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCameraImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Left Panel: Input */}
      <div className="w-1/2 h-full flex flex-col p-4 border-r border-slate-200">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('draw')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Pencil /> Draw
          </button>
          <button
            onClick={() => setMode('camera')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${mode === 'camera' ? 'bg-secondary text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Camera /> Camera
          </button>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-inner overflow-hidden relative border-4 border-slate-200">
          {mode === 'draw' ? (
            <>
              <Canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/90 p-2 rounded-full shadow-lg backdrop-blur-sm">
                <button onClick={() => canvasRef.current?.undo()} className="p-3 hover:bg-slate-100 rounded-full text-slate-700" title="Undo">
                  <Undo />
                </button>
                <button onClick={() => canvasRef.current?.clear()} className="p-3 hover:bg-red-50 rounded-full text-red-500" title="Clear">
                  <Trash2 />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
              {cameraImage ? (
                <img src={cameraImage} alt="Preview" className="max-h-full object-contain rounded-lg" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <ImageIcon size={64} className="mb-2" />
                  <p>Take a photo or upload</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="mt-4 w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-black text-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              AI Teacher is drawing...
            </>
          ) : (
            <>
              <Wand2 className="w-8 h-8" />
              MAKE MAGIC!
            </>
          )}
        </button>
      </div>

      {/* Right Panel: Result */}
      <div className="w-1/2 h-full p-4 bg-slate-100 flex flex-col">
        <div className="flex-1 bg-white rounded-2xl shadow-lg border-4 border-purple-100 overflow-hidden flex items-center justify-center relative">
          {resultImage ? (
            <img src={resultImage} alt="Magic Result" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-slate-400 p-8">
              <div className="w-32 h-32 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Wand2 size={48} className="text-slate-300" />
              </div>
              <p className="text-xl font-medium">Your magic drawing will appear here!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
