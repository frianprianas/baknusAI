'use client';

import { ChatSession } from '@/types';
import {
    Plus,
    MessageSquare,
    Trash2,
    Settings,
    HelpCircle,
    Gem,
    History,
    MoreVertical
} from 'lucide-react';

interface ChatSidebarProps {
    sessions: ChatSession[];
    user: { email: string; name: string; tag?: string | null } | null;
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onNewChat: () => void;
    onOpenSettings?: () => void;
    onClose: () => void;
}

export default function ChatSidebar({
    sessions,
    user,
    activeSessionId,
    onSelectSession,
    onDeleteSession,
    onNewChat,
    onOpenSettings,
    onClose,
}: ChatSidebarProps) {
    return (
        <div className="flex flex-col h-full bg-[#1e1f20] w-full select-none">

            {/* Top Section: New Chat Pill */}
            <div className="p-4">
                <button
                    onClick={onNewChat}
                    className="flex items-center gap-3 px-4 py-3.5 bg-[#131314] hover:bg-[#2e2f30] rounded-full transition-all group border border-white/[0.04] shadow-sm"
                >
                    <Plus size={20} className="text-[#8ab4f8]" />
                    <span className="text-[14px] font-medium font-product tracking-tight text-[#e3e3e3]">Chat Baru</span>
                </button>
            </div>

            <div className="px-3 space-y-1">
                <button className="flex items-center gap-4 w-full p-3 hover:bg-white/[0.05] rounded-full transition-colors group">
                    <Gem size={18} className="text-[#b4b4b4] group-hover:text-white" />
                    <span className="text-[14px] font-medium font-product text-[#e3e3e3]">Gem saya</span>
                </button>
            </div>

            {/* Recents List */}
            <div className="flex-1 overflow-y-auto px-2 mt-4 scrollbar-none">
                <div className="px-4 py-2 text-[11px] font-bold text-[#b4b4b4] uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <History size={12} />
                    Terbaru
                </div>

                <div className="space-y-0.5 mt-2">
                    {sessions.length === 0 ? (
                        <div className="px-5 py-4 text-[13px] text-[#5f6368] italic">Belum ada aktivitas</div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`
                  group flex items-center gap-3 px-4 py-3 rounded-full cursor-pointer transition-all
                  ${activeSessionId === s.id ? 'bg-[#37393b] text-white' : 'text-[#e3e3e3] hover:bg-white/[0.05]'}
                `}
                                onClick={() => onSelectSession(s.id)}
                            >
                                <MessageSquare size={16} className="shrink-0 opacity-50" />
                                <span className="text-[13px] truncate flex-1 font-medium">{s.title || 'Chat Baru'}</span>

                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                                        className="p-1 hover:bg-white/10 rounded-full transition-all text-[#b4b4b4] hover:text-red-400"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Bottom Section: Footer Actions */}
            <div className="p-3 border-t border-white/[0.04] bg-[#1e1f20]">
                <div className="space-y-0.5">
                    <button className="flex items-center gap-4 w-full p-3 hover:bg-white/[0.05] rounded-full transition-colors group">
                        <HelpCircle size={18} className="text-[#b4b4b4] group-hover:text-white" />
                        <span className="text-[14px] font-medium font-product text-[#e3e3e3]">Bantuan</span>
                    </button>
                    <button
                        onClick={onOpenSettings}
                        className="flex items-center gap-4 w-full p-3 hover:bg-white/[0.05] rounded-full transition-colors group"
                    >
                        <Settings size={18} className="text-[#b4b4b4] group-hover:text-white" />
                        <span className="text-[14px] font-medium font-product text-[#e3e3e3]">Setelan</span>
                    </button>
                </div>

                {/* Improved Profile Section */}
                <div className="flex items-center gap-3 p-3 mt-2 rounded-2xl bg-white/[0.03] border border-white/[0.03]">
                    <div className="relative overflow-hidden shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg uppercase">
                        {user ? user.name.slice(0, 2) : 'AI'}
                        {user && (
                            <img
                                src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
                                alt="Avatar"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-white truncate font-product flex items-center gap-1.5">
                            {user ? user.name : 'Memuat...'}
                            {user?.tag && (
                                <span className="bg-[#4285f4]/20 border border-[#4285f4]/30 text-[#8ab4f8] text-[9px] px-1.5 py-0.5 rounded shadow-sm font-bold uppercase tracking-wider">{user.tag}</span>
                            )}
                        </div>
                        <div className="text-[11px] text-[#b4b4b4] font-medium truncate">{user?.email || 'SMK Bakti Nusantara 666'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
