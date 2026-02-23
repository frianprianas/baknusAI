export async function getKaromahSummary(): Promise<string> {
    try {
        const [siswaRes, jurnalRes] = await Promise.all([
            fetch('https://karomah.smkbn666.sch.id/api/data-sharing?token=karomah_shared_2026&type=siswa'),
            fetch('https://karomah.smkbn666.sch.id/api/data-sharing?token=karomah_shared_2026&type=jurnal')
        ]);

        const siswaData = await siswaRes.json();
        const jurnalData = await jurnalRes.json();

        if (!siswaData.success || !jurnalData.success) {
            return '';
        }

        const totalSiswa = siswaData.data.length;
        const totalJurnal = jurnalData.data.length;

        let ctx = `\n### Statistik Aplikasi Karomah (Buku Ramadan Digital)\n`;
        ctx += `- Total partisipasi siswa pengguna Karomah: **${totalSiswa}** orang\n`;
        ctx += `- Total jurnal Ramadan yang telah ditulis: **${totalJurnal}** jurnal (data real-time via API)\n`;
        ctx += `- AI dapat melakukan pengecekan nama siswa untuk melihat status kegiatan puasa Ramadannya.\n`;

        return ctx;
    } catch (err: any) {
        console.error('[apiKaromah] buildSummary error:', err?.message);
        return '';
    }
}

export async function searchKaromahSiswaByName(keyword: string): Promise<string> {
    try {
        const siswaRes = await fetch('https://karomah.smkbn666.sch.id/api/data-sharing?token=karomah_shared_2026&type=siswa');
        const siswaData = await siswaRes.json();

        if (!siswaData.success || !siswaData.data) {
            return '';
        }

        const matched = siswaData.data.filter((s: any) =>
            s.nama && s.nama.toLowerCase().includes(keyword.toLowerCase())
        ).slice(0, 10);

        if (matched.length === 0) {
            return '';
        }

        let result = `\n### Hasil Pencarian Jurnal Ramadan Karomah untuk "${keyword}"\n`;

        // Fetch jurnal data to count entries per student
        let jurnalData: any = { data: [] };
        try {
            const jRes = await fetch('https://karomah.smkbn666.sch.id/api/data-sharing?token=karomah_shared_2026&type=jurnal');
            jurnalData = await jRes.json();
        } catch (e) { }

        for (const siswa of matched) {
            result += `\n**${siswa.nama}**\n`;
            result += `- NIS: ${siswa.nis || '-'}\n`;
            result += `- Kelas: ${siswa.kelas || '-'}\n`;
            result += `- Pesan Status Karomah Terakhir: "${siswa.status || 'Tidak ada status'}"\n`;

            if (jurnalData && jurnalData.success && jurnalData.data) {
                const jcount = jurnalData.data.filter((j: any) => j.nis === siswa.nis).length;
                result += `- Total Jurnal Ramadan Terlaksana: ${jcount} catatan\n`;
            }
        }

        return result;
    } catch (err: any) {
        console.error('[apiKaromah] searchSiswaByName error:', err?.message);
        return '';
    }
}
