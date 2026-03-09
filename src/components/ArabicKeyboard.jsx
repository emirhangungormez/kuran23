import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ArabicKeyboard.css';

const LAYOUTS = {
    default: [
        ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
        ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ذ'],
        ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ']
    ],
    numeric: [
        ['١', '٢', '٣', '٤'],
        ['٥', '٦', '٧'],
        ['٨', '٩', '٠']
    ]
};

export default function ArabicKeyboard({ onKeyClick, onBackspace, onClose }) {
    const getInitialPosition = () => {
        const kbWidth = 480;
        const kbHeight = 320;
        return {
            x: Math.max(20, (window.innerWidth - kbWidth) / 2),
            y: Math.max(20, (window.innerHeight - kbHeight) / 2)
        };
    };

    const [view, setView] = useState('default');
    const [position, setPosition] = useState(getInitialPosition);
    const kbRef = useRef(null);
    const draggingRef = useRef(false);
    const offsetRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.closest('.kb-key') || e.target.closest('.kb-close-btn')) return;

        draggingRef.current = true;
        offsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        const handleMouseMove = (moveEvent) => {
            if (!draggingRef.current) return;

            let newX = moveEvent.clientX - offsetRef.current.x;
            let newY = moveEvent.clientY - offsetRef.current.y;

            const kbWidth = kbRef.current?.offsetWidth || 480;
            const kbHeight = kbRef.current?.offsetHeight || 320;

            newX = Math.max(0, Math.min(newX, window.innerWidth - kbWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - kbHeight));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            draggingRef.current = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return createPortal(
        <div
            ref={kbRef}
            className="flat-keyboard-wrapper"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="kb-flat-header">
                <div className="kb-title">Arapça Klavye</div>
                <button type="button" className="kb-close-btn" onClick={onClose} title="Kapat" aria-label="Kapat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="kb-flat-body">
                <div className="kb-grid">
                    {LAYOUTS[view].map((row, rowIndex) => (
                        <div key={rowIndex} className="kb-row">
                            {row.map((key, keyIndex) => (
                                <button
                                    key={keyIndex}
                                    type="button"
                                    className="kb-key"
                                    onClick={() => onKeyClick(key)}
                                    aria-label={`Arapça karakter ${key}`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    ))}

                    <div className="kb-row kb-bottom-row">
                        <button
                            type="button"
                            className="kb-key util-key"
                            onClick={() => setView(view === 'default' ? 'numeric' : 'default')}
                            aria-label={view === 'default' ? 'Sayı görünümüne geç' : 'Harf görünümüne geç'}
                        >
                            {view === 'default' ? '١٢٣' : 'أبج'}
                        </button>
                        <button type="button" className="kb-key space-key" onClick={() => onKeyClick(' ')} aria-label="Boşluk">
                            boşluk
                        </button>
                        <button type="button" className="kb-key util-key backspace-btn" onClick={onBackspace} aria-label="Sil">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                <line x1="18" y1="9" x2="12" y2="15" />
                                <line x1="12" y1="9" x2="18" y2="15" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
