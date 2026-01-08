import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eraser, Undo, Download, Share2 } from 'lucide-react';
import { ArrowLeft, Eraser, Undo, Download, Share2 } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import AdModal from '../components/AdModal';
import ShopModal from '../components/ShopModal';

const CanvasPage = () => {
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [showOptions, setShowOptions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);

    // New States for Hybrid Model
    const [showAd, setShowAd] = useState(false);
    const [showShop, setShowShop] = useState(false);
    const [userPotions, setUserPotions] = useState(0); // TODO: Fetch from context/API
    const [isGuest, setIsGuest] = useState(true); // TODO: Check auth state

    // Mock Auth Check (Replace with actual auth)
    useEffect(() => {
        const checkAuth = async () => {
            // Simulate Guest for now, or check localStorage/Context
            // setIsGuest(true); 
        };
        checkAuth();
    }, []);

    // Drawing Logic
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.lineTo(offsetX, offsetY);
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        if ('touches' in e) {
            const rect = canvas.getBoundingClientRect();
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        } else {
            return {
                offsetX: (e as React.MouseEvent).nativeEvent.offsetX,
                offsetY: (e as React.MouseEvent).nativeEvent.offsetY
            };
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleGenerateClick = (type: 'cheap' | 'premium') => {
        if (type === 'cheap') {
            // Guest: Free 1 time check (localStorage)
            handleGenerate('cheap');
        } else {
            // Premium Logic
            if (isGuest) {
                // Guest must watch Ad
                setShowOptions(false);
                setShowAd(true);
            } else {
                // User: Check Potions
                if (userPotions > 0) {
                    handleGenerate('premium');
                } else {
                    setShowOptions(false);
                    setShowShop(true);
                }
            }
        }
    };

    const handleAdComplete = () => {
        setShowAd(false);
        handleGenerate('premium');
    };

    const handleGenerate = async (type: 'cheap' | 'premium') => {
        setShowOptions(false);
        setLoading(true);

        try {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Convert canvas to blob
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return;

            const formData = new FormData();
            formData.append('file', blob, 'drawing.png');
            formData.append('user_text', 'Make this drawing look amazing');
            formData.append('generate_image', 'true');
            formData.append('style_type', type);
            formData.append('uid', isGuest ? 'anonymous' : 'user_uid_placeholder'); // TODO: Real UID

            const response = await fetch('http://localhost:8000/chat-to-draw', {
                method: 'POST',
                body: formData,
            });

            if (response.status === 402) {
                alert("물약이 부족해요!");
                setLoading(false);
                setShowShop(true);
                return;
            }

            const data = await response.json();
            if (data.generated_image) {
                setResultImage(data.generated_image);
            }
        } catch (error) {
            console.error("Generation failed", error);
            alert("변환에 실패했어요 😢");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!resultImage) return;
        try {
            const response = await fetch(resultImage);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `magic_sketch_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    if (resultImage) {
        return (
            <div className="min-h-screen bg-blue-50 p-6 flex flex-col items-center justify-center">
                <div className="bg-white p-4 rounded-3xl shadow-2xl max-w-2xl w-full">
                    <img src={resultImage} alt="Result" className="w-full rounded-2xl mb-6" />
                    <div className="flex gap-4">
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-blue-400 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-500 flex items-center justify-center gap-2"
                        >
                            <Download /> 태블릿에 저장
                        </button>
                        <button className="flex-1 bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl hover:bg-gray-200 flex items-center justify-center gap-2">
                            <Share2 /> 공유하기
                        </button>
                    </div>
                    <button
                        onClick={() => setResultImage(null)}
                        className="w-full mt-4 text-gray-400 font-bold py-2 hover:text-gray-600"
                    >
                        다시 그리기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Header */}
            <header className="p-4 flex justify-between items-center border-b border-gray-100">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">마법 캔버스 🎨</h1>
                <button
                    onClick={() => setShowOptions(true)}
                    className="bg-blue-400 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-500 active:scale-95 transition-all"
                >
                    변환하기 ✨
                </button>
            </header>

            {/* Canvas Area */}
            <div className="flex-1 relative bg-gray-50 touch-none overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={window.innerWidth}
                    height={window.innerHeight - 160}
                    className="bg-white shadow-inner mx-auto my-4 rounded-xl cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-white border-t border-gray-100 flex justify-between items-center gap-4 overflow-x-auto">
                <div className="flex gap-2">
                    {['#000000', '#FF0000', '#FFD700', '#008000', '#0000FF', '#800080'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-10 h-10 rounded-full border-4 transition-transform ${color === c ? 'border-gray-300 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <div className="flex gap-4 border-l pl-4 border-gray-200">
                    <button onClick={clearCanvas} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600">
                        <Eraser size={24} />
                    </button>
                </div>
            </div>

            {/* Options Modal */}
            {showOptions && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md animate-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold text-center mb-6">어떻게 변환할까요?</h2>

                        <button
                            onClick={() => handleGenerate('cheap')}
                            className="w-full mb-4 bg-gray-100 p-4 rounded-2xl flex items-center gap-4 hover:bg-gray-200 transition-colors text-left group"
                        >
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">🎬</div>
                            <div>
                                <div className="font-bold text-gray-800">연습장 모드</div>
                                <div className="text-xs text-gray-500">로그인 없이 무료 (저화질)</div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleGenerateClick('premium')}
                            className="w-full mb-6 bg-blue-50 border-2 border-blue-400 p-4 rounded-2xl flex items-center gap-4 hover:bg-blue-100 transition-colors text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 bg-blue-400 text-white text-xs px-2 py-1 rounded-bl-lg font-bold">추천</div>
                            <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center text-2xl shadow-sm text-white">💊</div>
                            <div>
                                <div className="font-bold text-blue-900">선생님 모드</div>
                                <div className="text-xs text-blue-600">
                                    {isGuest ? "광고 보고 무료 생성" : `물약 1개 사용 (보유: ${userPotions})`}
                                </div>
                            </div>
                        </button>

                        <button onClick={() => setShowOptions(false)} className="w-full py-3 text-gray-400 font-bold hover:text-gray-600">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {loading && <LoadingOverlay message="한울 선생님이 꼼꼼하게 색칠하고 있어요...🎨" />}
            {showAd && <AdModal onClose={() => setShowAd(false)} onComplete={handleAdComplete} />}
            {showShop && <ShopModal onClose={() => setShowShop(false)} />}
        </div>
    );
};

export default CanvasPage;
