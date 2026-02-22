"use client";

import { X, LogOut, User as UserIcon, Mail } from "lucide-react";
import { useState } from "react";

interface User {
    email: string;
    name: string;
    tag?: string | null;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export default function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    if (!isOpen) return null;

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload(); // Reload to trigger auth check and show login modal
        } catch (err) {
            console.error("Gagal logout:", err);
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-md bg-[#1e1f20] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#131314]">
                    <h2 className="text-lg font-bold text-white font-product">Setelan Akun</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-[#b4b4b4] hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <div className="relative overflow-hidden w-20 h-20 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-2xl font-bold text-white shadow-xl mb-4 border-4 border-[#131314] uppercase">
                            {user?.name ? user.name.slice(0, 2) : "AI"}
                            {user?.email && (
                                <img
                                    src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
                                    alt="Avatar"
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white font-product flex items-center gap-2">
                            {user?.name || "Pengguna"}
                            {user?.tag && (
                                <span className="bg-[#4285f4]/20 border border-[#4285f4]/30 text-[#8ab4f8] text-xs px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">{user.tag}</span>
                            )}
                        </h3>
                        <p className="text-sm text-[#b4b4b4] mt-1 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            SMK Bakti Nusantara 666
                        </p>
                    </div>

                    <div className="space-y-3 bg-[#131314] p-4 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 text-sm">
                            <UserIcon size={18} className="text-[#8ab4f8]" />
                            <div className="flex-1">
                                <p className="text-[#5f6368] text-xs font-semibold uppercase tracking-wider">Nama Lengkap</p>
                                <p className="text-[#e3e3e3] font-medium">{user?.name || "-"}</p>
                            </div>
                        </div>
                        <div className="h-px bg-white/5 w-full"></div>
                        <div className="flex items-center gap-3 text-sm">
                            <Mail size={18} className="text-[#9b72cb]" />
                            <div className="flex-1">
                                <p className="text-[#5f6368] text-xs font-semibold uppercase tracking-wider">Alamat Email</p>
                                <p className="text-[#e3e3e3] font-medium truncate">{user?.email || "-"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer (Actions) */}
                <div className="px-6 py-4 bg-[#131314] border-t border-white/10 flex justify-end">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-all border border-red-500/20 disabled:opacity-50"
                    >
                        {isLoggingOut ? (
                            <span className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
                        ) : (
                            <LogOut size={16} />
                        )}
                        Keluar (Logout)
                    </button>
                </div>
            </div>
        </div>
    );
}
