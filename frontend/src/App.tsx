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
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'ko-KR' // Korean

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript
        }
        setTranscript(interimTranscript)
        transcriptRef.current = interimTranscript
      }

      recognition.onend = () => {
        setIsListening(false)
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

  const handleVoiceCommand = async (text: string) => {
    // Add user message to chat immediately
    setChatHistory(prev => [...prev, { role: 'user', text }])

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

    } catch (error) {
      console.error(error)
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
      const formData = new FormData()
      formData.append('user_text', "지금까지 이야기한 내용으로 그림 그려줘")
      formData.append('session_id', 'user-session-v1')
      formData.append('generate_image', 'true')
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
      console.error(error)
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
      {/* 왼쪽 패널: 캔버스/카메라 작업 영역 (1:1 비율) */}
      <div className="w-1/2 h-full flex flex-col relative bg-white p-4 border-r border-slate-200">

        {/* 우측 상단 모드 전환 아이콘 */}
        <div className="absolute top-4 right-4 z-20 flex gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-slate-200">
          <button
            onClick={() => { setMode('draw'); setShowChat(false); }}
            className={`p-2 rounded-lg transition-all ${mode === 'draw' && !showChat ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Draw"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => { setMode('camera'); setShowChat(false); }}
            className={`p-2 rounded-lg transition-all ${mode === 'camera' && !showChat ? 'bg-green-100 text-green-600' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Camera"
          >
            <Camera size={20} />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition-all ${showChat ? 'bg-yellow-100 text-yellow-600' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 bg-white rounded-2xl shadow-inner overflow-hidden relative border-4 border-slate-200">
          {mode === 'draw' ? (
            <>
              <Canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
              {/* 그림판 도구 */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button onClick={() => canvasRef.current?.undo()} className="p-3 bg-white shadow-md hover:bg-slate-100 rounded-full text-slate-700 border border-slate-200">
                  <Undo size={20} />
                </button>
                <button onClick={() => canvasRef.current?.clear()} className="p-3 bg-white shadow-md hover:bg-red-50 rounded-full text-red-500 border border-slate-200">
                  <Trash2 size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative bg-slate-50">
              {cameraImage ? (
                <img src={cameraImage} alt="Preview" className="max-h-full object-contain rounded-lg" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <ImageIcon size={64} className="mb-2" />
                  <p>사진을 찍거나 업로드하세요</p>
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

        {/* Chat 영역 - Chat 버튼 클릭 시에만 표시 (Speak 위에 배치) */}
        {showChat && (
          <div className="mt-4 mb-2 bg-slate-50 rounded-2xl shadow-inner border-2 border-slate-200 overflow-hidden" style={{ height: '200px' }}>
            <div className="w-full h-full flex flex-col p-4 overflow-y-auto">
              {chatHistory.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <MessageSquare size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">선생님과 대화를 시작해보세요!</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex w-full mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border-2 border-yellow-400'}`}>
                    {msg.role === 'agent' && <span className="block text-xs font-bold text-yellow-600 mb-1">한울 선생님</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Voice Interaction Area - Speak & Magic 버튼 */}
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="min-h-[3rem] w-full flex items-center justify-center text-center p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            {isListening ? (
              <span className="text-purple-600 animate-pulse font-medium">🎤 듣고 있어요: {transcript}</span>
            ) : (
              <span className="text-slate-400">{transcript || "마이크를 누르고 말해보세요!"}</span>
            )}
          </div>

          <div className="flex w-full gap-2">
            <button
              onClick={toggleListening}
              className={`flex-1 py-4 rounded-2xl font-black text-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'}`}
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

      {/* 오른쪽 패널: AI 결과 (1:1 비율 유지) */}
      <div className="w-1/2 h-full p-4 bg-slate-100 flex flex-col gap-4">
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
