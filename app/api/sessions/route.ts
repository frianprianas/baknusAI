import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// GET all sessions for the current user
export async function GET() {
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345'); }
    catch { return NextResponse.json({ error: 'Invalid Token' }, { status: 401 }); }

    const user = await prisma.user.findUnique({
        where: { email: decoded.email },
    });

    if (!user) return NextResponse.json([]);

    const sessions = await prisma.chatSession.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            messages: { orderBy: { createdAt: 'asc' } }
        }
    });

    return NextResponse.json(sessions);
}

// POST create new session
export async function POST(req: NextRequest) {
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345'); }
    catch { return NextResponse.json({ error: 'Invalid Token' }, { status: 401 }); }

    const { title, messages } = await req.json();

    const user = await prisma.user.upsert({
        where: { email: decoded.email },
        update: {},
        create: { email: decoded.email, name: decoded.name }
    });

    const session = await prisma.chatSession.create({
        data: {
            title: title || 'Chat Baru',
            userId: user.id,
            messages: {
                create: messages?.map((m: any) => ({
                    role: m.role,
                    content: m.content,
                })) || []
            }
        },
        include: { messages: true }
    });

    return NextResponse.json(session, { status: 201 });
}
