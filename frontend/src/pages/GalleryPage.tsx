import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, X } from 'lucide-react';

interface GalleryItem {
    id: string;
    image_url: string;
    prompt: string;
    created_at: string;
}

const GalleryPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGallery();
    }, []);

    const fetchGallery = async () => {
        try {
            // Mock UID for now
            const uid = "anonymous";
            const response = await fetch(`http://localhost:8000/api/gallery?uid=${uid}`);
            if (response.ok) {
                const data = await response.json();
                setItems(data);
            }
        } catch (error) {
            console.error("Failed to fetch gallery:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string) => {
        try {
            const response = await fetch(url);
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
            alert("다운로드에 실패했어요 😢");
        }
    };

    return (
        <div className="min-h-screen p-6 max-w-6xl mx-auto">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/')}
                    className="bg-white p-3 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">내 작품집 🖼️</h1>
            </header>

            {/* Grid */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">로딩 중...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <p className="text-xl mb-4">아직 작품이 없어요!</p>
                    <button
                        onClick={() => navigate('/draw')}
                        className="bg-blue-400 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-blue-500"
                    >
                        그림 그리러 가기
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="bg-white p-3 pb-12 rounded-sm shadow-lg rotate-1 hover:rotate-0 hover:scale-105 transition-all duration-300 cursor-pointer relative"
                            style={{ transform: `rotate(${Math.random() * 4 - 2}deg)` }}
                        >
                            <div className="aspect-square bg-gray-100 overflow-hidden mb-2">
                                <img src={item.image_url} alt="Gallery Item" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-gray-400 text-xs truncate text-center font-handwriting">
                                {new Date(item.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 bg-black flex items-center justify-center p-4">
                            <img src={selectedItem.image_url} alt="Detail" className="max-w-full max-h-[70vh] object-contain" />
                        </div>
                        <div className="w-full md:w-80 p-6 flex flex-col bg-white">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-gray-800">작품 정보</h3>
                                <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto mb-6">
                                <p className="text-gray-600 text-sm bg-gray-50 p-4 rounded-xl">
                                    "{selectedItem.prompt}"
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleDownload(selectedItem.image_url)}
                                    className="w-full bg-blue-400 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-500 flex items-center justify-center gap-2"
                                >
                                    <Download size={20} />
                                    저장하기
                                </button>
                                <button className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2">
                                    <Share2 size={20} />
                                    공유하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryPage;
