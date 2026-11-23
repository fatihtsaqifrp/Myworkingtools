import { useCallback, useRef, useState } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  allowFolder?: boolean;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  fileSizeLabel?: string;
}

function matchesAccept(file: File, accept: string) {
  return accept.split(',').some((rawPattern) => {
    const pattern = rawPattern.trim().toLowerCase();
    if (pattern.endsWith('/*')) return file.type.toLowerCase().startsWith(pattern.slice(0, -1));
    if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern);
    return file.type.toLowerCase() === pattern;
  });
}

export function DropZone({
  onFilesSelected,
  accept = '.pdf,application/pdf',
  multiple = true,
  allowFolder = true,
  disabled = false,
  title = 'Seret & lepas file PDF di sini',
  subtitle = 'atau pilih langsung dari perangkat Anda',
  fileSizeLabel = '100MB',
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const filterFiles = useCallback(
    (files: FileList | File[]) => {
      return Array.from(files).filter((file) => matchesAccept(file, accept));
    },
    [accept]
  );

  const extractFilesFromEntries = async (items: DataTransferItemList): Promise<File[]> => {
    const extracted: File[] = [];

    const traverse = async (entry: any): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file((file: File) => {
            if (matchesAccept(file, accept)) extracted.push(file);
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = async (): Promise<void> => {
          return new Promise<void>((resolve) => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) {
                resolve();
              } else {
                for (const child of entries) {
                  await traverse(child);
                }
                await readEntries();
                resolve();
              }
            }, () => resolve());
          });
        };
        await readEntries();
      }
    };

    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    for (const entry of entries) {
      await traverse(entry);
    }

    return extracted;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsScanning(true);
      try {
        const files = await extractFilesFromEntries(e.dataTransfer.items);
        if (files.length > 0) {
          onFilesSelected(files);
          return;
        }
      } catch {
        // Fallback
      } finally {
        setIsScanning(false);
      }
    }

    if (e.dataTransfer.files) {
      const valid = filterFiles(e.dataTransfer.files);
      if (valid.length > 0) onFilesSelected(valid);
    }
  };

  const acceptsPdf = accept.includes('.pdf') || accept.includes('application/pdf');
  const acceptsImages = accept.includes('image/');
  const fileButtonLabel = acceptsPdf && acceptsImages
    ? 'Pilih File'
    : `Pilih File ${acceptsImages ? 'Gambar' : 'PDF'}`;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center rounded-xl border-2 border-dashed
        p-8 text-center transition select-none sm:p-10
        ${
          disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : isDragging
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:bg-gray-50/50'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) {
            const valid = filterFiles(e.target.files);
            if (valid.length > 0) onFilesSelected(valid);
            e.target.value = '';
          }
        }}
        className="hidden"
        disabled={disabled}
      />

      {allowFolder && (
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory standard
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => {
            if (e.target.files) {
              const valid = filterFiles(e.target.files);
              if (valid.length > 0) onFilesSelected(valid);
              e.target.value = '';
            }
          }}
          className="hidden"
          disabled={disabled}
        />
      )}

      <div>
        <p className="text-sm font-semibold text-gray-800">
          {isScanning ? 'Memindai folder...' : isDragging ? 'Lepaskan file di sini' : title}
        </p>
        <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
        >
          {fileButtonLabel}
        </button>

        {allowFolder && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => folderInputRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
          >
            Pilih Folder
          </button>
        )}
      </div>

      <p className="mt-4 text-[11px] text-gray-400">
       Supported formats: {accept.split(',').join(', ')}. Maximum file size: {fileSizeLabel}.
      </p>
    </div>
  );
}
