import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            // SSL dinonaktifkan karena server tidak mendukung secure connection
        });
    }
    return pool;
}

// ============================================================
// FUNGSI BARU: Ringkasan statistik saja (ringan ~2k chars)
// Tidak membawa daftar siswa/DUDI agar tidak 413 di Groq
// ============================================================
export async function buildSummaryContext(): Promise<string> {
    try {
        const db = getPool();

        const [[statsRows], [taRows], [jurusanRows], [kelasRows], [guruRows], [absenRows]] = await Promise.all([
            db.execute<mysql.RowDataPacket[]>(
                `SELECT
                    (SELECT COUNT(*) FROM user WHERE level='Siswa') as total_siswa,
                    (SELECT COUNT(*) FROM user WHERE level='Pembimbing') as total_guru,
                    (SELECT COUNT(*) FROM dudi) as total_dudi,
                    (SELECT COUNT(*) FROM penempatan) as total_penempatan,
                    (SELECT COUNT(*) FROM jurnal_siswa) as total_jurnal,
                    (SELECT COUNT(*) FROM absen) as total_absen`
            ),
            db.execute<mysql.RowDataPacket[]>(
                `SELECT nama_ta, angkatan FROM tahun_ajaran ORDER BY id_ta DESC LIMIT 3`
            ),
            db.execute<mysql.RowDataPacket[]>(
                `SELECT nama_jurusan, komli FROM jurusan ORDER BY nama_jurusan`
            ),
            db.execute<mysql.RowDataPacket[]>(
                `SELECT k.nama_kelas, j.nama_jurusan,
                    (SELECT COUNT(*) FROM user u WHERE u.kelas_id = k.id_kelas AND u.level='Siswa') as jml
                 FROM kelas k LEFT JOIN jurusan j ON k.jurusan_id = j.id_jurusan
                 ORDER BY j.nama_jurusan, k.nama_kelas`
            ),
            db.execute<mysql.RowDataPacket[]>(
                `SELECT nama as nama_guru, username as NIPY FROM user WHERE level='Pembimbing' ORDER BY nama`
            ),
            db.execute<mysql.RowDataPacket[]>(
                `SELECT ket_absen, COUNT(*) as total FROM absen GROUP BY ket_absen`
            ),
        ]);

        const s = statsRows[0] as any;
        let ctx = `### Statistik Database PKL (Real-time)\n`;
        ctx += `- Total siswa terdaftar: **${s.total_siswa}** orang\n`;
        ctx += `- Total guru: **${s.total_guru}** orang\n`;
        ctx += `- Total tempat PKL (DUDI): **${s.total_dudi}** tempat\n`;
        ctx += `- Siswa yang sudah ditempatkan PKL: **${s.total_penempatan}** siswa\n`;
        ctx += `- Total entri jurnal: **${s.total_jurnal}** | Total catatan absen: **${s.total_absen}**\n\n`;

        if ((taRows as any[]).length > 0) {
            ctx += `### Tahun Ajaran\n`;
            (taRows as any[]).forEach((ta: any) => ctx += `- ${ta.nama_ta} (Angkatan: ${ta.angkatan})\n`);
            ctx += `\n`;
        }

        if ((jurusanRows as any[]).length > 0) {
            ctx += `### Program Keahlian / Jurusan\n`;
            (jurusanRows as any[]).forEach((j: any) => {
                ctx += `- ${j.nama_jurusan}`;
                if (j.komli) ctx += ` (Komli: ${j.komli})`;
                ctx += `\n`;
            });
            ctx += `\n`;
        }

        if ((kelasRows as any[]).length > 0) {
            ctx += `### Daftar Kelas\n`;
            (kelasRows as any[]).forEach((k: any) => ctx += `- ${k.nama_kelas} (${k.nama_jurusan}) — ${k.jml} siswa\n`);
            ctx += `\n`;
        }

        if ((guruRows as any[]).length > 0) {
            ctx += `### Daftar Guru (${(guruRows as any[]).length} orang)\n`;
            (guruRows as any[]).forEach((g: any) => {
                ctx += `- ${g.nama_guru}`;
                if (g.NIPY) ctx += ` (NIPY: ${g.NIPY})`;
                if (g.no_telp) ctx += ` | HP: ${g.no_telp}`;
                ctx += `\n`;
            });
            ctx += `\n`;
        }

        if ((absenRows as any[]).length > 0) {
            ctx += `### Statistik Kehadiran PKL\n`;
            (absenRows as any[]).forEach((a: any) => ctx += `- ${a.ket_absen}: ${a.total} catatan\n`);
            ctx += `\n`;
        }

        ctx += `\n> CATATAN: Untuk melihat data siswa atau penempatan PKL spesifik, user bisa minta "cari siswa nama [nama]"\n`;
        return ctx;
    } catch (err: any) {
        console.error('[mysqlPkl] buildSummaryContext error:', err?.message);
        pool = null;
        return '';
    }
}

