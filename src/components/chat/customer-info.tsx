"use client";

/**
 * Customer Info Panel — Right sidebar
 * Shows customer details, tags, and quick actions
 */

import { cn } from "@/lib/utils";
import type { ChatConversation, ConversationTag } from "@/lib/meta-types";
import {
    User,
    Tag,
    ShoppingBag,
    Facebook,
    Instagram,
    Phone,
    MapPin,
    Star,
    ExternalLink,
    Copy,
    Check,
} from "lucide-react";
import { useState } from "react";

interface CustomerInfoProps {
    conversation: ChatConversation | null;
    onTagChange?: (tag: ConversationTag) => void;
}

const TAG_OPTIONS: { key: ConversationTag; label: string; color: string; bgColor: string }[] = [
    { key: "new", label: "Mới", color: "#3B82F6", bgColor: "#EFF6FF" },
    { key: "pending", label: "Đang xử lý", color: "#F59E0B", bgColor: "#FFFBEB" },
    { key: "ordered", label: "Đã đặt", color: "#8B5CF6", bgColor: "#F5F3FF" },
    { key: "shipped", label: "Đang giao", color: "#06B6D4", bgColor: "#ECFEFF" },
    { key: "completed", label: "Hoàn thành", color: "#10B981", bgColor: "#ECFDF5" },
    { key: "spam", label: "Spam", color: "#EF4444", bgColor: "#FEF2F2" },
    { key: "vip", label: "VIP", color: "#F97316", bgColor: "#FFF7ED" },
];

function getAvatarInitial(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export default function CustomerInfo({
    conversation,
    onTagChange,
}: CustomerInfoProps) {
    const [copiedId, setCopiedId] = useState(false);

    if (!conversation) {
        return (
            <div className="flex h-full flex-col items-center justify-center border-l border-border bg-card p-6 text-center">
                <User className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                    Chọn cuộc trò chuyện để xem thông tin khách hàng
                </p>
            </div>
        );
    }

    const customer = conversation.customer;
    const customerName = customer?.name || "Khách hàng";

    const handleCopyId = () => {
        navigator.clipboard.writeText(customer?.id || conversation.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    return (
        <div className="flex h-full flex-col border-l border-border bg-card">
            {/* Customer Header */}
            <div className="border-b border-border p-5 text-center">
                {/* Avatar */}
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-destructive text-xl font-bold text-white shadow-lg">
                    {getAvatarInitial(customerName)}
                </div>
                <h3 className="text-base font-bold text-foreground">{customerName}</h3>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                    {conversation.platform === "facebook" ? (
                        <Facebook className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                        <Instagram className="h-3.5 w-3.5 text-pink-500" />
                    )}
                    <span className="text-xs text-muted-foreground capitalize">
                        {conversation.platform}
                    </span>
                </div>

                {/* PSID */}
                <button
                    onClick={handleCopyId}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground transition-colors hover:bg-muted/80"
                    title="Copy PSID"
                >
                    ID: {(customer?.id || conversation.id).slice(0, 12)}...
                    {copiedId ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                        <Copy className="h-3 w-3" />
                    )}
                </button>
            </div>

            {/* Tags */}
            <div className="border-b border-border p-4">
                <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    Nhãn
                </h4>
                <div className="flex flex-wrap gap-1.5">
                    {TAG_OPTIONS.map((tag) => (
                        <button
                            key={tag.key}
                            onClick={() => onTagChange?.(tag.key)}
                            className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                                conversation.tag === tag.key
                                    ? "shadow-sm ring-1"
                                    : "opacity-50 hover:opacity-100"
                            )}
                            style={{
                                backgroundColor: tag.bgColor,
                                color: tag.color,
                                ...(conversation.tag === tag.key
                                    ? { ringColor: tag.color }
                                    : {}),
                            }}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="border-b border-border p-4">
                <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Star className="h-3.5 w-3.5" />
                    Thao tác nhanh
                </h4>
                <div className="space-y-1.5">
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        Tạo đơn hàng
                    </button>
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
                        <Phone className="h-4 w-4 text-emerald-500" />
                        Thêm SĐT
                    </button>
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
                        <MapPin className="h-4 w-4 text-rose-500" />
                        Thêm địa chỉ
                    </button>
                    <a
                        href={`https://www.facebook.com/messages/t/${customer?.id || ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                        <ExternalLink className="h-4 w-4 text-blue-500" />
                        Mở trên Facebook
                    </a>
                </div>
            </div>

            {/* Notes section */}
            <div className="flex-1 p-4">
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    📝 Ghi chú
                </h4>
                <textarea
                    placeholder="Thêm ghi chú về khách hàng..."
                    className="h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-xs outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
            </div>
        </div>
    );
}
