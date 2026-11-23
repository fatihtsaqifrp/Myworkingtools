import { useState } from 'react';
import { evaluateScientificExpression } from '../../utils/scientific-calculator';

interface Calculation {
  expression: string;
  result: number;
}

const SCIENTIFIC_BUTTONS = [
  { label: 'sin', insert: 'sin(', tone: 'function' },
  { label: 'cos', insert: 'cos(', tone: 'function' },
  { label: 'tan', insert: 'tan(', tone: 'function' },
  { label: 'ln', insert: 'ln(', tone: 'function' },
  { label: 'log', insert: 'log(', tone: 'function' },
  { label: '√', insert: 'sqrt(', tone: 'function' },
  { label: 'asin', insert: 'asin(', tone: 'function' },
  { label: 'acos', insert: 'acos(', tone: 'function' },
  { label: 'atan', insert: 'atan(', tone: 'function' },
  { label: 'π', insert: 'pi', tone: 'function' },
  { label: 'e', insert: 'e', tone: 'function' },
  { label: 'xʸ', insert: '^', tone: 'function' },
  { label: '(', insert: '(', tone: 'function' },
  { label: ')', insert: ')', tone: 'function' },
  { label: 'x!', insert: '!', tone: 'function' },
  { label: '%', insert: '%', tone: 'function' },
 ] as const;

const KEYPAD_BUTTONS = [
  { label: '7', insert: '7', tone: 'number' },
  { label: '8', insert: '8', tone: 'number' },
  { label: '9', insert: '9', tone: 'number' },
  { label: '÷', insert: '/', tone: 'operator' },
  { label: '4', insert: '4', tone: 'number' },
  { label: '5', insert: '5', tone: 'number' },
  { label: '6', insert: '6', tone: 'number' },
  { label: '×', insert: '*', tone: 'operator' },
  { label: '1', insert: '1', tone: 'number' },
  { label: '2', insert: '2', tone: 'number' },
  { label: '3', insert: '3', tone: 'number' },
  { label: '−', insert: '-', tone: 'operator' },
  { label: '±', action: 'sign', tone: 'operator' },
  { label: '0', insert: '0', tone: 'number' },
  { label: '.', insert: '.', tone: 'number' },
  { label: '+', insert: '+', tone: 'operator' },
] as const;

const UTILITY_BUTTONS = [
  { label: 'AC', action: 'clear', tone: 'utility' },
  { label: '⌫', action: 'delete', tone: 'utility', ariaLabel: 'Hapus karakter terakhir' },
  { label: 'Ans', insert: 'ans', tone: 'function' },
] as const;

type CalculatorButton =
  | (typeof SCIENTIFIC_BUTTONS)[number]
  | (typeof KEYPAD_BUTTONS)[number]
  | (typeof UTILITY_BUTTONS)[number];

function formatResult(value: number): string {
  return Number(value.toPrecision(12)).toString();
}

