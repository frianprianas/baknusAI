'use client';

import { Message } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Sparkles, Check, ThumbsUp, ThumbsDown, Share2 } from 'lucide-react';
import { useState } from 'react';

interface ChatMessageProps {
    message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isUser) {
        return (
            <div className="flex flex-col items-end mb-8 animate-in">
                <div className="max-w-[85%] bg-[#2e2f30] text-[#e3e3e3] px-6 py-3.5 rounded-[24px] rounded-tr-sm leading-relaxed text-[15px] border border-white/[0.04] shadow-sm">
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-4 sm:gap-6 mb-12 animate-in group">
            {/* circular AI Icon */}
            <div className="mt-1.5 shrink-0">
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] shadow-lg">
                    <Sparkles size={18} className="text-white fill-white" />
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="prose-gemini max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                    </ReactMarkdown>
                </div>

                {message.content && (
                    <div className="mt-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-all text-[11px] font-bold uppercase tracking-widest"
                            title="Salin Pesan"
                        >
                            {copied ? (
                                <><Check size={14} className="text-green-500" /> Tersalin</>
                            ) : (
                                <><Copy size={14} /> Salin</>
                            )}
                        </button>
                        <button className="p-2.5 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-all">
                            <ThumbsUp size={16} />
                        </button>
                        <button className="p-2.5 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-all">
                            <ThumbsDown size={16} />
                        </button>
                        <button className="p-2.5 hover:bg-white/5 rounded-full text-[#b4b4b4] hover:text-white transition-all">
                            <Share2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
