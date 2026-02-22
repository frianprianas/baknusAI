import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
    const store = await cookies();
    const token = store.get("baknus_auth")?.value;

    if (!token) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "rahasia12345");
        return NextResponse.json({ authenticated: true, user: payload });
    } catch (error) {
        return NextResponse.json({ authenticated: false, error: "Sesi telah berakhir." }, { status: 401 });
    }
}
