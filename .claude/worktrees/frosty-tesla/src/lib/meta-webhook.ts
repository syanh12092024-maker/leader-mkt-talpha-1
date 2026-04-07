/**
 * Meta Webhook Utilities
 * Handles webhook verification and incoming message parsing
 *
 * Server-side only — used in API route handlers
 */

import crypto from "crypto";
import type { WebhookEvent, WebhookMessaging } from "./meta-types";

/**
 * Verify Meta webhook challenge (GET request)
 * Used when subscribing to webhook events
 */
export function verifyWebhook(
    mode: string | null,
    token: string | null,
    challenge: string | null
): { valid: boolean; challenge?: string } {
    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (!verifyToken) {
        console.error("META_VERIFY_TOKEN is not set");
        return { valid: false };
    }

    if (mode === "subscribe" && token === verifyToken) {
        return { valid: true, challenge: challenge || "" };
    }

    return { valid: false };
}

/**
 * Verify webhook signature from Meta (POST request)
 * Ensures the request actually came from Facebook
 */
export function verifySignature(
    rawBody: string,
    signature: string | null
): boolean {
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret) {
        console.warn(
            "META_APP_SECRET not set — skipping signature verification"
        );
        return true; // Allow in dev, but log warning
    }

    if (!signature) {
        return false;
    }

    // Signature format: "sha256=<hash>"
    const expectedHash = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

    const receivedHash = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
        Buffer.from(expectedHash, "hex"),
        Buffer.from(receivedHash, "hex")
    );
}

/**
 * Parse webhook event and extract new messages
 */
export function parseIncomingMessages(
    event: WebhookEvent
): WebhookMessaging[] {
    const messages: WebhookMessaging[] = [];

    if (event.object !== "page" && event.object !== "instagram") {
        return messages;
    }

    for (const entry of event.entry) {
        if (entry.messaging) {
            for (const messaging of entry.messaging) {
                // Only process actual messages (not deliveries/reads)
                if (messaging.message) {
                    messages.push(messaging);
                }
            }
        }
    }

    return messages;
}

/**
 * Parse ALL webhook events (including delivery + read receipts)
 */
export function parseAllEvents(event: WebhookEvent): {
    messages: WebhookMessaging[];
    deliveries: WebhookMessaging[];
    reads: WebhookMessaging[];
} {
    const result = {
        messages: [] as WebhookMessaging[],
        deliveries: [] as WebhookMessaging[],
        reads: [] as WebhookMessaging[],
    };

    if (event.object !== "page" && event.object !== "instagram") {
        return result;
    }

    for (const entry of event.entry) {
        if (entry.messaging) {
            for (const messaging of entry.messaging) {
                if (messaging.message) {
                    result.messages.push(messaging);
                } else if (messaging.delivery) {
                    result.deliveries.push(messaging);
                } else if (messaging.read) {
                    result.reads.push(messaging);
                }
            }
        }
    }

    return result;
}
