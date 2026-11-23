import { useEffect, useRef, useState } from 'react';
import {
  create2048Board,
  createSudoku,
  createZipPuzzle,
  extendZipPath,
  has2048Moves,
  move2048,
  type Direction,
  type SudokuDifficulty,
  type SudokuPuzzle,
  type ZipPuzzle,
} from '../../utils/mini-games';

type GameMode = 'sudoku' | '2048' | 'zip';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function PlayGamesTool() {
  const [game, setGame] = useState<GameMode>('sudoku');
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('Mudah');
  const [puzzle, setPuzzle] = useState(() => createSudoku('Mudah'));
  const [sudokuBoard, setSudokuBoard] = useState(() => [...puzzle.givens]);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [board2048, setBoard2048] = useState(create2048Board);
  const [score2048, setScore2048] = useState(0);
  const [best2048, setBest2048] = useState(0);
  const [zipLevel, setZipLevel] = useState(1);
  const [zipPuzzle, setZipPuzzle] = useState(() => createZipPuzzle(1));
  const [zipPath, setZipPath] = useState<number[]>([]);
  const zipDrawingRef = useRef(false);

  const sudokuWon = sudokuBoard.every((value, index) => value === puzzle.solution[index]);
  const has2048Won = board2048.some((value) => value >= 2048);
  const gameOver2048 = !has2048Moves(board2048);
  const zipWon = zipPath.length === zipPuzzle.route.length && zipPuzzle.route.every((cell, index) => zipPath[index] === cell);

  useEffect(() => {
    if (game !== 'sudoku' || sudokuWon) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [game, sudokuWon]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (game === 'sudoku') {
        if (selectedCell === null) return;
        if (/^[1-9]$/.test(event.key)) {
          if (puzzle.givens[selectedCell] !== 0) return;
          event.preventDefault();
          enterSudokuDigit(Number(event.key));
        } else if (event.key === 'Backspace' || event.key === 'Delete') {
          if (puzzle.givens[selectedCell] !== 0) return;
          event.preventDefault();
          enterSudokuDigit(0);
        } else if (event.key.startsWith('Arrow')) {
          event.preventDefault();
          const row = Math.floor(selectedCell / 9);
          const column = selectedCell % 9;
          const nextRow = (row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? 8 : 0)) % 9;
          const nextColumn = (column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? 8 : 0)) % 9;
          setSelectedCell(nextRow * 9 + nextColumn);
        }
      } else if (game === '2048') {
        const directions: Record<string, Direction> = {
          ArrowLeft: 'left',
          ArrowRight: 'right',
          ArrowUp: 'up',
          ArrowDown: 'down',
        };
        const direction = directions[event.key];
        if (direction) {
          event.preventDefault();
          play2048(direction);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function enterSudokuDigit(digit: number) {
    if (selectedCell === null || puzzle.givens[selectedCell] !== 0 || sudokuWon) return;
    setSudokuBoard((current) => {
      const next = [...current];
      next[selectedCell] = digit;
      return next;
    });
    if (digit !== 0 && digit !== puzzle.solution[selectedCell]) setMistakes((value) => value + 1);
  }

  function startNewSudoku(nextDifficulty = difficulty) {
    const nextPuzzle = createSudoku(nextDifficulty);
    setDifficulty(nextDifficulty);
    setPuzzle(nextPuzzle);
    setSudokuBoard([...nextPuzzle.givens]);
    setSelectedCell(null);
    setSeconds(0);
    setMistakes(0);
    setHints(0);
  }

  function play2048(direction: Direction) {
    if (gameOver2048) return;
    const move = move2048(board2048, direction);
    if (!move.moved) return;
    setBoard2048(move.board);
    const nextScore = score2048 + move.points;
    setScore2048(nextScore);
    setBest2048((best) => Math.max(best, nextScore));
  }

  function reset2048() {
    setBoard2048(create2048Board());
    setScore2048(0);
  }

  function handleZipPathExtension(index: number) {
    if (!zipDrawingRef.current) return;
    setZipPath((current) => extendZipPath(current, index, zipPuzzle.size));
  }

  function startZipPath(index: number) {
    if (index !== zipPuzzle.route[0]) return;
    zipDrawingRef.current = true;
    setZipPath([index]);
  }

  function resetZip() {
    zipDrawingRef.current = false;
    setZipPath([]);
  }

  function nextZipLevel() {
    const nextLevel = zipLevel + 1;
    setZipLevel(nextLevel);
    setZipPuzzle(createZipPuzzle(nextLevel));
    setZipPath([]);
  }

  const cellIsConflicting = (index: number) => {
    const value = sudokuBoard[index];
    if (!value) return false;
    const row = Math.floor(index / 9);
    const column = index % 9;
    return sudokuBoard.some((other, otherIndex) => {
      if (otherIndex === index || other !== value) return false;
      const otherRow = Math.floor(otherIndex / 9);
      const otherColumn = otherIndex % 9;
      return otherRow === row ||
        otherColumn === column ||
        (Math.floor(otherRow / 3) === Math.floor(row / 3) && Math.floor(otherColumn / 3) === Math.floor(column / 3));
    });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Mini Games</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">Main sebentar, langsung di browser. Progres game berjalan di perangkat ini.</p>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
        {([
          ['sudoku', 'Sudoku'],
          ['2048', '2048'],
          ['zip', 'Zip'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setGame(id)} aria-pressed={game === id} className={`min-w-fit flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${game === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {game === 'sudoku' ? (
        <div className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sudoku</h2>
                <p className="text-xs text-gray-500">Isi angka 1–9 tanpa pengulangan di baris, kolom, dan kotak.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                Level
                <select value={difficulty} onChange={(event) => startNewSudoku(event.target.value as SudokuDifficulty)} className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800">
                  <option>Mudah</option>
                  <option>Sedang</option>
                  <option>Sulit</option>
                </select>
              </label>
            </div>

            <div className="mx-auto grid aspect-square w-full max-w-[32rem] grid-cols-9 overflow-hidden rounded-lg border-2 border-gray-800" role="grid" aria-label="Papan Sudoku">
              {sudokuBoard.map((value, index) => {
                const row = Math.floor(index / 9);
                const column = index % 9;
                const isSelected = selectedCell === index;
                const selectedValue = selectedCell === null ? 0 : sudokuBoard[selectedCell];
                const related = selectedCell !== null &&
                  (Math.floor(selectedCell / 9) === row ||
                    selectedCell % 9 === column ||
                    (Math.floor(Math.floor(selectedCell / 9) / 3) === Math.floor(row / 3) &&
                      Math.floor((selectedCell % 9) / 3) === Math.floor(column / 3)));
                const sameNumber = selectedValue !== 0 && selectedValue === value;
                const conflict = cellIsConflicting(index) || (value !== 0 && value !== puzzle.solution[index]);
                return (
                  <button
                    key={index}
                    type="button"
                    role="gridcell"
                    aria-label={`Baris ${row + 1}, kolom ${column + 1}${value ? `, ${value}` : ', kosong'}${puzzle.givens[index] ? ', angka tetap' : ''}`}
                    aria-selected={isSelected}
                    onClick={() => setSelectedCell(index)}
                    className={`relative flex aspect-square items-center justify-center border border-gray-200 text-sm font-semibold sm:text-xl ${
                      isSelected ? 'z-10 bg-blue-200 ring-2 ring-inset ring-blue-600' :
                        conflict ? 'bg-red-100 text-red-700' :
                          sameNumber ? 'bg-blue-100 text-blue-800' :
                            related ? 'bg-gray-100 text-gray-700' :
                              puzzle.givens[index] ? 'bg-white text-gray-900' : 'bg-white text-blue-700 hover:bg-blue-50'
                    } ${column === 2 || column === 5 ? 'border-r-2 border-r-gray-700' : ''} ${
                      row === 2 || row === 5 ? 'border-b-2 border-b-gray-700' : ''
                    }`}
                  >
                    {value || ''}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
              {DIGITS.map((digit) => (
                <button key={digit} type="button" onClick={() => enterSudokuDigit(digit)} disabled={selectedCell === null || (selectedCell !== null && puzzle.givens[selectedCell] !== 0) || sudokuWon} className="aspect-square rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg">
                  {digit}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500">Klik sel lalu angka, atau gunakan tombol 1–9 di keyboard.</p>
              <button type="button" onClick={() => enterSudokuDigit(0)} disabled={selectedCell === null || (selectedCell !== null && puzzle.givens[selectedCell] !== 0)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Hapus angka
              </button>
            </div>

            {sudokuWon && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800" role="status">
                Sudoku selesai dalam {formatTime(seconds)}! 🎉
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <div className="rounded-xl bg-gray-50 p-3">
                <span className="text-xs text-gray-500">Waktu</span>
                <p className="mt-1 font-mono text-xl font-bold text-gray-900">{formatTime(seconds)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <span className="text-xs text-gray-500">Kesalahan</span>
                <p className="mt-1 text-xl font-bold text-gray-900">{mistakes}</p>
              </div>
            </div>
            <button type="button" disabled={selectedCell === null || (selectedCell !== null && puzzle.givens[selectedCell] !== 0) || sudokuWon} onClick={() => {
              if (selectedCell === null) return;
              setSudokuBoard((current) => current.map((value, index) => index === selectedCell ? puzzle.solution[index] : value));
              setHints((value) => value + 1);
            }} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40">
              Petunjuk {hints ? `(${hints})` : ''}
            </button>
            <button type="button" onClick={() => startNewSudoku()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              Puzzle baru
            </button>
            <p className="text-xs leading-5 text-gray-500">Angka merah menandakan jawaban keliru atau melanggar aturan. Pilih sel kosong untuk mengisi atau meminta petunjuk.</p>
          </aside>
        </div>
      ) : game === '2048' ? (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">2048</h2>
              <p className="text-xs text-gray-500">Gabungkan ubin sampai mencapai 2048.</p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="rounded-lg bg-gray-100 px-3 py-2">
                <span className="block text-[10px] font-semibold uppercase text-gray-500">Skor</span>
                <span className="font-mono text-sm font-bold text-gray-900">{score2048}</span>
              </div>
              <div className="rounded-lg bg-gray-100 px-3 py-2">
                <span className="block text-[10px] font-semibold uppercase text-gray-500">Terbaik</span>
                <span className="font-mono text-sm font-bold text-gray-900">{best2048}</span>
              </div>
            </div>
          </div>

          <div className="relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-gray-300 p-2 sm:gap-3 sm:p-3" role="grid" aria-label="Papan 2048">
            {board2048.map((value, index) => (
              <div key={index} role="gridcell" aria-label={value ? `Ubin ${value}` : 'Kosong'} className={`flex items-center justify-center rounded-lg font-bold transition-all duration-100 ${value === 0 ? 'bg-gray-200' : value <= 4 ? 'bg-amber-100 text-amber-900' : value <= 16 ? 'bg-amber-300 text-amber-950' : value <= 64 ? 'bg-orange-400 text-white' : value <= 256 ? 'bg-orange-500 text-white' : value <= 1024 ? 'bg-rose-500 text-white' : 'bg-violet-600 text-white'} text-xl sm:text-3xl`}>
                {value || ''}
              </div>
            ))}
            {(gameOver2048 || has2048Won) && (
              <div className="absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/90 p-4 text-center sm:inset-3" role="status">
                <p className="text-xl font-bold text-gray-900">{gameOver2048 ? 'Game selesai' : 'Kamu mencapai 2048! 🎉'}</p>
                <button type="button" onClick={reset2048} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Main lagi
                </button>
              </div>
            )}
          </div>

          <div className="mx-auto grid w-36 grid-cols-3 gap-1.5" aria-label="Kontrol arah">
            <span />
            <DirectionButton direction="up" onMove={play2048} />
            <span />
            <DirectionButton direction="left" onMove={play2048} />
            <DirectionButton direction="down" onMove={play2048} />
            <DirectionButton direction="right" onMove={play2048} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Gunakan tombol panah keyboard atau kontrol arah.</p>
            <button type="button" onClick={reset2048} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              Game baru
            </button>
          </div>
        </div>
      ) : game === 'zip' ? (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Zip</h2>
              <p className="text-xs leading-5 text-gray-500">Hubungkan titik berurutan dengan satu garis. Isi semua kotak tanpa mengulang atau melompat.</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Level {zipLevel}</span>
              <button type="button" onClick={resetZip} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Ulang</button>
            </div>
          </header>
          <div
            className="relative grid aspect-square gap-1 rounded-xl bg-slate-100 p-2 touch-none sm:gap-2 sm:p-3"
            style={{ gridTemplateColumns: `repeat(${zipPuzzle.size}, minmax(0, 1fr))` }}
            role="grid"
            aria-label={`Papan Zip level ${zipLevel}, ${zipPuzzle.size} kali ${zipPuzzle.size}`}
            onPointerUp={() => { zipDrawingRef.current = false; }}
            onPointerCancel={() => { zipDrawingRef.current = false; }}
          >
            {Array.from({ length: zipPuzzle.size * zipPuzzle.size }, (_, index) => {
              const pathIndex = zipPath.indexOf(index);
              const checkpoint = zipPuzzle.checkpoints.indexOf(index);
              return (
                <button
                  key={index}
                  type="button"
                  role="gridcell"
                  aria-label={`Kotak ${index + 1}${checkpoint >= 0 ? `, titik ${checkpoint + 1}` : ''}${pathIndex >= 0 ? ', pada jalur' : ''}`}
                  onPointerDown={() => startZipPath(index)}
                  onPointerEnter={() => handleZipPathExtension(index)}
                  onPointerMove={() => handleZipPathExtension(index)}
                  className={`relative flex aspect-square items-center justify-center rounded-md border text-xs font-bold transition sm:rounded-lg sm:text-sm ${
                    pathIndex >= 0 ? 'border-blue-700 bg-blue-600 text-white' : checkpoint >= 0 ? 'border-slate-400 bg-white text-slate-900' : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {checkpoint >= 0 ? checkpoint + 1 : pathIndex >= 0 ? '•' : ''}
                </button>
              );
            })}
            {zipWon && (
              <div className="absolute inset-2 flex flex-col items-center justify-center gap-3 rounded-lg bg-emerald-500/95 p-4 text-center text-lg font-bold text-white" role="status">
                Level selesai. Keren! 🎉
                <button type="button" onClick={nextZipLevel} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                  Level berikutnya
                </button>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-gray-500">Mulai dari titik 1, lalu tahan dan geser ke kotak berikutnya. Papan membesar tiap dua level.</p>
        </div>
      ) : null}
    </section>
  );
}

function DirectionButton({ direction, onMove }: { direction: Direction; onMove: (direction: Direction) => void }) {
  const labels: Record<Direction, string> = { up: '↑', down: '↓', left: '←', right: '→' };
  return (
    <button type="button" aria-label={`Geser ${direction}`} onClick={() => onMove(direction)} className="h-10 rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700">
      {labels[direction]}
    </button>
  );
}
