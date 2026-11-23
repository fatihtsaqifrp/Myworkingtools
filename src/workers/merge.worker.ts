// Super Merge Worker - High Performance Chunked Tree-Merging Engine
// Designed for 15,000+ pages & thousands of PDF files without browser freeze or OOM.

import { PDFDocument } from 'pdf-lib';

const PAGES_PER_TREE_CHUNK = 500;

let isCancelled = false;

interface InitMessage {
  type: 'init';
  totalFiles: number;
  batchSize: number;
}

interface BatchMessage {
  type: 'batch_data';
  files: { name: string; buffer: ArrayBuffer }[];
  startIndex: number;
}

interface CancelMessage {
  type: 'cancel';
}

type InMessage = InitMessage | BatchMessage | CancelMessage;

let totalFilesCount = 0;
let batchSizeCount = 10;
let currentIntermediateDoc: PDFDocument | null = null;
let intermediateBuffers: Uint8Array[] = [];
let totalAccumulatedPages = 0;
let skippedFiles: { name: string; error: string }[] = [];

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    isCancelled = true;
    currentIntermediateDoc = null;
    intermediateBuffers = [];
    self.postMessage({ type: 'cancelled' });
    return;
  }

  if (msg.type === 'init') {
    isCancelled = false;
    totalFilesCount = msg.totalFiles;
    batchSizeCount = msg.batchSize || 10;
    intermediateBuffers = [];
    totalAccumulatedPages = 0;
    skippedFiles = [];

    try {
      currentIntermediateDoc = await PDFDocument.create();

      // Request initial batch from main thread
      const firstBatchCount = Math.min(batchSizeCount, totalFilesCount);
      self.postMessage({
        type: 'request_batch',
        startIndex: 0,
        count: firstBatchCount,
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal menginisialisasi engine PDF',
      });
    }
    return;
  }

  if (msg.type === 'batch_data') {
    if (isCancelled || !currentIntermediateDoc) return;

    const { files, startIndex } = msg;

    try {
      for (let i = 0; i < files.length; i++) {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }

        const item = files[i];
        const currentFileNumber = startIndex + i + 1;

        try {
          if (!item.buffer || item.buffer.byteLength === 0) {
            throw new Error('File kosong atau rusak');
          }

          if (!currentIntermediateDoc) {
            currentIntermediateDoc = await PDFDocument.create();
          }

          const srcDoc = await PDFDocument.load(item.buffer, {
            ignoreEncryption: true,
            updateMetadata: false,
          });

          const pageIndices = srcDoc.getPageIndices();
          if (pageIndices.length === 0) {
            throw new Error('PDF tidak memiliki halaman');
          }

          const copiedPages = await currentIntermediateDoc.copyPages(srcDoc, pageIndices);
          for (const page of copiedPages) {
            currentIntermediateDoc.addPage(page);
          }

          totalAccumulatedPages += pageIndices.length;

          // Chunked Tree-Merging: If intermediate document exceeds threshold, seal it
          if (currentIntermediateDoc.getPageCount() >= PAGES_PER_TREE_CHUNK) {
            const intermediateBytes = await currentIntermediateDoc.save({
              useObjectStreams: false,
            });
            intermediateBuffers.push(intermediateBytes);

            // Dereference current doc and create a fresh one for the next chunk
            currentIntermediateDoc = null;
            currentIntermediateDoc = await PDFDocument.create();

            // Yield to browser GC
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        } catch (fileErr) {
          const errMsg = fileErr instanceof Error ? fileErr.message : 'Format PDF rusak';
          skippedFiles.push({ name: item.name, error: errMsg });
        }

        // Post live telemetry progress
        self.postMessage({
          type: 'progress',
          currentFile: currentFileNumber,
          totalFiles: totalFilesCount,
          pagesProcessed: totalAccumulatedPages,
          fileName: item.name,
        });

        // Immediately dereference buffer so memory is freed
        files[i] = null as never;

        if ((i + 1) % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      const nextIndex = startIndex + files.length;

      if (nextIndex < totalFilesCount) {
        // Request the next batch
        const nextBatchCount = Math.min(batchSizeCount, totalFilesCount - nextIndex);
        self.postMessage({
          type: 'request_batch',
          startIndex: nextIndex,
          count: nextBatchCount,
        });
      } else {
        // All source files have been processed.
        // Finalize any remaining pages in the current intermediate document.
        if (currentIntermediateDoc && currentIntermediateDoc.getPageCount() > 0) {
          const remainingBytes = await currentIntermediateDoc.save({ useObjectStreams: false });
          intermediateBuffers.push(remainingBytes);
          currentIntermediateDoc = null;
        }

        self.postMessage({
          type: 'status_update',
          message: 'Menyusun pohon dokumen akhir (Final Tree Consolidation)...',
        });

        let finalBuffer: ArrayBuffer;
        let finalPageCount = totalAccumulatedPages;

        if (intermediateBuffers.length === 0) {
          throw new Error('Tidak ada halaman PDF yang berhasil diproses.');
        } else if (intermediateBuffers.length === 1) {
          const singleBuffer = intermediateBuffers[0];
          finalBuffer = singleBuffer.buffer.slice(
            singleBuffer.byteOffset,
            singleBuffer.byteOffset + singleBuffer.byteLength
          ) as ArrayBuffer;
        } else {
          // Level 2 Tree Merge: Combine intermediate chunk buffers
          const finalDoc = await PDFDocument.create();

          for (let bIdx = 0; bIdx < intermediateBuffers.length; bIdx++) {
            if (isCancelled) {
              self.postMessage({ type: 'cancelled' });
              return;
            }

            const chunkBytes = intermediateBuffers[bIdx];
            const chunkDoc = await PDFDocument.load(chunkBytes, {
              ignoreEncryption: true,
              updateMetadata: false,
            });

            const pageIndices = chunkDoc.getPageIndices();
            const copiedPages = await finalDoc.copyPages(chunkDoc, pageIndices);
            for (const p of copiedPages) {
              finalDoc.addPage(p);
            }

            // Immediately dereference chunk buffer
            intermediateBuffers[bIdx] = null as never;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          finalPageCount = finalDoc.getPageCount();
          const finalPdfBytes = await finalDoc.save({ useObjectStreams: false });
          finalBuffer = finalPdfBytes.buffer.slice(
            finalPdfBytes.byteOffset,
            finalPdfBytes.byteOffset + finalPdfBytes.byteLength
          ) as ArrayBuffer;
        }

        intermediateBuffers = [];

        // Transfer final ArrayBuffer to main thread with zero copy
        (postMessage as (message: any, transfer?: Transferable[]) => void)(
          {
            type: 'done',
            pdfBuffer: finalBuffer,
            totalPages: finalPageCount,
            skippedFiles,
          },
          [finalBuffer]
        );
      }
    } catch (err) {
      currentIntermediateDoc = null;
      intermediateBuffers = [];
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Kesalahan saat proses tree-merging',
      });
    }
  }
};