// ============================================================
// FUNGSI PENCARIAN SISWA BY NAMA (lengkap dengan info PKL)
// ============================================================

/**
 * Cari siswa berdasarkan nama (partial match) — data lengkap termasuk penempatan PKL
 */
export async function searchSiswaByName(keyword: string): Promise<string> {
    try {
        const db = getPool();

        // Step 1: Cari siswa yang namanya cocok
        const [siswaRows] = await db.execute<mysql.RowDataPacket[]>(
            `SELECT u.username as nis, u.nama as nama_siswa,
                    k.nama_kelas, j.nama_jurusan, ta.nama_ta
             FROM user u
             LEFT JOIN kelas k ON u.kelas_id = k.id_kelas
             LEFT JOIN jurusan j ON u.jurusan_id = j.id_jurusan
             LEFT JOIN tahun_ajaran ta ON u.ta_id = ta.id_ta
             WHERE u.level = 'Siswa' AND u.nama LIKE ? LIMIT 10`,
            [`%${keyword}%`]
        );

        if (siswaRows.length === 0) {
            return `\n> Tidak ditemukan siswa dengan nama mengandung kata "${keyword}" dalam database.\n`;
        }

        let result = `\n### Hasil Pencarian Siswa: "${keyword}" (${siswaRows.length} ditemukan)\n`;

        for (const siswa of siswaRows as any[]) {
            result += `\n**${siswa.nama_siswa}**\n`;
            result += `- NIS: ${siswa.nis} | NISN: ${siswa.nisn || '-'}\n`;
            result += `- Kelas: ${siswa.nama_kelas || '-'} | Jurusan: ${siswa.nama_jurusan || '-'}\n`;
            result += `- Tahun Ajaran: ${siswa.nama_ta || '-'}\n`;

            // Cari penempatan PKL untuk siswa ini
            try {
                const [penempatanRows] = await db.execute<mysql.RowDataPacket[]>(
                    `SELECT p.mulai, p.selesai, d.nama_dudi, d.alamat_dudi, d.no_kontak, d.nama_kontak,
                            g.nama as pembimbing
                     FROM penempatan p
                     LEFT JOIN dudi d ON p.dudi_id = d.id_dudi
                     LEFT JOIN user g ON p.pembimbing1 = g.username
                     WHERE p.nis_penempatan = ? LIMIT 1`,
                    [siswa.nis]
                );
                if ((penempatanRows as any[]).length > 0) {
                    const pen = penempatanRows[0] as any;
                    result += `- **Tempat PKL: ${pen.nama_dudi}**\n`;
                    result += `  Alamat: ${pen.alamat_dudi || '-'}\n`;
                    if (pen.nama_kontak) result += `  Kontak: ${pen.nama_kontak} (${pen.no_kontak || '-'})\n`;
                    if (pen.pembimbing) result += `  Pembimbing Sekolah: ${pen.pembimbing}\n`;
                    if (pen.mulai) result += `  Periode: ${pen.mulai} s/d ${pen.selesai || 'sekarang'}\n`;
                } else {
                    result += `- Status PKL: **Belum ditempatkan**\n`;
                }
            } catch { /* skip jika query penempatan gagal */ }
        }

        return result;
    } catch (err: any) {
        console.error('[mysqlPkl] searchSiswaByName error:', err?.message);
        return '';
    }
}

