import { useState, useRef, useEffect } from 'react'
import Canvas, { type CanvasHandle } from './components/Canvas'
import { Camera, Pencil, Undo, Trash2, Wand2, Image as ImageIcon, Loader2, Mic, MicOff } from 'lucide-react'
import axios from 'axios'

function App() {
  const [mode, setMode] = useState<'draw' | 'camera'>('draw')
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [agentMessage, setAgentMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cameraImage, setCameraImage] = useState<string | null>(null)

  // Voice State
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const canvasRef = useRef<CanvasHandle>(null)

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'ko-KR' // Korean

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript
        }
        setTranscript(interimTranscript)
      }

      recognition.onend = () => {
        setIsListening(false)
        // Auto-send when speech ends if there is text
        if (transcript.trim()) {
          handleVoiceCommand(transcript)
        }
      }

      recognitionRef.current = recognition
    } else {
      console.warn("Web Speech API not supported")
    }
  }, [transcript]) // Depend on transcript to capture latest state in onend if needed (though ref is better)

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      setTranscript('')
      setAgentMessage(null)
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  const handleVoiceCommand = async (text: string) => {
    setIsLoading(true)
    try {
      let imageData = ''
      if (mode === 'draw') {
        imageData = canvasRef.current?.getDataUrl() || ''
      } else {
        imageData = cameraImage || ''
      }

      const formData = new FormData()
      formData.append('user_text', text)
      formData.append('session_id', 'user-session-' + Date.now()) // Simple session ID

      if (imageData) {
        // Convert base64 to blob
        const res = await fetch(imageData)
        const blob = await res.blob()
        // Only append if it's a valid image (not empty canvas check might be needed in backend too)
        if (blob.size > 1000) {
          const file = new File([blob], "input.png", { type: "image/png" })
          formData.append('file', file)
        }
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
      const response = await axios.post(`${backendUrl}/chat-to-draw`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const { agent_message, generated_image } = response.data

      setAgentMessage(agent_message)
      if (generated_image) {
        setResultImage(generated_image)
      }

    } catch (error) {
      console.error(error)
      alert('에러가 발생했습니다. 백엔드를 확인해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateLegacy = async () => {
    // Fallback to manual button click (treat as "draw this")
    handleVoiceCommand("이 그림 그려줘")
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
      <div className="w-1/2 h-full flex flex-col p-4 border-r border-slate-200 relative">
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

        {/* Voice Interaction Area */}
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="min-h-[3rem] w-full flex items-center justify-center text-center p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            {isListening ? (
              <span className="text-purple-600 animate-pulse font-medium">듣고 있어요... {transcript}</span>
            ) : (
              <span className="text-slate-400">{transcript || "마이크를 누르고 말해보세요!"}</span>
            )}
          </div>

          <div className="flex w-full gap-2">
            <button
              onClick={toggleListening}
              className={`flex-1 py-4 rounded-2xl font-black text-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                }`}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              {isListening ? "Stop" : "Speak"}
            </button>

            <button
              onClick={handleGenerateLegacy}
              disabled={isLoading}
              className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-black text-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Wand2 className="w-8 h-8" />
              )}
              Magic
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Result */}
      <div className="w-1/2 h-full p-4 bg-slate-100 flex flex-col gap-4">
        {/* Agent Message Bubble */}
        <div className="bg-white p-6 rounded-2xl shadow-md border-l-8 border-yellow-400 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
            🎨
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 mb-1">미술 선생님 한울</h3>
            <p className="text-slate-600 text-lg leading-relaxed">
              {agentMessage || "안녕! 나는 한울이야. 같이 그림 그릴까?"}
            </p>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-lg border-4 border-purple-100 overflow-hidden flex items-center justify-center relative">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
              <p className="text-xl font-bold text-purple-600 animate-pulse">그림을 그리는 중이에요...</p>
            </div>
          ) : resultImage ? (
            <img src={resultImage} alt="Magic Result" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-slate-400 p-8">
              <div className="w-32 h-32 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Wand2 size={48} className="text-slate-300" />
              </div>
              <p className="text-xl font-medium">여기에 그림이 나타나요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
