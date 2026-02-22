import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET() {
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345');
    } catch {
        return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return NextResponse.json({ dailyRequestCount: 0, limit: 100 });

    const now = new Date();
    const lastDate = new Date(user.lastRequestDate);
    const isSameDay =
        now.getDate() === lastDate.getDate() &&
        now.getMonth() === lastDate.getMonth() &&
        now.getFullYear() === lastDate.getFullYear();

    return NextResponse.json({
        dailyRequestCount: isSameDay ? user.dailyRequestCount : 0,
        limit: 100,
    });
}