// ============================================================
// FUNGSI TEXT-TO-SQL (DYNAMIC QUERY DARI AI)
// ============================================================

/**
 * Eksekusi SQL query dinamis yang di-generate oleh AI
 * WAJIB: Hanya mengizinkan SELECT, dan dibatasi 5 baris.
 */
export async function executeDynamicSQL(query: string): Promise<string> {
    try {
        let q = query.trim();
        // Keamanan 1: Tolak jika BUKAN SELECT (wajib diawali SELECT/WITH)
        if (!/^(SELECT|WITH)\b/i.test(q)) {
            return `[SISTEM] Akses Ditolak Tipe I: Demi alasan keamanan, sistem hanya mengizinkan perintah membaca data (SELECT).`;
        }

        // Keamanan 2: Tolak keras kata kunci berbahaya di mana pun dalam query (SQL Injection Defense)
        const forbiddenKeywords = /\b(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE|EXEC|CREATE|REPLACE|GRANT|REVOKE)\b/i;
        if (forbiddenKeywords.test(q)) {
            return `[SISTEM] Akses Ditolak Tipe II: Ditemukan indikasi percobaan memanipulasi atau menghapus data. Perintah ini dibatalkan oleh server.`;
        }

        // Keamanan 3: Hilangkan ; di akhir. Paksa batasan 20 data.
        q = q.replace(/;+$/, '').trim();
        // Override limit bawaan dari prompt untuk dipastikan selalu 20
        q = q.replace(/\s+LIMIT\s+\d+/i, '');
        q += ' LIMIT 20';

        const db = getPool();
        const [rows] = await db.execute<mysql.RowDataPacket[]>(q);

        if (!rows || rows.length === 0) {
            return `[SISTEM] Query berhasil dijalankan, namun tidak ada data yang ditemukan.`;
        }

        // Format hasil dictionary menjadi string (JSON / teks sederhana)
        let result = `[SISTEM] Hasil pencarian dari database:\n`;
        rows.forEach((row, i) => {
            result += `${i + 1}. `;
            const parts = Object.keys(row).map(key => `${key}: ${row[key]}`);
            result += parts.join(' | ') + `\n`;
        });

        if (rows.length === 20) {
            result += `\n[PEMBERITAHUAN] Menampilkan 20 data pertama. Silahkan buka web prakerin.smkbn666.sch.id untuk informasi selengkapnya.`;
        }

        return result;
    } catch (err: any) {
        console.error('[mysqlPkl] executeDynamicSQL error:', err?.message, 'Query:', query);
        return `[SISTEM] Terjadi kesalahan dalam query SQL: ${err.message}`;
    }
}

// ============================================================
// FUNGSI HELPER (untuk personal context)
// ============================================================

/**
 * Cari data siswa berdasarkan email
 */
export async function getSiswaByEmail(email: string) {
    try {
        const db = getPool();
        const [rows] = await db.execute<mysql.RowDataPacket[]>(
            `SELECT u.username as nis, u.username as nisn, u.nama as nama_siswa, k.nama_kelas, j.nama_jurusan, ta.nama_ta
             FROM user u
             LEFT JOIN kelas k ON u.kelas_id = k.id_kelas
             LEFT JOIN jurusan j ON u.jurusan_id = j.id_jurusan
             LEFT JOIN tahun_ajaran ta ON u.ta_id = ta.id_ta
             WHERE u.level = 'Siswa' AND u.username = ? LIMIT 1`,
            [email.split('@')[0]]
        );
        return rows[0] || null;
    } catch { return null; }
}

/**
 * Ambil data penempatan PKL siswa
 */
