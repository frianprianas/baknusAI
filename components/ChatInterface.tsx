'use client';

import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import ChatSidebar from './ChatSidebar';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Message, ChatSession } from '@/types';
import { Menu, Sparkles, ChevronDown } from 'lucide-react';
import LoginModal from './LoginModal';
import SettingsModal from './SettingsModal';



export default function ChatInterface() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Auth State
    const [user, setUser] = useState<{ email: string; name: string; tag?: string | null } | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Quota State
    const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadQuota = async () => {
        try {
            const r = await fetch('/api/user/quota');
            if (r.ok) {
                const d = await r.json();
                setQuota({ used: d.dailyRequestCount, limit: d.limit });
            }
        } catch { }
    };

    const loadSessionsFromDB = async () => {
        try {
            const r = await fetch('/api/sessions');
            if (r.ok) {
                const data = await r.json();
                const mapped: ChatSession[] = data.map((s: any) => ({
                    id: s.id,
                    title: s.title,
                    createdAt: new Date(s.createdAt),
                    updatedAt: new Date(s.updatedAt),
                    messages: s.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        timestamp: new Date(m.createdAt),
                    }))
                }));
                setSessions(mapped);
            }
        } catch { }
    };

    useEffect(() => {
        setMounted(true);
        if (window.innerWidth < 1024) setSidebarOpen(false);

        // Check Auth then load data
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data.authenticated && data.user) {
                    setUser(data.user);
                    loadSessionsFromDB();
                    loadQuota();
                } else {
                    setIsLoginModalOpen(true);
                }
            })
            .catch(() => setIsLoginModalOpen(true))
            .finally(() => setIsCheckingAuth(false));
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (content: string) => {
        if (!content.trim() || isStreaming) return;

        const userMsg: Message = { id: nanoid(), role: 'user', content, timestamp: new Date() };
        const newMessages: Message[] = [...messages, userMsg];
        setMessages(newMessages);
        setIsStreaming(true);

        const assistantId = nanoid();
        const initialAssistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date() };
        setMessages(prev => [...prev, initialAssistantMsg]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = res.status === 429
                    ? (errData.error || 'Batas harian 100 pertanyaan tercapai. Silakan coba lagi besok!')
                    : (errData.error || 'Maaf, terjadi gangguan pada server.');
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errMsg } : m));
                setIsStreaming(false);
                return;
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') break;
                            try {
                                fullContent += JSON.parse(data).content;
                                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
                            } catch { }
                        }
                    }
                }
            }

            const finalAssistantMsg: Message = { id: assistantId, role: 'assistant', content: fullContent, timestamp: new Date() };
            const finalHistory: Message[] = [...newMessages, finalAssistantMsg];

            const dbMessages = finalHistory.map(m => ({ role: m.role, content: m.content }));

            if (!activeSessionId) {
                // Create new session in DB
                const r = await fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: content.slice(0, 40), messages: dbMessages })
                });
                if (r.ok) {
                    const newSessionDB = await r.json();
                    const newSession: ChatSession = {
                        id: newSessionDB.id,
                        title: newSessionDB.title,
                        messages: finalHistory,
                        createdAt: new Date(newSessionDB.createdAt),
                        updatedAt: new Date(newSessionDB.updatedAt),
                    };
                    setSessions(prev => [newSession, ...prev]);
                    setActiveSessionId(newSessionDB.id);
                }
            } else {
                // Update existing session in DB
                await fetch(`/api/sessions/${activeSessionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: sessions.find(s => s.id === activeSessionId)?.title,
                        messages: dbMessages
                    })
                });
                setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalHistory, updatedAt: new Date() } : s));
            }

            // Refresh quota after each message
            loadQuota();

        } catch (err: any) {
            const errMsg = err?.message === 'QUOTA_EXCEEDED'
                ? 'Batas harian 100 pertanyaan tercapai. Silakan coba lagi besok!'
                : 'Maaf, terjadi gangguan pada server.';
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errMsg } : m));
        } finally {
            setIsStreaming(false);
        }
    };

    if (!mounted || isCheckingAuth) return null;

    return (
        <div className="flex h-screen bg-[#131314] text-[#e3e3e3]">
            <LoginModal
                isOpen={isLoginModalOpen}
                onSuccess={(userData) => {
                    setUser(userData);
                    setIsLoginModalOpen(false);
                }}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                user={user}
            />

            {/* Sidebar - Solid width on desktop, hidden on mobile */}
            <aside className={`
        bg-[#1e1f20] transition-all duration-300 ease-[cubic-bezier(0.1,0.9,0.2,1)] shrink-0
        ${sidebarOpen ? 'w-[280px]' : 'w-0'}
      `}>
                <div className="w-[280px] h-full">
                    <ChatSidebar
                        sessions={sessions}
                        user={user}
                        activeSessionId={activeSessionId}
                        onSelectSession={(id) => {
                            const s = sessions.find(x => x.id === id);
                            if (s) { setActiveSessionId(id); setMessages(s.messages); }
                        }}
                        onDeleteSession={async (id) => {
                            await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
                            setSessions(prev => prev.filter(s => s.id !== id));
                            if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
                        }}
                        onNewChat={() => { setActiveSessionId(null); setMessages([]); }}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        onClose={() => setSidebarOpen(false)}
                    />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative min-w-0">

                {/* Superior Header */}
                <header className="h-[64px] flex items-center justify-between px-6 shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2.5 hover:bg-white/5 rounded-full transition-all text-[#b4b4b4]"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-xl cursor-pointer group transition-all">
                            <img src="/logo.svg" alt="Baknus Logo" className="w-7 h-7" />
                            <span className="text-[20px] font-product font-bold text-white tracking-wide">BAKNUS AI</span>
                            <ChevronDown size={14} className="text-[#b4b4b4] mt-1 group-hover:text-white" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-full select-none">
                            <Sparkles size={14} className="text-[#8ab4f8]" />
                            <span className="text-[12px] font-bold text-[#b4b4b4] uppercase tracking-widest font-product">Advanced</span>
                        </div>
                        {quota && (
                            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border select-none ${quota.used >= quota.limit
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : quota.used >= quota.limit * 0.8
                                    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                    : 'bg-green-500/10 border-green-500/20 text-green-400'
                                }`}>
                                {quota.used}/{quota.limit} hari ini
                            </div>
                        )}
                        <div
                            onClick={() => setIsSettingsOpen(true)}
                            className="relative overflow-hidden w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-xl ring-1 ring-white/10 cursor-pointer hover:opacity-80 transition-all uppercase"
                        >
                            {user ? user.name.slice(0, 2) : 'AI'}
                            {user && (
                                <img
                                    src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
                                    alt="Avatar"
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            )}
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollbar-main relative">
                    {messages.length === 0 ? (
                        /* Gemini Style Hello */
                        <div className="max-w-[1000px] mx-auto min-h-full w-full px-8 flex flex-col pt-24 pb-48">
                            <div className="animate-in">
                                <h1 className="text-[52px] md:text-[56px] font-product font-bold leading-[1.1] mb-10 tracking-tight">
                                    <span className="bg-gemini-gradient">Halo {user?.tag === 'Guru' ? 'Bapak/Ibu Guru' : 'Siswa'}.</span><br />
                                    <span className="text-[#444746]">Apa yang ingin Anda kerjakan hari ini?</span>
                                </h1>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-8 opacity-90">
                                    {(user?.tag === 'Guru' ? [
                                        { icon: '🏢', t: 'Data Prakerin', d: 'Cari tempat PKL Telkom', p: 'Tampilkan data tempat PKL bernama Telkom' },
                                        { icon: '🌙', t: 'Rekap Karomah', d: 'Jurnal puasa siswa', p: 'Tampilkan statistik total jurnal buku ramadan Karomah saat ini' },
                                        { icon: '📊', t: 'Statistik PKL', d: 'Total siswa penempatan', p: 'Tampilkan statistik berapa banyak siswa yang sudah ditempatkan PKL' },
                                        { icon: '💡', t: 'Bantu Mengajar', d: 'Buat soal pilihan ganda', p: 'Bantu saya membuat 5 soal PG tentang jaringan komputer' }
                                    ] : [
                                        { icon: '🌙', t: 'Buku Ramadan', d: 'Cek target Karomah', p: 'Cek total jurnal Karomah saya sejauh ini' },
                                        { icon: '💡', t: 'Bantu Belajar', d: 'Jelaskan konsep OOP', p: 'Tolong jelaskan konsep OOP dalam pemrograman Java' },
                                        { icon: '📝', t: 'Buat Ringkasan', d: 'Ringkas materi jaringan', p: 'Tolong buatkan ringkasan materi tentang topologi jaringan komputer' },
                                        { icon: '💻', t: 'Bantu Coding', d: 'Contoh program Python', p: 'Berikan satu program sederhana menggunakan Python' }
                                    ]).map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(item.p)}
                                            className="p-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] rounded-2xl text-left transition-all hover:scale-[1.01]"
                                        >
                                            <div className="text-2xl mb-2">{item.icon}</div>
                                            <h3 className="text-[15px] font-bold text-white mb-1 font-product">{item.t}</h3>
                                            <p className="text-[13px] text-[#b4b4b4] leading-snug">{item.d}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Message Flow */
                        <div className="max-w-[1000px] mx-auto w-full px-8 py-10 pb-48">
                            {messages.map((m) => (
                                <ChatMessage key={m.id} message={m} />
                            ))}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    )}
                </div>

                {/* Input Dock */}
                <div className="shrink-0 p-6 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent pointer-events-none sticky bottom-0">
                    <div className="pointer-events-auto">
                        <ChatInput onSend={sendMessage} isStreaming={isStreaming} user={user} />
                        <p className="max-w-[1000px] mx-auto text-center text-[11px] text-[#5f6368] mt-4 font-medium opacity-60">
                            BaknusAI dapat memberikan jawaban yang tidak akurat. Verifikasi kembali informasi penting.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
