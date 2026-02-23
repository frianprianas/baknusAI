import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import SCHOOL_KNOWLEDGE from '@/lib/schoolKnowledge';
import { buildSummaryContext, buildPersonalContext, searchSiswaByName, executeDynamicSQL } from '@/lib/mysqlPkl';
import { getKaromahSummary, searchKaromahSiswaByName } from '@/lib/apiKaromah';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to get a random Gemini client
function getGenAI(): GoogleGenerativeAI {
  let keys: string[] = [];
  if (process.env.GEMINI_API_KEYS) {
    keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  }
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys = [process.env.GEMINI_API_KEY];
  }

  const selectedKey = keys.length > 0
    ? keys[Math.floor(Math.random() * keys.length)]
    : '';

  return new GoogleGenerativeAI(selectedKey);
}

const SYSTEM_PROMPT = `Kamu adalah BaknusAI, asisten resmi SMK Bakti Nusantara 666 berbasis AI.

IDENTITAS DIRIMU:
- Namamu adalah BaknusAI, dibuat khusus untuk SMK Bakti Nusantara 666.
- Jangan pernah menyebut dirimu sebagai produk Groq, Meta, Llama, atau perusahaan teknologi lainnya.
- Kamu memiliki pengetahuan mendalam tentang sekolah ini.

CARA MENJAWAB:
- Gunakan Bahasa Indonesia yang baik, ramah, dan sopan.
- Berikan jawaban yang jelas, terstruktur, dan mudah dipahami oleh siswa SMK.
- Gunakan bullet point, nomor, atau heading jika membantu kejelasan.
- Jika pertanyaan menyangkut data sekolah yang belum tersedia (ditandai dengan tanda kurung), sampaikan dengan jujur bahwa informasi tersebut sedang diperbarui.
- Jika ditanya di luar konteks sekolah, tetap bantu dengan bijaksana.

PENGETAHUAN TENTANG SEKOLAH:
${SCHOOL_KNOWLEDGE}
`;

const DAILY_LIMIT = 100;

/**
 * Deteksi keyword pencarian nama siswa dari pesan user
 */
