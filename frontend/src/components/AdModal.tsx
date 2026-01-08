import React, { useEffect, useState } from 'react';

interface AdModalProps {
    onClose: () => void;
    onComplete: () => void;
}

const AdModal: React.FC<AdModalProps> = ({ onClose, onComplete }) => {
    const [timeLeft, setTimeLeft] = useState(3);
    const [isCompleted, setIsCompleted] = useState(false);

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setIsCompleted(true);
            setTimeout(() => {
                onComplete();
            }, 1000);
        }
    }, [timeLeft, onComplete]);

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white p-4">
            <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 text-center relative overflow-hidden">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 h-2 bg-blue-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${((3 - timeLeft) / 3) * 100}%` }}></div>

                <div className="mb-8">
                    <div className="text-6xl mb-4 animate-bounce">📺</div>
                    <h2 className="text-2xl font-bold mb-2">
                        {isCompleted ? "보상 지급 완료! 🎉" : "광고를 불러오는 중..."}
                    </h2>
                    <p className="text-gray-400">
                        {isCompleted ? "잠시 후 그림이 생성됩니다." : "선생님 모드를 준비하고 있어요."}
                    </p>
                </div>

                {!isCompleted && (
                    <div className="text-4xl font-bold text-blue-400">
                        {timeLeft}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="mt-8 text-sm text-gray-500 hover:text-white underline"
                >
                    닫기 (보상 포기)
                </button>
            </div>
        </div>
    );
};

export default AdModal;
