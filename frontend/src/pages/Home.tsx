import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Camera, Bot, Image as ImageIcon, Mic } from 'lucide-react';
import ShopModal from '../components/ShopModal';

// Simple hook to check for mobile device
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

const Home = () => {
    const navigate = useNavigate();
    const [isShopOpen, setIsShopOpen] = useState(false);
    const isMobile = useIsMobile();
    const userName = "지수"; // Mock user name
    const potionCount = 5; // Mock potion count

    const handleDrawClick = () => {
        if (isMobile) {
            alert("태블릿에서 그려봐요! 📱✍️");
            return;
        }
        navigate('/draw');
    };

    return (
        <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
            {/* Header */}
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold text-gray-800">
                    안녕, {userName}! 👋
                </h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsShopOpen(true)}
                        className="bg-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-2xl">💊</span>
                        <span className="font-bold text-blue-500">{potionCount}개</span>
                    </button>
                    <button
                        onClick={() => navigate('/gallery')}
                        className="bg-yellow-400 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-yellow-500 transition-colors flex items-center gap-2"
                    >
                        <ImageIcon size={24} />
                        내 갤러리
                    </button>
                </div>
            </header>

            {/* Main Content - 3 Big Cards */}
            <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Draw Card */}
                <button
                    onClick={handleDrawClick}
                    className={`group h-96 bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 border-4 border-transparent 
                        ${isMobile ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:-translate-y-2 hover:border-blue-200'}`}
                >
                    <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Palette size={64} className="text-blue-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">직접 그리기</h2>
                    <p className="text-gray-500 text-lg">
                        {isMobile ? "태블릿 전용이에요" : "내가 그린 그림이 살아나요!"}
                    </p>
                </button>

                {/* Photo Card */}
                <button
                    onClick={() => navigate('/upload')}
                    className="group h-96 bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center gap-6 hover:-translate-y-2 transition-all duration-300 border-4 border-transparent hover:border-green-200"
                >
                    <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera size={64} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">사진 찍기</h2>
                    <p className="text-gray-500 text-lg">찰칵! 사진을 찍어보세요.</p>
                </button>

                {/* Chat Card */}
                <button
                    onClick={() => navigate('/chat')}
                    className={`group h-96 bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 border-4 border-transparent 
                        ${isMobile ? 'border-yellow-400 ring-4 ring-yellow-200 animate-pulse-slow' : 'hover:-translate-y-2 hover:border-purple-200'}`}
                >
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${isMobile ? 'bg-yellow-100' : 'bg-purple-100'}`}>
                        {isMobile ? (
                            <Mic size={64} className="text-yellow-600 animate-bounce" />
                        ) : (
                            <Bot size={64} className="text-purple-500" />
                        )}
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">
                        {isMobile ? "선생님이랑 말하기" : "AI랑 대화하기"}
                    </h2>
                    <p className="text-gray-500 text-lg">
                        {isMobile ? "말로 그림을 그려줘요!" : "로봇 친구와 이야기해요."}
                    </p>
                </button>
            </main>

            {/* Shop Modal */}
            {isShopOpen && <ShopModal onClose={() => setIsShopOpen(false)} />}
        </div>
    );
};

export default Home;
