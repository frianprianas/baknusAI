import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// PUT update session (add message)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345'); }
    catch { return NextResponse.json({ error: 'Invalid Token' }, { status: 401 }); }

    const { id } = await params;
    const { title, messages } = await req.json();

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Delete existing messages and recreate (simple sync strategy)
    await prisma.message.deleteMany({ where: { sessionId: id } });

    const session = await prisma.chatSession.update({
        where: { id, userId: user.id },
        data: {
            title: title || 'Chat Baru',
            updatedAt: new Date(),
            messages: {
                create: messages?.map((m: any) => ({
                    role: m.role,
                    content: m.content,
                })) || []
            }
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    return NextResponse.json(session);
}

// DELETE a session
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345'); }
    catch { return NextResponse.json({ error: 'Invalid Token' }, { status: 401 }); }

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await prisma.message.deleteMany({ where: { sessionId: id } });
    await prisma.chatSession.delete({ where: { id, userId: user.id } });

    return NextResponse.json({ success: true });
}
