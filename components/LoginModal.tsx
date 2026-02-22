"use client";

import { useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";

interface User {
    email: string;
    name: string;
    tag?: string | null;
}

interface LoginModalProps {
    isOpen: boolean;
    onSuccess: (user: User) => void;
}

export default function LoginModal({ isOpen, onSuccess }: LoginModalProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const resp = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || "Gagal masuk, periksa kembali email & sandi Anda.");
            }

            onSuccess(data.user);
        } catch (err: any) {
            setError(err.message || "Terjadi kesalahan jaringan.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-md bg-[#131314] border border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
                {/* Glow Effects */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570]" />

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#1e1f20] flex items-center justify-center shadow-inner border border-white/[0.04]">
                        <img src="/logo.svg" alt="Baknus Logo" className="w-10 h-10" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold font-product text-white mb-2">Selamat Datang di BaknusAI</h2>
                    <p className="text-sm text-[#b4b4b4]">Masuk menggunakan akun Mailcow (SMK Bakti Nusantara 666)</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[13px] font-medium text-[#b4b4b4] ml-1">Email Sekolah</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368]" size={18} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@smk.baktinusantara666.sch.id"
                                className="w-full bg-[#1e1f20] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-[15px] placeholder-[#5f6368] outline-none focus:border-[#4285f4] transition-all"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[13px] font-medium text-[#b4b4b4] ml-1">Kata Sandi</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368]" size={18} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-[#1e1f20] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-[15px] placeholder-[#5f6368] outline-none focus:border-[#4285f4] transition-all"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className="w-full mt-6 bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 focus:ring-4 focus:ring-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            "Masuk ke BaknusAI"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
