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
      {/* [수정] 왼쪽 패널: 캔버스 작업 영역을 넓게 사용 */}
      <div className="flex-1 h-full flex flex-col relative bg-white">

        {/* [아이디어] 상단 대화창을 오버레이로 배치 (캔버스 공간 확보) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xl">
          <div className="bg-white/80 backdrop-blur-md border border-slate-200 p-3 rounded-2xl shadow-sm text-center">
            {isListening ? (
              <span className="text-purple-600 animate-pulse font-medium">🎤 듣고 있어요: {transcript}</span>
            ) : (
              <span className="text-slate-500 text-sm">{transcript || "무엇을 그려볼까요? 선생님에게 말해보세요!"}</span>
            )}
          </div>
        </div>

        {/* 메인 콘텐츠 영역 (캔버스가 전체를 차지) */}
        <div className="flex-1 relative overflow-hidden">
          {showChat ? (
            <div className="w-full h-full flex flex-col bg-slate-50 p-6 pt-24 overflow-y-auto">
              {/* 채팅 내역 출력 */}
              {chatHistory.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <MessageSquare size={48} className="mb-2 opacity-50" />
                  <p>선생님과 대화를 시작해보세요!</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex w-full mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border-2 border-yellow-400'}`}>
                    {msg.role === 'agent' && <span className="block text-xs font-bold text-yellow-600 mb-1">한울 선생님</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          ) : mode === 'draw' ? (
            <div className="w-full h-full pt-16"> {/* 상단 대화창 자리를 위한 패딩 */}
              <Canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
              {/* 그림판 도구는 캔버스 우측 하단에 작게 배치 */}
              <div className="absolute bottom-24 right-6 flex flex-col gap-2">
                <button onClick={() => canvasRef.current?.undo()} className="p-3 bg-white shadow-md hover:bg-slate-100 rounded-full text-slate-700 border border-slate-200">
                  <Undo size={20} />
                </button>
                <button onClick={() => canvasRef.current?.clear()} className="p-3 bg-white shadow-md hover:bg-red-50 rounded-full text-red-500 border border-slate-200">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center pt-16 relative bg-slate-50">
              {/* 카메라 프리뷰 로직 */}
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

        {/* [개선] 하단 Speak & Magic 버튼을 플로팅 형태로 변경 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-30">
          <button
            onClick={toggleListening}
            className={`px-8 py-4 rounded-full font-bold text-xl shadow-2xl transition-all flex items-center gap-3 ${isListening ? 'bg-red-500 text-white scale-110' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {isListening ? <MicOff /> : <Mic />} Speak
          </button>
          <button
            onClick={handleMagic}
            disabled={isLoading}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />} Magic
          </button>
        </div>
      </div>

      {/* 오른쪽 패널: AI 결과 및 모드 컨트롤 */}
      <div className="w-[400px] h-full bg-slate-100 border-l border-slate-200 flex flex-col">
        {/* [수정] 모드 전환 버튼을 이쪽 상단으로 이동 */}
        <div className="bg-white p-3 flex justify-around border-b">
          <button
            onClick={() => { setMode('draw'); setShowChat(false); }}
            className={`p-3 rounded-xl transition-all ${mode === 'draw' && !showChat ? 'bg-blue-100 text-blue-600' : 'text-slate-400'}`}
          >
            <Pencil size={24} /><span className="text-[10px] font-bold block">Draw</span>
          </button>
          <button
            onClick={() => { setMode('camera'); setShowChat(false); }}
            className={`p-3 rounded-xl transition-all ${mode === 'camera' && !showChat ? 'bg-green-100 text-green-600' : 'text-slate-400'}`}
          >
            <Camera size={24} /><span className="text-[10px] font-bold block">Camera</span>
          </button>
          <button
            onClick={() => setShowChat(true)}
            className={`p-3 rounded-xl transition-all ${showChat ? 'bg-yellow-100 text-yellow-600' : 'text-slate-400'}`}
          >
            <MessageSquare size={24} /><span className="text-[10px] font-bold block">Chat</span>
          </button>
        </div>

        {/* AI 생성 결과 영역 */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 bg-white rounded-3xl shadow-lg border-4 border-purple-50 overflow-hidden flex items-center justify-center relative">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-2" />
                <p className="text-purple-600 font-bold">그리는 중...</p>
              </div>
            ) : resultImage ? (
              <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
            ) : (
              <div className="text-slate-300 text-center">
                <Wand2 size={48} className="mx-auto mb-2 opacity-20" />
                <p>결과가 여기에 표시됩니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
