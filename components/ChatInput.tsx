'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Mic, Plus, CircleStop, Image as ImageIcon } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    isStreaming: boolean;
    user?: { email: string; name: string; tag?: string | null } | null;
}

export default function ChatInput({ onSend, isStreaming, user }: ChatInputProps) {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        if (!input.trim() || isStreaming) return;
        onSend(input.trim());
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = '56px';
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const adjustHeight = () => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto'; // Reset height to calculate correctly
            const newHeight = Math.max(56, ta.scrollHeight);
            ta.style.height = `${Math.min(newHeight, 300)}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [input]);

    return (
        <div className="w-full relative px-2 max-w-[840px] mx-auto">
            <div className={`
        flex flex-col w-full bg-[#1e1f20] rounded-[28px] overflow-hidden border border-transparent
        focus-within:bg-[#202124] focus-within:border-white/10 transition-all duration-300 shadow-2xl
      `}>
                {/* Entry Field */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                        placeholder="Ketik pesan untuk BaknusAI..."
                        className="
              w-full bg-transparent border-none outline-none resize-none 
              pt-[18px] pb-[18px] pl-7 pr-16 text-[16px] leading-relaxed text-[#e3e3e3] 
              placeholder-[#7c7c7c] max-h-[300px] scrollbar-none font-medium
            "
                        style={{ height: '56px' }}
                    />
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center justify-between px-5 pb-4">
                    <div className="flex items-center gap-2">
                        {/* Gemini-style Extension / Mode Selector (Hanya untuk Guru) */}
                        {user?.tag === 'Guru' && (
                            <>
                                <button
                                    onClick={() => {
                                        setInput(prev => prev.trim() ? prev + ' @PKL ' : '@PKL ');
                                        textareaRef.current?.focus();
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-full border border-white/[0.08] text-[#e3e3e3] text-xs font-semibold transition-all shadow-sm"
                                    title="Aktifkan Mode Data Prakerin / PKL"
                                >
                                    <span className="text-xl leading-none -mt-0.5">🏢</span>
                                    <span className="hidden sm:inline tracking-wide">Data PKL</span>
                                </button>

                                <div className="w-[1px] h-4 bg-white/10 mx-1 hidden sm:block"></div>
                            </>
                        )}

                        <button className="p-2.5 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-colors" title="Unggah Gambar">
                            <ImageIcon size={20} />
                        </button>
                        <button className="p-2.5 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-colors" title="Lampirkan File">
                            <Plus size={22} />
                        </button>
                    </div>

                    <div className="flex items-center shrink-0">
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !isStreaming) || isStreaming}
                            className={`
                p-3 rounded-full transition-all flex items-center justify-center
                ${isStreaming
                                    ? 'bg-white/10 text-white cursor-not-allowed opacity-50'
                                    : input.trim()
                                        ? 'bg-[#1a73e8] text-white shadow-xl hover:bg-[#1557b0]'
                                        : 'text-[#5f6368] bg-transparent'
                                }
              `}
                        >
                            {isStreaming ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full" />
                            ) : (
                                <Send size={20} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
