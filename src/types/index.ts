export type ToolId =
  | 'merge'
  | 'split'
  | 'organize'
  | 'crop'
  | 'sign'
  | 'compress'
  | 'img2pdf'
  | 'pdf2img'
  | 'watermark'
  | 'protect'
  | 'ocr'
  | 'spreadsheet'
  | 'image-optimizer'
  | 'code-generator'
  | 'mail-merge'
  | 'media'
  | 'background-remover'
  | 'bulk-ocr'
  | 'calculator'
  | 'games'
  | 'convert-documents';

export interface ToolMetadata {
  id: ToolId;
  title: string;
  shortDesc: string;
  category: 'organize' | 'convert' | 'edit' | 'security' | 'office' | 'media' | 'games';
  badge?: string;
  popular?: boolean;
}

export interface PDFFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  lastModified: number;
  pageCount?: number;
}

export interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export interface ProcessTelemetry {
  current: number;
  total: number;
  pagesProcessed: number;
  currentFileName: string;
  speedPagesPerSec: number;
  elapsedSeconds: number;
  etaSeconds: number | null;
}

export interface ProcessResult {
  blob: Blob;
  fileName: string;
  totalPages?: number;
  totalFiles?: number;
  originalSize?: number;
  resultSize?: number;
  elapsedSeconds: number;
  speedPagesPerSec: number;
  skippedFiles?: { name: string; error: string }[];
}

export interface PageThumbnailItem {
  pageNumber: number; // 1-based index
  originalPageNumber: number;
  rotation: number; // 0, 90, 180, 270
  sourceFileIndex?: number;
  thumbnailUrl?: string;
  deleted?: boolean;
}

// Split configuration
export type SplitMode = 'range' | 'fixed' | 'all';
export interface SplitOptions {
  mode: SplitMode;
  rangeString: string; // e.g. "1-5, 8, 10-15"
  fixedPageCount: number; // e.g. every 2 pages
  autoZip: boolean;
}

// Compress configuration
export type CompressionLevel = 'low' | 'medium' | 'extreme';
export interface CompressOptions {
  level: CompressionLevel;
  targetDpi: number;
  jpegQuality: number;
}

// Watermark configuration
export type WatermarkType = 'text' | 'image';
export type WatermarkPosition = 'center' | 'top' | 'bottom' | 'diagonal';
export interface WatermarkOptions {
  type: WatermarkType;
  text: string;
  fontSize: number;
  opacity: number; // 0.1 to 1.0
  rotation: number; // in degrees
  color: string;
  position: WatermarkPosition;
  textX?: number;
  textY?: number;
  imageFile?: File;
  pageNumberX?: number;
  pageNumberY?: number;
  // Page numbers config
  enablePageNumbers: boolean;
  pageNumberFormat: '{n}' | 'Halaman {n}' | '{n} / {total}' | 'Halaman {n} dari {total}';
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'top-right';
}

// Protect & Redact configuration
export type SecurityMode = 'protect' | 'unlock' | 'redact';
export interface SecurityOptions {
  mode: SecurityMode;
  password?: string;
  reason?: string;
  redactPages?: number[];
}

// Signature configuration
export interface SignatureStamp {
  type: 'draw' | 'image' | 'text';
  dataUrl: string; // Base64 PNG
  text?: string;
  pageNumber: number; // 1-based
  x: number; // Center position as a percentage of the page
  y: number;
  width: number; // Size as a percentage of page dimensions
  height: number;
}
