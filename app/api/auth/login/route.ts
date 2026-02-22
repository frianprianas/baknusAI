import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
        }

        const host = process.env.MAILCOW_HOST;
        const apiKey = process.env.MAILCOW_API_KEY;

        if (!host || !apiKey) {
            return NextResponse.json({ error: "Konfigurasi Mailcow belum diisi." }, { status: 500 });
        }

        // Authenticate using SMTP to verify password
        const transporter = nodemailer.createTransport({
            host: host,
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: email,
                pass: password,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        try {
            await transporter.verify();
        } catch (authError) {
            console.error("SMTP Auth validation error:", authError);
            return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
        }

        // If auth succeeds, try fetching user details from Mailcow API using the master API key
        let fullName = email.split("@")[0]; // Fallback name
        let tag = null; // Store tag (e.g. 'Siswa', 'Guru')

        try {
            const apiProtocol = process.env.MAILCOW_API_PROTOCOL || "https";
            const apiHost = process.env.MAILCOW_API_HOST || host;

            const resp = await fetch(`${apiProtocol}://${apiHost}/api/v1/get/mailbox/${email}`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Accept": "application/json",
                },
            });

            if (resp.ok) {
                const data = await resp.json();

                // Mailcow can return object or array depending on the exact version/endpoint behavior
                const accountData = Array.isArray(data) && data.length > 0 ? data[0] : data;

                if (accountData && typeof accountData === "object") {
                    if (accountData.name) {
                        fullName = accountData.name;
                    } else if (accountData.local_part) {
                        fullName = accountData.local_part;
                    }

                    // Extract tags (usually array)
                    if (accountData.tags && Array.isArray(accountData.tags) && accountData.tags.length > 0) {
                        tag = accountData.tags[0]; // Take the first tag
                    }
                }
            }
        } catch (err) {
            console.warn("Could not fetch name/tag from Mailcow API:", err);
        }

        // Sign JWT Token
        const payload = { email, name: fullName, tag: tag };
        const secret = process.env.JWT_SECRET || "rahasia12345";
        const token = jwt.sign(payload, secret, { expiresIn: "7d" });

        // Await cookies since cookies() is now treated asynchronously in newer Next.js or use standard object assignment
        const store = await cookies();
        store.set("baknus_auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        return NextResponse.json({ success: true, user: payload });
    } catch (error) {
        console.error("Login Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan internal server." }, { status: 500 });
    }
}
