"use client";

/**
 * Message Panel — Center column
 * Displays chat messages in bubble format with auto-scroll
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { MetaMessage } from "@/lib/meta-types";
import { Bot, Image as ImageIcon } from "lucide-react";

interface MessagePanelProps {
    messages: MetaMessage[];
    pageId: string;
    customerName: string;
    isLoading: boolean;
}

function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatMessageDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hôm nay";
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
    return date.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function shouldShowDate(messages: MetaMessage[], index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(messages[index].created_time).toDateString();
    const prev = new Date(messages[index - 1].created_time).toDateString();
    return curr !== prev;
}

export default function MessagePanel({
    messages,
    pageId,
    customerName,
    isLoading,
}: MessagePanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (isLoading) {
        return (
            <div className="flex flex-1 flex-col p-4">
                <div className="flex-1 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
                        >
                            <div
                                className={cn(
                                    "animate-pulse rounded-2xl",
                                    i % 2 === 0 ? "bg-muted" : "bg-primary/20",
                                    i % 3 === 0 ? "h-8 w-48" : i % 3 === 1 ? "h-8 w-64" : "h-8 w-36"
                                )}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                    <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Bắt đầu cuộc trò chuyện</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Gửi tin nhắn đầu tiên cho {customerName}
                </p>
            </div>
        );
    }

    // Messages come from API in reverse chronological order, reverse them
    const sortedMessages = [...messages].reverse();

    return (
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
            {sortedMessages.map((msg, idx) => {
                const isFromPage = msg.from.id === pageId;
                const showDate = shouldShowDate(sortedMessages, idx);

                return (
                    <div key={msg.id}>
                        {/* Date separator */}
                        {showDate && (
                            <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-xs font-medium text-muted-foreground">
                                    {formatMessageDate(msg.created_time)}
                                </span>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                        )}

                        {/* Message bubble */}
                        <div
                            className={cn(
                                "mb-2 flex",
                                isFromPage ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "group relative max-w-[75%] rounded-2xl px-4 py-2.5 transition-shadow",
                                    isFromPage
                                        ? "rounded-br-md bg-primary text-primary-foreground shadow-sm"
                                        : "rounded-bl-md bg-muted text-foreground shadow-sm"
                                )}
                            >
                                {/* Message text */}
                                {msg.message && (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                        {msg.message}
                                    </p>
                                )}

                                {/* Attachments */}
                                {msg.attachments?.data?.map((att) => (
                                    <div key={att.id} className="mt-1.5">
                                        {att.image_data ? (
                                            <img
                                                src={att.image_data.url}
                                                alt="Attachment"
                                                className="max-h-48 rounded-lg object-cover"
                                                loading="lazy"
                                            />
                                        ) : att.file_url ? (
                                            <a
                                                href={att.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 rounded-lg bg-background/20 px-3 py-2 text-xs underline"
                                            >
                                                <ImageIcon className="h-4 w-4" />
                                                {att.name || "File đính kèm"}
                                            </a>
                                        ) : null}
                                    </div>
                                ))}

                                {/* Timestamp */}
                                <span
                                    className={cn(
                                        "mt-1 block text-right text-[10px] opacity-60",
                                        isFromPage ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    {formatMessageTime(msg.created_time)}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Auto-scroll anchor */}
            <div ref={bottomRef} />
        </div>
    );
}
