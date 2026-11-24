import type { ToolId } from '../types';

interface ToolFileFormat {
  label: string;
  color: string;
}

const TOOL_FILE_FORMATS: Record<ToolId, ToolFileFormat> = {
  merge: { label: 'PDF', color: 'pdf' },
  split: { label: 'ZIP', color: 'zip' },
  organize: { label: 'PDF', color: 'pdf' },
  crop: { label: 'PDF', color: 'pdf' },
  sign: { label: 'PDF', color: 'pdf' },
  compress: { label: 'PDF', color: 'pdf' },
  img2pdf: { label: 'PDF', color: 'pdf' },
  pdf2img: { label: 'ZIP', color: 'zip' },
  watermark: { label: 'PDF', color: 'pdf' },
  protect: { label: 'PDF', color: 'pdf' },
  ocr: { label: 'TXT', color: 'text' },
  spreadsheet: { label: 'XLSX / CSV', color: 'spreadsheet' },
  'image-optimizer': { label: 'JPG / PNG / WEBP', color: 'image' },
  'code-generator': { label: 'PDF', color: 'pdf' },
  'mail-merge': { label: 'DOCX / ZIP', color: 'document' },
  media: { label: 'MP4 / MP3', color: 'media' },
  'background-remover': { label: 'PNG', color: 'image' },
  'bulk-ocr': { label: 'TXT', color: 'text' },
  calculator: { label: 'CALC', color: 'text' },
  games: { label: 'PLAY', color: 'media' },
  'convert-documents': { label: 'PDF / DOCX / XLSX', color: 'document' },
};

export function getToolFileFormat(toolId: ToolId): ToolFileFormat {
  return TOOL_FILE_FORMATS[toolId];
}
