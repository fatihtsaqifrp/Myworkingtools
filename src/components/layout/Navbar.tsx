import { Moon, Sun } from 'lucide-react';
import type { ToolId } from '../../types';
import { getToolFileFormat } from '../../utils/file-format';

interface NavbarProps {
  activeTool: ToolId | null;
  onSelectTool: (id: ToolId | null) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Navbar({ activeTool, onSelectTool, isDarkMode, onToggleDarkMode }: NavbarProps) {
  return (
    <header className="bg-transparent">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand with Courier Monospace Typography */}
        <button
          type="button"
          onClick={() => onSelectTool(null)}
          aria-label="fatihworkingtools - kembali ke semua alat"
          className="flex cursor-pointer items-center gap-2 select-none"
        >
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1 shadow-2xs transition hover:border-gray-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-blue-600" fill="none">
              <path d="M5 2.75h9l5 5v13.5H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M14 2.75v5h5M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m8 18 2 2 5-5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              className="text-sm font-bold tracking-tight text-gray-900"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
            >
              <span className="text-blue-600">fatih</span><span className="text-gray-900">working</span><span className="text-red-600">tools</span>
              <span className="text-red-600 animate-pulse">_</span>
            </span>
          </div>

          {activeTool ? (
            <span className={`format-chip format-chip-${getToolFileFormat(activeTool).color}`}>
              {getToolFileFormat(activeTool).label}
            </span>
          ) : (
            <div className="home-format-cloud" aria-label="Format file: PDF, XLSX, PNG, DOCX, dan MP3">
              <span className="home-format-file home-format-file-pdf">
                <svg aria-hidden="true" viewBox="0 0 30 34" className="h-8 w-7" fill="none">
                  <path d="M5 1.5h13l8 8v22a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-29a1 1 0 0 1 1-1Z" fill="white" stroke="#dc2626" strokeWidth="1.8" />
                  <path d="M18 1.5v8h8" stroke="#dc2626" strokeWidth="1.8" strokeLinejoin="round" />
                  <rect x="2" y="16" width="26" height="12" rx="3" fill="#dc2626" />
                  <text x="15" y="24.5" textAnchor="middle" fill="white" fontSize="6.8" fontWeight="800" fontFamily="ui-monospace, monospace">PDF</text>
                </svg>
                <span className="home-format-sparkle" aria-hidden="true">✦</span>
              </span>
              <span className="home-format-mini home-format-mini-xlsx">XLSX</span>
              <span className="home-format-mini home-format-mini-png">PNG</span>
              <span className="home-format-mini home-format-mini-docx">DOCX</span>
              <span className="home-format-mini home-format-mini-mp3">MP3</span>
            </div>
          )}
        </button>

        {/* Right Navigation */}
        <div className="flex items-center gap-3">
          {activeTool ? (
            <button
              onClick={() => onSelectTool(null)}
              className="text-xs font-mono font-semibold text-blue-600 hover:underline"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
            >
              ← [menu]
            </button>
          ) : (
            <span className="hidden sm:inline text-xs font-mono text-gray-400">
              Gabung · Pisah · Kompres · Konversi
            </span>
          )}
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={isDarkMode ? 'Mode terang' : 'Mode gelap'}
            className="theme-toggle inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {isDarkMode ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
