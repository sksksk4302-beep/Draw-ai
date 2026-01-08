import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Send, Image as ImageIcon, X } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    image?: string;
}

const ChatModePage = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', text: '안녕! 나는 한울 선생님이야. 오늘 무슨 그림을 그려볼까?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'ko-KR';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                handleSendMessage(transcript);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleTouchStart = () => {
        if (recognitionRef.current) {
            recognitionRef.current.start();
        } else {
            alert("이 브라우저는 음성 인식을 지원하지 않아요 😢");
        }
    };

    const handleTouchEnd = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text };
        setMessages(prev => [...prev, newUserMsg]);
        setInputText('');
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('user_text', text);
            formData.append('session_id', 'mobile-session-' + Date.now()); // Simple session ID
            formData.append('generate_image', 'true');
            formData.append('chat_history', JSON.stringify(messages)); // Send history context

            const response = await fetch('http://localhost:8000/chat-to-draw', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            const newAgentMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.agent_message || "음... 다시 말해줄래?"
            };
            setMessages(prev => [...prev, newAgentMsg]);

            if (data.generated_image) {
                setGeneratedImage(data.generated_image);
            }

        } catch (error) {
            console.error("Chat error", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "오류가 발생했어. 다시 시도해볼까?" }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-blue-50">
            {/* Header */}
            <header className="bg-white p-4 flex items-center shadow-sm z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full mr-2">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg text-gray-800">한울 선생님 🤖</h1>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-yellow-400 text-gray-900 rounded-tr-none'
                                : 'bg-white text-gray-800 shadow-sm rounded-tl-none'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-4 border-t border-gray-100 pb-8">
                <div className="flex flex-col items-center gap-4">
                    {/* Voice Button */}
                    <button
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleTouchStart} // For desktop testing
                        onMouseUp={handleTouchEnd}     // For desktop testing
                        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${isListening ? 'bg-red-500 scale-110 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                    >
                        <Mic size={32} className="text-white" />
                    </button>
                    <p className="text-gray-400 text-sm">
                        {isListening ? "듣고 있어요..." : "버튼을 누르고 말해보세요!"}
                    </p>

                    {/* Text Input Fallback */}
                    <div className="w-full flex gap-2 mt-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                            placeholder="직접 입력할 수도 있어요"
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                            onClick={() => handleSendMessage(inputText)}
                            className="bg-gray-200 p-2 rounded-full text-gray-600 hover:bg-blue-400 hover:text-white transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Result Modal */}
            {generatedImage && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-2 w-full max-w-md relative animate-in zoom-in duration-300">
                        <button
                            onClick={() => setGeneratedImage(null)}
                            className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg text-gray-500 hover:text-red-500"
                        >
                            <X size={24} />
                        </button>
                        <img src={generatedImage} alt="Generated" className="w-full rounded-2xl" />
                        <div className="p-4 text-center">
                            <h3 className="font-bold text-xl mb-2">짜잔! 그림이 완성됐어요 ✨</h3>
                            <button
                                onClick={() => navigate('/gallery')}
                                className="bg-yellow-400 text-white font-bold px-6 py-3 rounded-full shadow-md hover:bg-yellow-500"
                            >
                                갤러리에서 보기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && <LoadingOverlay message="한울 선생님이 생각하고 있어요...🤔" />}
        </div>
    );
};

export default ChatModePage;
