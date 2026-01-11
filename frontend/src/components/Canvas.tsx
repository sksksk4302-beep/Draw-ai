import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

interface CanvasProps {
    className?: string;
}

export interface CanvasHandle {
    clear: () => void;
    undo: () => void;
    getDataUrl: () => string;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Handle resizing to parent
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 5;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height); // White background
            contextRef.current = ctx;
            saveHistory(); // Save initial blank state
        }

        // Handle resize
        const handleResize = () => {
            if (parent && canvas) {
                // Save content
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);

                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;

                // Restore content (scaled or centered? just keep it simple for now)
                const newCtx = canvas.getContext('2d');
                if (newCtx) {
                    newCtx.lineCap = 'round';
                    newCtx.strokeStyle = 'black';
                    newCtx.lineWidth = 5;
                    newCtx.fillStyle = 'white';
                    newCtx.fillRect(0, 0, canvas.width, canvas.height);
                    newCtx.drawImage(tempCanvas, 0, 0);
                    contextRef.current = newCtx;
                }
            }
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const saveHistory = () => {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        if (canvas && ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory(prev => [...prev.slice(-10), imageData]); // Keep last 10
        }
    };

    const startDrawing = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current?.beginPath();
        contextRef.current?.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current?.lineTo(offsetX, offsetY);
        contextRef.current?.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            contextRef.current?.closePath();
            setIsDrawing(false);
            saveHistory();
        }
    };

    const getCoordinates = (event: MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { offsetX: 0, offsetY: 0 };

        if (event instanceof MouseEvent) {
            return { offsetX: event.offsetX, offsetY: event.offsetY };
        } else {
            const rect = canvas.getBoundingClientRect();
            const touch = event.touches[0];
            return {
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            };
        }
    };

    useImperativeHandle(ref, () => ({
        clear: () => {
            const canvas = canvasRef.current;
            const ctx = contextRef.current;
            if (canvas && ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                saveHistory();
            }
        },
        undo: () => {
            if (history.length > 1) {
                const newHistory = [...history];
                newHistory.pop(); // Remove current state
                const prevState = newHistory[newHistory.length - 1];
                setHistory(newHistory);

                const canvas = canvasRef.current;
                const ctx = contextRef.current;
                if (canvas && ctx && prevState) {
                    ctx.putImageData(prevState, 0, 0);
                }
            }
        },
        getDataUrl: () => {
            return canvasRef.current?.toDataURL('image/png') || '';
        }
    }));

    return (
        <canvas
            ref={canvasRef}
            className={`touch-none ${className}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
    );
});

export default Canvas;
