import Docxtemplater from 'docxtemplater';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import { readTableFile, toTransferableBuffer } from './office/table-data';

interface MailMergeMessage {
  template: File;
  dataFile: File;
  filenameColumn: string;
  type: 'inspect' | 'merge';
}

function safeFilename(value: string, index: number): string {
  const safe = value.normalize('NFKC').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${String(index + 1).padStart(3, '0')}_${safe || 'dokumen'}.docx`;
}

self.onmessage = async (event: MessageEvent<MailMergeMessage>) => {
  const { template, dataFile, filenameColumn, type } = event.data;
  try {
    if (!template || !dataFile) throw new Error('Pilih template DOCX dan file data CSV/Excel.');
    if (!/\.docx$/i.test(template.name)) throw new Error('Template harus berformat .docx.');
    if (template.size > 25 * 1024 * 1024) throw new Error('Ukuran maksimal template adalah 25 MB.');
    if (dataFile.size > 50 * 1024 * 1024) throw new Error('Ukuran maksimal file data adalah 50 MB.');
    const table = await readTableFile(dataFile);
    if (type === 'inspect') {
      self.postMessage({
        type: 'inspect',
        columns: table.headers,
        detail: `${table.rows.length.toLocaleString()} baris dan ${table.headers.length} kolom ditemukan.`,
      });
      return;
    }
    if (!table.rows.length) throw new Error('File data tidak berisi baris untuk digabung.');
    if (table.rows.length > 1_000) throw new Error('Maksimal 1.000 dokumen per batch. Bagi data menjadi beberapa batch.');
    if (filenameColumn && !table.headers.includes(filenameColumn)) {
      throw new Error(`Kolom nama file "${filenameColumn}" tidak ditemukan.`);
    }

    const templateBytes = await template.arrayBuffer();
    const archive = new JSZip();
    const total = table.rows.length;
    for (let index = 0; index < total; index += 1) {
      try {
        const doc = new Docxtemplater(new PizZip(templateBytes), {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => '',
        });
        doc.render(table.rows[index]);
        const bytes = doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
        archive.file(
          safeFilename(filenameColumn ? table.rows[index][filenameColumn] : '', index),
          bytes
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Tag template tidak cocok.';
        throw new Error(`Gagal membuat dokumen untuk baris ${index + 2}: ${detail}`);
      }
      self.postMessage({
        type: 'progress',
        current: index + 1,
        total,
        detail: `Membuat dokumen ${index + 1} dari ${total}`,
      });
    }

    const bytes = await archive.generateAsync(
      { type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 4 } },
      (metadata) => self.postMessage({
        type: 'progress',
        current: total,
        total: total + 1,
        detail: `Mengemas ZIP ${Math.round(metadata.percent)}%`,
      })
    );
    const buffer = toTransferableBuffer(bytes);
    self.postMessage(
      {
        type: 'done',
        total,
        outputs: [{ name: 'dokumen_mail_merge.zip', mimeType: 'application/zip', buffer }],
      },
      { transfer: [buffer] }
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Mail merge gagal.',
    });
  }
};
