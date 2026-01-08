import React from 'react';

interface LoadingOverlayProps {
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "로딩 중..." }) => {
    return (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm text-white">
            <div className="w-32 h-32 mb-8 relative">
                {/* Simple CSS Animation for now */}
                <div className="absolute inset-0 border-8 border-white/20 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-t-yellow-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">
                    🎨
                </div>
            </div>
            <h2 className="text-2xl font-bold animate-pulse">{message}</h2>
        </div>
    );
};

export default LoadingOverlay;
