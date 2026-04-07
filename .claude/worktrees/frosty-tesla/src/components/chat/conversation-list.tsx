"use client";

/**
 * Conversation List — Left sidebar
 * Shows all Facebook conversations with search, filter, and unread badges
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatConversation, ConversationTag, CONVERSATION_TAGS } from "@/lib/meta-types";
import { Search, MessageCircle, Filter } from "lucide-react";

interface ConversationListProps {
    conversations: ChatConversation[];
    activeId: string | null;
    onSelect: (conversation: ChatConversation) => void;
    isLoading: boolean;
}

const TAG_COLORS: Record<ConversationTag, { label: string; color: string; bgColor: string }> = {
    new: { label: "Mới", color: "#3B82F6", bgColor: "#EFF6FF" },
    pending: { label: "Đang xử lý", color: "#F59E0B", bgColor: "#FFFBEB" },
    ordered: { label: "Đã đặt", color: "#8B5CF6", bgColor: "#F5F3FF" },
    shipped: { label: "Đang giao", color: "#06B6D4", bgColor: "#ECFEFF" },
    completed: { label: "Hoàn thành", color: "#10B981", bgColor: "#ECFDF5" },
    spam: { label: "Spam", color: "#EF4444", bgColor: "#FEF2F2" },
    vip: { label: "VIP", color: "#F97316", bgColor: "#FFF7ED" },
};

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins}p`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function getAvatarInitial(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

const AVATAR_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-pink-500",
];

function getAvatarColor(id: string): string {
    const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function ConversationList({
    conversations,
    activeId,
    onSelect,
    isLoading,
}: ConversationListProps) {
    const [search, setSearch] = useState("");
    const [filterTag, setFilterTag] = useState<ConversationTag | "all">("all");

    const filtered = conversations.filter((conv) => {
        const name = conv.customer?.name?.toLowerCase() || "";
        const snippet = conv.snippet?.toLowerCase() || "";
        const matchSearch =
            !search || name.includes(search.toLowerCase()) || snippet.includes(search.toLowerCase());
        const matchTag = filterTag === "all" || conv.tag === filterTag;
        return matchSearch && matchTag;
    });

    return (
        <div className="flex h-full flex-col border-r border-border bg-card">
            {/* Header */}
            <div className="border-b border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        Tin nhắn
                    </h2>
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                        {conversations.length}
                    </span>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* Tag Filter */}
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFilterTag("all")}
                        className={cn(
                            "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                            filterTag === "all"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        Tất cả
                    </button>
                    {(Object.entries(TAG_COLORS) as [ConversationTag, typeof TAG_COLORS[ConversationTag]][]).map(
                        ([key, tag]) => (
                            <button
                                key={key}
                                onClick={() => setFilterTag(key)}
                                className={cn(
                                    "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                                    filterTag === key
                                        ? "shadow-sm"
                                        : "opacity-70 hover:opacity-100"
                                )}
                                style={
                                    filterTag === key
                                        ? { backgroundColor: tag.bgColor, color: tag.color }
                                        : { backgroundColor: tag.bgColor, color: tag.color }
                                }
                            >
                                {tag.label}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-3 p-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex animate-pulse gap-3 rounded-lg p-3">
                                <div className="h-10 w-10 rounded-full bg-muted" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-2/3 rounded bg-muted" />
                                    <div className="h-3 w-full rounded bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                            {search ? "Không tìm thấy cuộc trò chuyện" : "Chưa có tin nhắn"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0.5 p-1.5">
                        {filtered.map((conv) => {
                            const isActive = conv.id === activeId;
                            const customerName = conv.customer?.name || "Khách hàng";

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelect(conv)}
                                    className={cn(
                                        "group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all",
                                        isActive
                                            ? "bg-primary/10 shadow-sm"
                                            : "hover:bg-muted/60"
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div
                                            className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white",
                                                getAvatarColor(conv.id)
                                            )}
                                        >
                                            {getAvatarInitial(customerName)}
                                        </div>
                                        {/* Unread indicator */}
                                        {conv.unread_count && conv.unread_count > 0 && (
                                            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                                                {conv.unread_count > 9 ? "9+" : conv.unread_count}
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={cn(
                                                    "truncate text-sm font-semibold",
                                                    isActive ? "text-primary" : "text-foreground"
                                                )}
                                            >
                                                {customerName}
                                            </span>
                                            <span className="ml-1 flex-shrink-0 text-xs text-muted-foreground">
                                                {formatTimeAgo(conv.updated_time)}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {conv.snippet || "Hình ảnh/File đính kèm"}
                                        </p>
                                        {/* Tag */}
                                        {conv.tag && TAG_COLORS[conv.tag] && (
                                            <span
                                                className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: TAG_COLORS[conv.tag].bgColor,
                                                    color: TAG_COLORS[conv.tag].color,
                                                }}
                                            >
                                                {TAG_COLORS[conv.tag].label}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