export function ScientificCalculatorTool() {
  const [expression, setExpression] = useState('');
  const [degrees, setDegrees] = useState(true);
  const [answer, setAnswer] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Calculation[]>([]);

  const append = (value: string) => {
    setExpression((current) => current + value);
    setResult(null);
    setError(null);
  };

  const calculate = (input = expression) => {
    try {
      const value = evaluateScientificExpression(input, degrees, answer);
      setResult(value);
      setAnswer(value);
      setError(null);
      setHistory((current) => [{ expression: input, result: value }, ...current].slice(0, 8));
    } catch (calculationError) {
      setResult(null);
      setError(calculationError instanceof Error ? calculationError.message : 'Ekspresi tidak valid.');
    }
  };

  const handleButton = (button: CalculatorButton) => {
    if ('action' in button) {
      if (button.action === 'clear') {
        setExpression('');
        setResult(null);
        setError(null);
      } else if (button.action === 'delete') {
        setExpression((current) => current.slice(0, -1));
        setResult(null);
        setError(null);
      } else {
        setExpression((current) => {
          if (!current) return '-';
          if (current.startsWith('-(') && current.endsWith(')')) return current.slice(2, -1);
          return `-(${current})`;
        });
        setResult(null);
        setError(null);
      }
      return;
    }
    if (button.insert === 'ans') {
      append('ans');
      return;
    }
    if (button.insert === '!') {
      append('!');
      return;
    }
    append(button.insert);
  };

  const buttonClass = (button: CalculatorButton) => {
    const base = 'min-h-12 rounded-xl px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]';
    if (button.tone === 'function') return `${base} border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100`;
    if (button.tone === 'operator') return `${base} border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100`;
    if (button.tone === 'utility') return `${base} border border-red-100 bg-red-50 text-red-700 hover:bg-red-100`;
    return `${base} border border-gray-200 bg-white text-gray-900 hover:bg-gray-50`;
  };

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Scientific Calculator</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Hitung ekspresi matematika langsung di browser. Mendukung trigonometri, logaritma, pangkat, faktorial, dan konstanta.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode sudut</span>
            <div className="inline-flex rounded-lg bg-gray-100 p-1" role="group" aria-label="Mode sudut">
              {(['DEG', 'RAD'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={degrees === (mode === 'DEG')}
                  onClick={() => setDegrees(mode === 'DEG')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${degrees === (mode === 'DEG') ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <label className="block rounded-xl border border-gray-200 bg-gray-50 p-4">
            <span className="sr-only">Ekspresi matematika</span>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={expression}
              onChange={(event) => {
                setExpression(event.target.value);
                setResult(null);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  calculate();
                } else if (event.key === 'Escape') {
                  setExpression('');
                  setResult(null);
                  setError(null);
                }
              }}
              placeholder="Contoh: sin(30) + 2^3"
              aria-label="Ekspresi matematika"
              className="w-full bg-transparent text-right font-mono text-lg text-gray-700 outline-none placeholder:text-sm placeholder:text-gray-400 sm:text-xl"
            />
            <div className="mt-3 min-h-9 text-right font-mono text-2xl font-bold text-gray-950 sm:text-3xl" aria-live="polite">
              {result === null ? <span className="text-gray-300">=</span> : formatResult(result)}
            </div>
            {error && <p className="mt-2 text-right text-xs text-red-600" role="alert">{error}</p>}
          </label>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {SCIENTIFIC_BUTTONS.map((button) => (
              <button
                key={button.label}
                type="button"
                aria-label={button.label}
                onClick={() => handleButton(button)}
                className={buttonClass(button)}
              >
                {button.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {KEYPAD_BUTTONS.map((button) => (
              <button
                key={button.label}
                type="button"
                aria-label={button.label}
                onClick={() => handleButton(button)}
                className={buttonClass(button)}
              >
                {button.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {UTILITY_BUTTONS.map((button) => (
              <button
                key={button.label}
                type="button"
                aria-label={'ariaLabel' in button ? button.ariaLabel : button.label}
                onClick={() => handleButton(button)}
                className={buttonClass(button)}
              >
                {button.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => calculate()}
              className="min-h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.99]"
            >
              Hitung =
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400">Tekan Enter untuk menghitung, Esc untuk menghapus.</p>
        </div>

        <aside className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Riwayat</h2>
            {history.length > 0 && (
              <button type="button" onClick={() => setHistory([])} className="text-xs font-medium text-blue-600 hover:underline">
                Hapus
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs leading-5 text-gray-400">Hasil perhitungan akan muncul di sini.</p>
          ) : (
            <ol className="space-y-1">
              {history.map((item, index) => (
                <li key={`${item.expression}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setExpression(item.expression);
                      setResult(item.result);
                      setError(null);
                    }}
                    className="w-full rounded-lg p-2 text-left transition hover:bg-gray-50"
                  >
                    <span className="block truncate font-mono text-[11px] text-gray-500">{item.expression}</span>
                    <span className="mt-1 block truncate text-sm font-semibold text-gray-900">{formatResult(item.result)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
