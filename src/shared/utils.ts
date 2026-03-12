import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatVNDCompact(amount: number) {
    if (amount >= 1e9) return (amount / 1e9).toFixed(1) + "b";
    if (amount >= 1e6) return (amount / 1e6).toFixed(1) + "tr";
    if (amount >= 1e3) return (amount / 1e3).toFixed(0) + "k";
    return amount.toString();
}

export function toVND(amount: number) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
}
