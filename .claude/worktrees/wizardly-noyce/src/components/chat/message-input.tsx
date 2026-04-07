"use client";

/**
 * Message Input — Bottom of chat panel
 * Text input with send button and quick templates
 */

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    Send,
    Smile,
    Image as ImageIcon,
    Zap,
    X,
} from "lucide-react";

interface MessageInputProps {
    onSend: (text: string) => void;
    isSending: boolean;
    disabled?: boolean;
}

const QUICK_TEMPLATES = [
    { label: "Chào", text: "Chào bạn! Mình có thể giúp gì cho bạn? 😊" },
    { label: "Giá", text: "Dạ, để mình check giá và báo bạn nhé ạ 🙏" },
    { label: "Ship", text: "Bạn cho mình địa chỉ nhận hàng nhé ạ 📦" },
    { label: "Cảm ơn", text: "Cảm ơn bạn đã mua hàng! Chúc bạn ngày tốt lành ❤️" },
    { label: "Hết hàng", text: "Xin lỗi bạn, sản phẩm này hiện đang hết hàng. Mình sẽ thông báo khi có lại nhé ạ 🙏" },
    { label: "COD", text: "Bạn ơi, mình ship COD nhé. Bạn nhận hàng rồi thanh toán cho shipper ạ 💰" },
];

export default function MessageInput({
    onSend,
    isSending,
    disabled = false,
}: MessageInputProps) {
    const [text, setText] = useState("");
    const [showTemplates, setShowTemplates] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || isSending || disabled) return;
        onSend(trimmed);
        setText("");
        setShowTemplates(false);
        // Refocus input
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [text, isSending, disabled, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const handleTemplate = (templateText: string) => {
        setText(templateText);
        setShowTemplates(false);
        inputRef.current?.focus();
    };

    return (
        <div className="border-t border-border bg-card">
            {/* Quick Templates */}
            {showTemplates && (
                <div className="border-b border-border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            Mẫu nhanh
                        </span>
                        <button
                            onClick={() => setShowTemplates(false)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.label}
                                onClick={() => handleTemplate(tpl.text)}
                                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
                            >
                                {tpl.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input area */}
            <div className="flex items-end gap-2 p-3">
                {/* Action buttons */}
                <div className="flex gap-1">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={cn(
                            "rounded-lg p-2 transition-colors",
                            showTemplates
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title="Mẫu nhanh"
                    >
                        <Zap className="h-5 w-5" />
                    </button>
                    <button
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Gửi hình ảnh"
                    >
                        <ImageIcon className="h-5 w-5" />
                    </button>
                    <button
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Emoji"
                    >
                        <Smile className="h-5 w-5" />
                    </button>
                </div>

                {/* Text input */}
                <div className="relative flex-1">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={disabled ? "Chọn cuộc trò chuyện..." : "Nhập tin nhắn... (Enter để gửi)"}
                        disabled={disabled || isSending}
                        rows={1}
                        className="max-h-32 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                        style={{
                            height: "auto",
                            minHeight: "40px",
                        }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto";
                            target.style.height = Math.min(target.scrollHeight, 128) + "px";
                        }}
                    />
                </div>

                {/* Send button */}
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || isSending || disabled}
                    className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                        text.trim() && !isSending && !disabled
                            ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg active:scale-95"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {isSending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    );
}
