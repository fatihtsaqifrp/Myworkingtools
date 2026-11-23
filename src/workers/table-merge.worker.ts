import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readTableFile, sanitizeSpreadsheetCell, toTransferableBuffer } from './office/table-data';

interface MergeMessage {
  type: 'inspect' | 'merge';
  files: File[];
  outputFormat: 'xlsx' | 'csv';
  deduplicateColumn: string;
  capitalization: 'keep' | 'lower' | 'title';
}

function normalize(value: string, capitalization: MergeMessage['capitalization']): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (capitalization === 'lower') return trimmed.toLocaleLowerCase();
  if (capitalization === 'title') {
    return trimmed.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
  }
  return trimmed;
}

self.onmessage = async (event: MessageEvent<MergeMessage>) => {
  const { files, outputFormat, deduplicateColumn, capitalization } = event.data;
  try {
    if (!files.length) throw new Error('Pilih setidaknya satu file CSV atau Excel.');
    if (files.length > 200) throw new Error('Maksimal 200 file per batch.');
    if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) {
      throw new Error('Total ukuran file data maksimal 100 MB per batch.');
    }

    const allHeaders = new Set<string>();
    const tables: Awaited<ReturnType<typeof readTableFile>>[] = [];
    let totalRows = 0;
    for (let index = 0; index < files.length; index += 1) {
      const table = await readTableFile(files[index]);
      totalRows += table.rows.length;
      if (totalRows > 250_000) {
        throw new Error('Batas aman adalah 250.000 baris total per batch.');
      }
      table.headers.forEach((header) => allHeaders.add(header));
      if (allHeaders.size > 500) {
        throw new Error('Gabungan file maksimal memiliki 500 kolom.');
      }
      tables.push(table);
      self.postMessage({
        type: 'progress',
        current: index + 1,
        total: files.length,
        detail: `Membaca ${files[index].name}`,
      });
    }

    const headers = [...allHeaders];
    if (event.data.type === 'inspect') {
      self.postMessage({
        type: 'inspect',
        columns: headers,
        detail: `${headers.length} kolom ditemukan dari ${files.length} file.`,
      });
      return;
    }

    if (deduplicateColumn && !allHeaders.has(deduplicateColumn)) {
      throw new Error(`Kolom duplikat "${deduplicateColumn}" tidak ditemukan pada file.`);
    }
    if (totalRows * headers.length > 5_000_000) {
      throw new Error('Gabungan data melebihi batas aman 5.000.000 sel per batch.');
    }

    const seen = new Set<string>();
    const rows: Record<string, string>[] = [];
    for (const table of tables) {
      for (const row of table.rows) {
        const cleaned = Object.fromEntries(
          headers.map((header) => [header, normalize(row[header] ?? '', capitalization)])
        );
        if (deduplicateColumn) {
          const value = cleaned[deduplicateColumn].trim().toLocaleLowerCase();
          if (value) {
            if (seen.has(value)) continue;
            seen.add(value);
          }
        }
        rows.push(cleaned);
      }
    }

    self.postMessage({
      type: 'progress',
      current: files.length,
      total: files.length,
      detail: `Mengekspor ${rows.length.toLocaleString()} baris`,
    });

    const safeMatrix = [
      headers,
      ...rows.map((row) => headers.map((header) => sanitizeSpreadsheetCell(row[header] ?? ''))),
    ];
    let buffer: ArrayBuffer;
    let mimeType: string;
    let extension: string;
    if (outputFormat === 'csv') {
      const csv = Papa.unparse(safeMatrix);
      buffer = toTransferableBuffer(new TextEncoder().encode(`\uFEFF${csv}`));
      mimeType = 'text/csv;charset=utf-8';
      extension = 'csv';
    } else {
      const sheet = XLSX.utils.aoa_to_sheet(safeMatrix);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Master');
      buffer = toTransferableBuffer(XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true }));
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    }
    self.postMessage(
      {
        type: 'done',
        total: rows.length,
        outputs: [{ name: `master_data.${extension}`, mimeType, buffer }],
      },
      { transfer: [buffer] }
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Penggabungan data gagal.',
    });
  }
};