function extractSearchKeyword(text: string): string | null {
  const patterns = [
    /cari\s+(?:siswa\s+)?(?:dengan\s+)?nama\s+([a-zA-Z\s]+)/i,
    /(?:info|data|tentang|status|jumlah|tampilkan)\s+(?:karomah|ramadan|puasa|siswa|jurnal)\s+(?:atas\s+nama\s+|bernama\s+|untuk\s+)?([a-zA-Z\s]{3,})/i,
    /siswa\s+(?:bernama|dengan\s+nama)?\s*([a-zA-Z\s]{3,})/i,
    /(?:siapa|dimana)\s+([a-zA-Z]{3,}(?:\s+[a-zA-Z]+)*)\s+(?:pkl|magang|dudi)/i,
    /(?:bagaimana|cek|tampilkan)\s+(?:status|jurnal|karomah|ramadan|jumlah)\s+(?:jurnal\s+|)(?:siswa\s+|)(?:atas\s+nama\s+|bernama\s+|untuk\s+)?([a-zA-Z\s]+)/i,
    /([a-zA-Z\s]{3,})\s+(?:status|info|pkl|karomah)-nya/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const keyword = m[1].trim().replace(/\s+/g, ' ');
      const stopWords = ['siswa', 'nama', 'dalam', 'yang', 'dan', 'pkl', 'data', 'info', 'karomah', 'ramadan', 'jurnal', 'untuk', 'atas', 'jumlah'];
      if (keyword.length >= 3 && !stopWords.includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Auth Check
    const store = await cookies();
    const token = store.get('baknus_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia12345');
    } catch {
      return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }

    const userEmail = decoded.email;

    // Daily Limit Check
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: { email: userEmail, name: decoded.name },
    });

    const now = new Date();
    const lastRequestDate = new Date(user.lastRequestDate);
    const isSameDay =
      now.getDate() === lastRequestDate.getDate() &&
      now.getMonth() === lastRequestDate.getMonth() &&
      now.getFullYear() === lastRequestDate.getFullYear();

    const currentCount = isSameDay ? user.dailyRequestCount : 0;

    if (currentCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: `Batas harian tercapai. Kamu sudah bertanya ${DAILY_LIMIT} kali hari ini. Silakan coba lagi besok!`,
      }, { status: 429 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { dailyRequestCount: currentCount + 1, lastRequestDate: now },
    });

    // Potong history ke max 6 pesan terakhir
    const trimmedMessages = messages.slice(-6);

    // Ambil pesan user terbaru untuk deteksi pencarian nama (fallback logic)
    const lastUserMsg = [...trimmedMessages].reverse().find((m: any) => m.role === 'user');
    const lastUserText: string = lastUserMsg?.content || '';
    let searchKeyword = extractSearchKeyword(lastUserText);

    // =========================================================================
    // TEXT-TO-SQL (AI QUERY GENERATION) DENGAN FAST MODEL LLAMA-8B
    // =========================================================================
    let dynamicSqlResult = '';
    try {
      const sqlPrompt = `Tugasmu sebagai analis data adalah menerjemahkan pertanyaan bahasa manusia menjadi query SQL SELECT yang valid untuk database MySQL.
Jika pertanyaan tidak berkaitan dengan pencarian data dari tabel database, jawab cukup dengan kata: "NO".

SKEMA DATABASE:
- user: id_user, nama, username (ini NIS siswa/NIPY guru), level ('Siswa' atau 'Pembimbing'), kelas_id, jurusan_id
- kelas: id_kelas, nama_kelas, jurusan_id (relasi ke jurusan.id_jurusan)
- jurusan: id_jurusan, nama_jurusan
- dudi: id_dudi, nama_dudi, alamat_dudi
- penempatan: id_penempatan, nis_penempatan (relasi ke user.username yg level='Siswa'), dudi_id (relasi ke dudi.id_dudi), pembimbing1 (relasi ke user.username yg level='Pembimbing')

CONTOH PERTANYAAN & QUERY BENAR:
T: "Siapa saja siswa yang PKL di Telkom?"
J: SELECT siswa.nama as nama_siswa, dudi.nama_dudi FROM penempatan p JOIN user siswa ON p.nis_penempatan = siswa.username JOIN dudi ON p.dudi_id = dudi.id_dudi WHERE dudi.nama_dudi LIKE '%Telkom%' LIMIT 20;

T: "Siapa murid yang dibimbing Bapak Frian Prianas?"
J: SELECT siswa.nama as nama_siswa, dudi.nama_dudi, guru.nama as nama_pembimbing FROM penempatan p JOIN user siswa ON p.nis_penempatan = siswa.username JOIN user guru ON p.pembimbing1 = guru.username LEFT JOIN dudi ON p.dudi_id = dudi.id_dudi WHERE guru.nama LIKE '%Frian Prianas%' LIMIT 20;

T: "Siapa nama pembimbing PKL dari siswa bernama Budi?"
J: SELECT guru.nama as nama_pembimbing, dudi.nama_dudi FROM penempatan p JOIN user respon ON p.nis_penempatan = respon.username JOIN user guru ON p.pembimbing1 = guru.username LEFT JOIN dudi ON p.dudi_id = dudi.id_dudi WHERE respon.nama LIKE '%Budi%' LIMIT 20;

T: "Tampilkan kelas dan jurusan serta tempat PKL siswa bernama Budi"
J: SELECT siswa.nama as nama_siswa, k.nama_kelas as kelas, j.nama_jurusan as jurusan, d.nama_dudi as tempat_pkl FROM penempatan p JOIN user siswa ON p.nis_penempatan = siswa.username LEFT JOIN kelas k ON siswa.kelas_id = k.id_kelas LEFT JOIN jurusan j ON siswa.jurusan_id = j.id_jurusan LEFT JOIN dudi d ON p.dudi_id = d.id_dudi WHERE siswa.nama LIKE '%Budi%' LIMIT 20;

ATURAN WAJIB:
1. HANYA OUTPUT QUERY SQL TANPA PENJELASAN! JAWAB "NO" JIKA PERTANYAAN BUKAN TENTANG DATABASE.
2. WAJIB SELECT nama siswa. Jangan hanya return ID. Selalu sertakan JOIN ke tabel user (sebagai siswa) dan dudi atau user (sebagai guru).
`;

      const sqlContext = trimmedMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const userPrompt = `[Histori Obrolan Sebagai Konteks]\n${sqlContext}\n\nTUGAS: Terjemahkan ucapan User terakhir dengan bergantung pada histori obrolan jika itu adalah pertanyaan lanjutan.`;

      let generatedQuery = 'NO';
      try {
        const genAI = getGenAI();
        const sqlModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: sqlPrompt
        });
        const preFlight = await sqlModel.generateContent(userPrompt);
        generatedQuery = preFlight.response.text()?.trim() || 'NO';
      } catch (geminiSqlErr: any) {
        console.warn('[chat] Gemini SQL Agent failed, falling back to Groq:', geminiSqlErr?.message);
        const groqSqlResponse = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: sqlPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 500,
        });
        generatedQuery = groqSqlResponse.choices[0]?.message?.content?.trim() || 'NO';
      }

      // API outputs sometimes wrap SQL in markdown blocks
      let cleanQuery = generatedQuery.replace(/```sql/ig, '').replace(/```/g, '').trim();

      if (cleanQuery !== 'NO' && cleanQuery.toUpperCase().startsWith('SELECT')) {
        console.log('[chat] AI Generated SQL:', cleanQuery);
        dynamicSqlResult = await executeDynamicSQL(cleanQuery);
        // Jika SQL Agent berjalan sukses, tidak perlu lagi pencarian nama manual
        if (!dynamicSqlResult.includes('Terjadi kesalahan')) {
          searchKeyword = null;
        }
      }
    } catch (err: any) {
      console.error('[chat] Pre-flight SQL error:', err?.message);
    }
    // =========================================================================

    // Ambil data MySQL dan API Eksternal Karomah secara paralel
    const [summaryContext, karomahSummary, personalContext, searchResult, karomahSearchResult] = await Promise.all([
      buildSummaryContext(),       // Ringkasan statistik PKL (kecil, ~2k chars)
      getKaromahSummary(),         // Ringkasan statistik Karomah
      buildPersonalContext(userEmail, decoded.name),
      searchKeyword ? searchSiswaByName(searchKeyword) : Promise.resolve(''),
      searchKeyword ? searchKaromahSiswaByName(searchKeyword) : Promise.resolve(''),
    ]);

    // Bangun system prompt
    let fullSystemPrompt = `${SYSTEM_PROMPT}\n\nPengguna yang sedang berbincang denganmu saat ini adalah: ${decoded.name} (${userEmail}). Sapa dan panggillah dengan namanya dengan ramah.`;

    if (summaryContext) {
      fullSystemPrompt += `

===== STATISTIK DATABASE PKL SEKOLAH =====
${summaryContext}
==========================================`;
    }

    if (karomahSummary) {
      fullSystemPrompt += `

===== STATISTIK BUKU RAMADAN (KAROMAH) =====
${karomahSummary}
==========================================`;
    }

    if (dynamicSqlResult) {
      fullSystemPrompt += `

===== HASIL DATABASE DARI AI SQL AGENT =====
(Berikut adalah data real-time menjawab pertanyaan user berdasar SQL)
${dynamicSqlResult}
============================================`;
    }

    if (searchResult) {
      fullSystemPrompt += `

===== HASIL PENCARIAN SISWA (DATABASE PKL MySQL): "${searchKeyword}" =====
(Gunakan untuk menjawab pertanyaan tentang PKL atau info dasar siswa ini.)
${searchResult}
=====================================================`;
    }

    if (karomahSearchResult) {
      fullSystemPrompt += `

===== HASIL PENCARIAN SISWA (BUKU RAMADAN KAROMAH): "${searchKeyword}" =====
(Gunakan untuk menjawab aktivitas puasa/ramadan/karomah siswa tersebut.)
${karomahSearchResult}
=====================================================`;
    }

    if (personalContext) {
      fullSystemPrompt += `

===== DATA PRIBADI USER YANG SEDANG LOGIN =====
${personalContext}
================================================`;
    }

    let streamSource: 'gemini' | 'groq' = 'gemini';
    let geminiResult: any;
    let groqStream: any;

    try {
      const genAI = getGenAI();
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: fullSystemPrompt
      });

      const geminiContents = trimmedMessages.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Memulai stream Gemini
      geminiResult = await geminiModel.generateContentStream({
        contents: geminiContents,
      });
      // Jika berhasil akan lanjut ke bawah
    } catch (geminiError: any) {
      console.warn('[chat] Gemini API failed (limit/error), falling back to Groq:', geminiError?.message);
      streamSource = 'groq';
      // Fallback ke Groq
      const groqMessages = trimmedMessages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      groqStream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...groqMessages,
        ],
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      });
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          if (streamSource === 'gemini') {
            for await (const chunk of geminiResult.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunkText })}\n\n`));
              }
            }
          } else {
            for await (const chunk of groqStream) {
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API Fatal Error (Both APIs Failed):', error?.status, error?.message || error);

    // Jika Groq dan Gemini DUA-DUANYA gagal
    if (error?.status === 429 || error?.message?.includes('rate_limit') || error?.message?.includes('429')) {
      return NextResponse.json({ error: 'Mohon maaf, semua jalur AI sedang mengalami batas antrean trafik tinggi. Silakan coba lagi 1 menit kemudian.' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Internal Server Error: ' + (error?.message || 'Kami gagal merespons permintaan saat ini.') }, { status: 500 });
  }
}
