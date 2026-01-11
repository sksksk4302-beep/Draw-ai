import { useState, useRef, useEffect } from 'react'
import Canvas, { type CanvasHandle } from './components/Canvas'
import { Camera, Pencil, Undo, Trash2, Wand2, Image as ImageIcon, Loader2, Mic, MicOff, MessageSquare } from 'lucide-react'
import axios from 'axios'

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

function App() {
  const [mode, setMode] = useState<'draw' | 'camera'>('draw')
  const [showChat, setShowChat] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])

  const [resultImage, setResultImage] = useState<string | null>(null)
  // const [agentMessage, setAgentMessage] = useState<string | null>(null) // Removed unused state
  const [isLoading, setIsLoading] = useState(false)
  const [cameraImage, setCameraImage] = useState<string | null>(null)

  // Voice State
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const transcriptRef = useRef('') // Ref to keep track of transcript without triggering re-renders in useEffect
  const recognitionRef = useRef<any>(null)

  const canvasRef = useRef<CanvasHandle>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom of chat
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, showChat])

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true // Changed to true to allow pauses
      recognition.interimResults = true
      recognition.lang = 'ko-KR' // Korean

      recognition.onresult = (event: any) => {
        // Clear existing silence timer
        if (recognitionRef.current.silenceTimer) {
          clearTimeout(recognitionRef.current.silenceTimer)
        }

        // Set a new silence timer to stop recording after 2.5 seconds of silence
        recognitionRef.current.silenceTimer = setTimeout(() => {
          recognition.stop()
        }, 2500)

        let fullTranscript = ''
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript
        }
        setTranscript(fullTranscript)
        transcriptRef.current = fullTranscript
      }

      recognition.onend = () => {
        setIsListening(false)
        // Clear timer if it exists
        if (recognitionRef.current?.silenceTimer) {
          clearTimeout(recognitionRef.current.silenceTimer)
        }

        // Auto-send when speech ends if there is text
        if (transcriptRef.current.trim()) {
          handleVoiceCommand(transcriptRef.current)
        }
      }

      recognitionRef.current = recognition
    } else {
      console.warn("Web Speech API not supported")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      setTranscript('')
      transcriptRef.current = ''
      // Switch to chat view when speaking starts
      setShowChat(true)
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: Log errors to backend for centralized tracing
  // ---------------------------------------------------------------------------
  const logClientError = async (error: any, info: any = {}) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
      const payload = {
        source: 'frontend',
        message: error.message || String(error),
        stack: error.stack,
        info: info
      }
      // Fire and forget - don't await response to not block UI
      axios.post(`${backendUrl}/log-error`, payload).catch(e => console.error("Failed to ship log:", e))
    } catch (e) {
      console.error("Failed to construct log payload:", e)
    }
  }

  const handleVoiceCommand = async (text: string) => {
    // Add user message to chat immediately
    setChatHistory(prev => [...prev, { role: 'user', text }])

    // We don't set global loading here to avoid blocking UI, maybe just a typing indicator in chat?
    // But for now let's keep it simple.

    try {
      let imageData = ''
      if (mode === 'draw') {
        imageData = canvasRef.current?.getDataUrl() || ''
      } else {
        imageData = cameraImage || ''
      }

      const formData = new FormData()
      formData.append('user_text', text)
      formData.append('session_id', 'user-session-v1')
      formData.append('generate_image', 'false') // Don't generate image yet

      if (imageData && !showChat) {
        // Only send image if we are NOT in chat mode? 
        // Actually user might want to talk about the drawing they just did.
        // So we should send the image if it exists.
        const res = await fetch(imageData)
        const blob = await res.blob()
        if (blob.size > 1000) {
          const file = new File([blob], "input.png", { type: "image/png" })
          formData.append('file', file)
        }
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
      const response = await axios.post(`${backendUrl}/chat-to-draw`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const { agent_message } = response.data

      // Add agent response to chat
      setChatHistory(prev => [...prev, { role: 'agent', text: agent_message }])
      // setAgentMessage(agent_message) // Removed unused state

    } catch (error) {
      console.error("[Chat Error]", error)
      logClientError(error, { context: "handleVoiceCommand", user_text: text })
      setChatHistory(prev => [...prev, { role: 'agent', text: "오류가 발생했어요. 다시 말씀해주시겠어요?" }])
    }
  }

  const handleMagic = async () => {
    // Stop listening if active
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }

    setIsLoading(true)
    try {
      // Trigger generation based on context
      // We send a generic "Draw it" command with generate_image=true
      const formData = new FormData()
      formData.append('user_text', "지금까지 이야기한 내용으로 그림 그려줘")
      formData.append('session_id', 'user-session-v1')
      formData.append('generate_image', 'true')

      // Send chat history for context
      formData.append('chat_history', JSON.stringify(chatHistory))

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
      const response = await axios.post(`${backendUrl}/chat-to-draw`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const { generated_image, agent_message } = response.data

      if (generated_image) {
        setResultImage(generated_image)
      }
      if (agent_message) {
        setChatHistory(prev => [...prev, { role: 'agent', text: agent_message }])
      }

    } catch (error) {
      console.error("[Magic Error]", error)
      logClientError(error, { context: "handleMagic" })
      alert('그림 생성에 실패했습니다.')
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
      {/* Left Panel: Input / Chat */}
      <div className="w-1/2 h-full flex flex-col p-4 border-r border-slate-200 relative">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('draw'); setShowChat(false); }}
            className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${mode === 'draw' && !showChat ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Pencil /> Draw
          </button>
          <button
            onClick={() => { setMode('camera'); setShowChat(false); }}
            className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${mode === 'camera' && !showChat ? 'bg-secondary text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Camera /> Camera
          </button>
          <button
            onClick={() => setShowChat(true)}
            className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${showChat ? 'bg-yellow-400 text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <MessageSquare /> Chat
          </button>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-inner overflow-hidden relative border-4 border-slate-200">
          {showChat ? (
            <div className="w-full h-full flex flex-col bg-slate-50 p-4 overflow-y-auto">
              {chatHistory.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <MessageSquare size={48} className="mb-2 opacity-50" />
                  <p>선생님과 대화를 시작해보세요!</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex w-full mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-lg ${msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-tr-none'
                    : 'bg-white border-2 border-yellow-400 text-slate-800 rounded-tl-none shadow-sm'
                    }`}>
                    {msg.role === 'agent' && <span className="block text-xs font-bold text-yellow-600 mb-1">한울 선생님</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          ) : mode === 'draw' ? (
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
              onClick={handleMagic}
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
        {/* Agent Message Bubble (Optional now, since we have chat history) */}
        {/* We can keep it as the "Latest" message or remove it. User asked for chat history in left panel. */}
        {/* Let's keep it but maybe simplify or remove if redundant. User said "Right panel... until Magic button is pressed... conversation... shown". */}
        {/* Actually user said "Left panel becomes text window". So Right Panel is for RESULT. */}

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
              <p className="text-xl font-medium">Magic 버튼을 누르면<br />여기에 그림이 나타나요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
