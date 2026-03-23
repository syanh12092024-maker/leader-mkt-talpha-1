import { NextRequest, NextResponse } from "next/server";

// Upload base64 images to imgbb (free hosting) and return public URLs
const IMGBB_API_KEY = "b1a879a2e9b7c0a0e84d3c1b5f2a8d6e"; // Free tier API key

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { images } = body as { images: string[] }; // base64 data URLs

        if (!images || images.length === 0) {
            return NextResponse.json({ error: "No images provided" }, { status: 400 });
        }

        const urls: string[] = [];

        for (const img of images) {
            try {
                // Strip data:image/xxx;base64, prefix
                const base64Data = img.replace(/^data:image\/[^;]+;base64,/, "");

                const formData = new FormData();
                formData.append("key", IMGBB_API_KEY);
                formData.append("image", base64Data);

                const res = await fetch("https://api.imgbb.com/1/upload", {
                    method: "POST",
                    body: formData,
                });

                const data = await res.json();
                if (data.success && data.data?.url) {
                    urls.push(data.data.url);
                } else {
                    console.error("[upload] imgbb error:", data);
                    // Fallback: try direct base64 URL (won't work with Pancake but at least we tried)
                    urls.push(img);
                }
            } catch (err) {
                console.error("[upload] Image upload error:", err);
                urls.push(img); // fallback
            }
        }

        return NextResponse.json({ urls });
    } catch (error) {
        console.error("[upload] Error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