export async function getPenempatanByNis(nis: string) {
    try {
        const db = getPool();
        const [rows] = await db.execute<mysql.RowDataPacket[]>(
            `SELECT p.*, d.nama_dudi, d.alamat_dudi, d.no_kontak, d.nama_kontak,
                    g.nama as pembimbing_sekolah
             FROM penempatan p
             LEFT JOIN dudi d ON p.dudi_id = d.id_dudi
             LEFT JOIN user g ON p.pembimbing1 = g.username
             WHERE p.nis_penempatan = ? LIMIT 1`,
            [nis]
        );
        return rows[0] || null;
    } catch { return null; }
}

/**
 * Ambil jurnal PKL terbaru siswa
 */
export async function getJurnalTerbaru(nis: string, limit = 5) {
    try {
        const db = getPool();
        const [rows] = await db.execute<mysql.RowDataPacket[]>(
            `SELECT js.tgl_jurnal, js.uraian_kerja, uk.nama_uraian
             FROM jurnal_siswa js
             LEFT JOIN uraian_kegiatan uk ON js.uraian_id = uk.id_uraian
             WHERE js.nis_jurnal = ?
             ORDER BY js.tgl_jurnal DESC LIMIT ?`,
            [nis, limit]
        );
        return rows;
    } catch { return []; }
}

/**
 * Rekap kehadiran/absensi siswa bulan ini
 */
export async function getRekapAbsensi(nis: string) {
    try {
        const db = getPool();
        const now = new Date();
        const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [rows] = await db.execute<mysql.RowDataPacket[]>(
            `SELECT ket_absen, COUNT(*) as jumlah
             FROM absen
             WHERE nis_absen = ? AND DATE_FORMAT(tgl_absen, '%Y-%m') = ?
             GROUP BY ket_absen`,
            [nis, bulanIni]
        );
        return rows;
    } catch { return []; }
}

// ============================================================
// KONTEKS PERSONAL UNTUK SISWA YANG LOGIN
// ============================================================

/**
 * Konteks personal untuk siswa yang sedang login
 */
export async function buildPersonalContext(userEmail: string): Promise<string> {
    try {
        const siswa = await getSiswaByEmail(userEmail);
        if (!siswa) return '';

        const nis = siswa.nis;
        const [penempatan, jurnal, absen] = await Promise.all([
            getPenempatanByNis(nis),
            getJurnalTerbaru(nis, 5),
            getRekapAbsensi(nis),
        ]);

        let context = `\n## DATA PRIBADI SISWA YANG SEDANG LOGIN\n`;
        context += `- Nama: ${siswa.nama_siswa}\n`;
        context += `- NIS: ${siswa.nis} | NISN: ${siswa.nisn}\n`;
        context += `- Kelas: ${siswa.nama_kelas || '-'} | Jurusan: ${siswa.nama_jurusan || '-'}\n`;
        context += `- No HP: ${siswa.no_hp || '-'} | Tahun Ajaran: ${siswa.nama_ta || '-'}\n`;

        if (penempatan) {
            context += `\n### Penempatan PKL\n`;
            context += `- DUDI: ${penempatan.nama_dudi}\n`;
            context += `- Alamat: ${penempatan.alamat_dudi}\n`;
            context += `- Kontak: ${penempatan.nama_kontak} (${penempatan.no_kontak})\n`;
            context += `- Pembimbing Sekolah: ${penempatan.pembimbing_sekolah || '-'}\n`;
            if (penempatan.mulai) context += `- Periode: ${penempatan.mulai} s/d ${penempatan.selesai || '?'}\n`;
        }

        if ((jurnal as any[]).length > 0) {
            context += `\n### 5 Jurnal Terakhir\n`;
            (jurnal as any[]).forEach((j: any, i: number) => {
                context += `${i + 1}. [${j.tgl_jurnal}] ${j.uraian_kerja || j.nama_uraian || '-'}\n`;
            });
        }

        if ((absen as any[]).length > 0) {
            context += `\n### Rekap Kehadiran Bulan Ini\n`;
            (absen as any[]).forEach((a: any) => {
                context += `- ${a.ket_absen}: ${a.jumlah} hari\n`;
            });
        }

        return context;
    } catch { return ''; }
}

// Legacy exports
export const buildPklContext = buildPersonalContext;
export const buildGlobalPklContext = buildSummaryContext; // alias lama
