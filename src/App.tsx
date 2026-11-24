import { lazy, Suspense, useState } from 'react';
import { FileImage, FileText, Files, Minimize2, Scissors, ShieldCheck } from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ToolDashboard } from './components/tools/ToolDashboard';
import type { ToolId } from './types';

const MergeTool = lazy(() => import('./components/tools/MergeTool').then((module) => ({ default: module.MergeTool })));
const SplitTool = lazy(() => import('./components/tools/SplitTool').then((module) => ({ default: module.SplitTool })));
const OrganizeTool = lazy(() => import('./components/tools/OrganizeTool').then((module) => ({ default: module.OrganizeTool })));
const CropTool = lazy(() => import('./components/tools/CropTool').then((module) => ({ default: module.CropTool })));
const SignStampTool = lazy(() => import('./components/tools/SignStampTool').then((module) => ({ default: module.SignStampTool })));
const CompressTool = lazy(() => import('./components/tools/CompressTool').then((module) => ({ default: module.CompressTool })));
const ImagePdfTool = lazy(() => import('./components/tools/ImagePdfTool').then((module) => ({ default: module.ImagePdfTool })));
const WatermarkTool = lazy(() => import('./components/tools/WatermarkTool').then((module) => ({ default: module.WatermarkTool })));
const ProtectTool = lazy(() => import('./components/tools/ProtectTool').then((module) => ({ default: module.ProtectTool })));
const OcrTool = lazy(() => import('./components/tools/OcrTool').then((module) => ({ default: module.OcrTool })));
const SpreadsheetTool = lazy(() => import('./components/tools/office/SpreadsheetTool').then((module) => ({ default: module.SpreadsheetTool })));
const ImageOptimizerTool = lazy(() => import('./components/tools/office/ImageOptimizerTool').then((module) => ({ default: module.ImageOptimizerTool })));
const CodeGeneratorTool = lazy(() => import('./components/tools/office/CodeGeneratorTool').then((module) => ({ default: module.CodeGeneratorTool })));
const MailMergeTool = lazy(() => import('./components/tools/office/MailMergeTool').then((module) => ({ default: module.MailMergeTool })));
const MediaTool = lazy(() => import('./components/tools/office/MediaTool').then((module) => ({ default: module.MediaTool })));
const AIStudioTool = lazy(() => import('./components/tools/office/AIStudioTool').then((module) => ({ default: module.AIStudioTool })));
const DocumentConverterTool = lazy(() => import('./components/tools/DocumentConverterTool').then((module) => ({ default: module.DocumentConverterTool })));
const ScientificCalculatorTool = lazy(() => import('./components/tools/ScientificCalculatorTool').then((module) => ({ default: module.ScientificCalculatorTool })));
const PlayGamesTool = lazy(() => import('./components/tools/PlayGamesTool').then((module) => ({ default: module.PlayGamesTool })));

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [dashboardGroup, setDashboardGroup] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className={`app-shell isolate flex min-h-screen flex-col justify-between text-gray-900 ${isDarkMode ? 'theme-dark' : ''}`}>
      <div aria-hidden="true" className="app-background-icons">
        <FileText className="background-tool-icon background-icon-one absolute left-[9%] top-[15%] h-7 w-7 text-blue-500" />
        <Scissors className="background-tool-icon background-icon-two absolute left-[49%] top-[11%] h-6 w-6 text-violet-500" />
        <Minimize2 className="background-tool-icon background-icon-three absolute right-[9%] top-[36%] h-7 w-7 text-emerald-500" />
        <ShieldCheck className="background-tool-icon background-icon-four absolute bottom-[8%] left-[42%] h-7 w-7 text-cyan-600" />
        <FileImage className="background-tool-icon background-icon-five absolute bottom-[13%] right-[31%] h-6 w-6 text-orange-500" />
        <Files className="background-tool-icon background-icon-six absolute right-[16%] top-[72%] h-7 w-7 text-blue-500" />
      </div>
      {/* Top Navigation */}
      <Navbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((darkMode) => !darkMode)}
      />

      {/* Main Content Area */}
      <main className={`relative z-10 mx-auto w-full flex-1 ${activeTool ? 'max-w-5xl px-4 py-6 sm:px-6' : 'pb-6'}`}>
        {activeTool ? (
          <div className="space-y-4">
            {/* Back Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                ← Kembali ke Semua Alat
              </button>
            </div>

            {/* Active Tool View */}
            <Suspense fallback={<div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500" role="status">Memuat alat...</div>}>
              <div className="mt-2">
              {activeTool === 'merge' && <MergeTool />}
              {activeTool === 'split' && <SplitTool />}
              {activeTool === 'organize' && <OrganizeTool />}
              {activeTool === 'crop' && <CropTool />}
              {activeTool === 'sign' && <SignStampTool />}
              {activeTool === 'compress' && <CompressTool />}
              {(activeTool === 'img2pdf' || activeTool === 'pdf2img') && <ImagePdfTool />}
              {activeTool === 'watermark' && <WatermarkTool />}
              {activeTool === 'protect' && <ProtectTool />}
              {activeTool === 'ocr' && <OcrTool />}
              {activeTool === 'spreadsheet' && <SpreadsheetTool />}
              {activeTool === 'image-optimizer' && <ImageOptimizerTool />}
              {activeTool === 'code-generator' && <CodeGeneratorTool />}
              {activeTool === 'mail-merge' && <MailMergeTool />}
              {activeTool === 'media' && <MediaTool />}
              {activeTool === 'background-remover' && <AIStudioTool initialMode="background" />}
              {activeTool === 'bulk-ocr' && <AIStudioTool initialMode="ocr" />}
              {activeTool === 'convert-documents' && <DocumentConverterTool />}
              {activeTool === 'calculator' && <ScientificCalculatorTool />}
              {activeTool === 'games' && <PlayGamesTool />}
              </div>
            </Suspense>
          </div>
        ) : (
          <ToolDashboard onSelectTool={setActiveTool} activeGroup={dashboardGroup} onActiveGroupChange={setDashboardGroup} />
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
