"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, LogIn, Shield, AlertCircle } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "talpha_auth";
const SESSION_HOURS = 24; // Auto-logout after 24 hours
const VALID_PASSWORD = "talpha2024";

interface LoginGateProps {
    children: React.ReactNode;
}

export default function LoginGate({ children }: LoginGateProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Check stored auth on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const { timestamp } = JSON.parse(stored);
                const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60);
                if (hoursSince < SESSION_HOURS) {
                    setIsAuthenticated(true);
                    return;
                }
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
        setIsAuthenticated(false);
    }, []);

    const handleLogin = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        // Slight delay for UX
        setTimeout(() => {
            if (password === VALID_PASSWORD) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                }));
                setIsAuthenticated(true);
            } else {
                setError("Mật khẩu không đúng. Vui lòng thử lại.");
                setPassword("");
            }
            setIsLoading(false);
        }, 600);
    }, [password]);

    // Loading state
    if (isAuthenticated === null) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="h-8 w-8 rounded-full border-2 border-violet-400 border-t-transparent"
                />
            </div>
        );
    }

    // Authenticated → show dashboard
    if (isAuthenticated) {
        return <>{children}</>;
    }

    // Login form
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-4">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative w-full max-w-md"
            >
                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                    {/* Logo / Header */}
                    <div className="mb-8 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
                        >
                            <Shield className="h-8 w-8 text-white" />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-white">TALPHA Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Tiểu Alpha — Middle East Marketing
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-300">
                                🔐 Mật khẩu truy cập
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Nhập mật khẩu..."
                                    autoFocus
                                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-12 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400"
                                >
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={!password.trim() || isLoading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                                />
                            ) : (
                                <LogIn className="h-4 w-4" />
                            )}
                            {isLoading ? "Đang xác thực..." : "Đăng nhập"}
                        </motion.button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-[11px] text-slate-500">
                            Phiên đăng nhập tự động hết hạn sau {SESSION_HOURS} giờ
                        </p>
                    </div>
                </div>

                {/* Version */}
                <p className="mt-4 text-center text-[10px] text-slate-600">
                    LEADER MKT TALPHA v5.1 • Powered by AI
                </p>
            </motion.div>
        </div>
    );
}
