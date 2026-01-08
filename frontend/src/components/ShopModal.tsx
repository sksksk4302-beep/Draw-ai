import React from 'react';
import { X } from 'lucide-react';

interface ShopModalProps {
    onClose: () => void;
}

const ShopModal: React.FC<ShopModalProps> = ({ onClose }) => {
    const handlePurchase = (item: string, price: number) => {
        console.log(`Purchasing ${item} for ${price}`);
        // TODO: PortOne SDK integration
        alert(`${item} 구매 기능이 곧 준비됩니다!`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-blue-400 p-6 flex justify-between items-center text-white">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span>💊</span> 물약 상점
                    </h2>
                    <button onClick={onClose} className="hover:bg-blue-500 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Item 1 */}
                    <div className="border-2 border-gray-100 rounded-3xl p-6 hover:border-blue-200 transition-colors relative group">
                        <div className="text-center mb-4">
                            <div className="text-6xl mb-2">🐣</div>
                            <h3 className="text-xl font-bold text-gray-800">병아리 팩</h3>
                            <p className="text-gray-500">물약 20개</p>
                        </div>
                        <button
                            onClick={() => handlePurchase('병아리 팩', 1200)}
                            className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl group-hover:bg-blue-400 group-hover:text-white transition-colors"
                        >
                            1,200원
                        </button>
                    </div>

                    {/* Item 2 (Best) */}
                    <div className="border-2 border-yellow-400 rounded-3xl p-6 bg-yellow-50 relative group">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                            BEST
                        </div>
                        <div className="text-center mb-4">
                            <div className="text-6xl mb-2">👑</div>
                            <h3 className="text-xl font-bold text-gray-800">실속 팩</h3>
                            <p className="text-gray-500">물약 110개</p>
                        </div>
                        <button
                            onClick={() => handlePurchase('실속 팩', 5900)}
                            className="w-full bg-yellow-400 text-white font-bold py-3 rounded-xl shadow-md hover:bg-yellow-500 transition-colors"
                        >
                            5,900원
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 text-center text-sm text-gray-400">
                    부모님의 동의 하에 결제해 주세요.
                </div>
            </div>
        </div>
    );
};

export default ShopModal;
