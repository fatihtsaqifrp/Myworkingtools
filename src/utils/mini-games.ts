export type SudokuDifficulty = 'Mudah' | 'Sedang' | 'Sulit';
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface SudokuPuzzle {
  solution: number[];
  givens: number[];
}

export interface ZipPuzzle {
  size: number;
  route: number[];
  checkpoints: number[];
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const EMPTY_2048 = Array<number>(16).fill(0);

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSudoku(difficulty: SudokuDifficulty): SudokuPuzzle {
  if (!['Mudah', 'Sedang', 'Sulit'].includes(difficulty)) {
    throw new RangeError('Tingkat Sudoku tidak dikenal.');
  }
  const bands = shuffled([0, 1, 2]);
  const rows = bands.flatMap((band) => shuffled([0, 1, 2]).map((row) => band * 3 + row));
  const stacks = shuffled([0, 1, 2]);
  const columns = stacks.flatMap((stack) => shuffled([0, 1, 2]).map((column) => stack * 3 + column));
  const digits = shuffled(DIGITS);
  const solution = rows.flatMap((row) => columns.map((column) => (
    digits[(row * 3 + Math.floor(row / 3) + column) % 9]
  )));
  const givens = [...solution];
  const blanks = difficulty === 'Mudah' ? 34 : difficulty === 'Sedang' ? 43 : 51;
  for (const index of shuffled(Array.from({ length: 81 }, (_, cell) => cell)).slice(0, blanks)) {
    givens[index] = 0;
  }
  return { solution, givens };
}

function assert2048Board(board: number[]) {
  if (
    board.length !== 16 ||
    board.some((value) => (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      (value !== 0 && !Number.isInteger(Math.log2(value)))
    ))
  ) {
    throw new RangeError('Papan 2048 harus berisi 16 ubin nol atau pangkat dua positif.');
  }
}

export function create2048Board(): number[] {
  return spawn2048(spawn2048(EMPTY_2048));
}

function spawn2048(board: number[]): number[] {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return board;
  const index = empty[Math.floor(Math.random() * empty.length)];
  const result = [...board];
  result[index] = Math.random() < 0.9 ? 2 : 4;
  return result;
}

export function move2048(board: number[], direction: Direction): { board: number[]; points: number; moved: boolean } {
  assert2048Board(board);
  if (!['left', 'right', 'up', 'down'].includes(direction)) {
    throw new RangeError('Arah gerak 2048 tidak dikenal.');
  }
  const next = [...board];
  let points = 0;

  for (let line = 0; line < 4; line += 1) {
    const indexes = Array.from({ length: 4 }, (_, step) => {
      if (direction === 'left') return line * 4 + step;
      if (direction === 'right') return line * 4 + (3 - step);
      if (direction === 'up') return step * 4 + line;
      return (3 - step) * 4 + line;
    });
    const values = indexes.map((index) => board[index]).filter((value) => value > 0);
    const merged: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === values[index + 1]) {
        const value = values[index] * 2;
        merged.push(value);
        points += value;
        index += 1;
      } else {
        merged.push(values[index]);
      }
    }
    indexes.forEach((index, step) => {
      next[index] = merged[step] ?? 0;
    });
  }

  const moved = next.some((value, index) => value !== board[index]);
  return { board: moved ? spawn2048(next) : board, points, moved };
}

export function has2048Moves(board: number[]): boolean {
  assert2048Board(board);
  return board.some((value, index) => (
    value === 0 ||
    (index % 4 < 3 && value === board[index + 1]) ||
    (index < 12 && value === board[index + 4])
  ));
}

export function createZipPuzzle(level: number): ZipPuzzle {
  assertPositiveInteger(level, 'Zip level');
  const size = Math.min(9, 5 + Math.floor((level - 1) / 2));
  const route: number[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let step = 0; step < size; step += 1) {
      route.push(row * size + (row % 2 === 0 ? step : size - 1 - step));
    }
  }

  const transpose = Math.random() < 0.5;
  const flipRows = Math.random() < 0.5;
  const flipColumns = Math.random() < 0.5;
  const transformed = route.map((cell) => {
    let row = Math.floor(cell / size);
    let column = cell % size;
    if (transpose) [row, column] = [column, row];
    if (flipRows) row = size - 1 - row;
    if (flipColumns) column = size - 1 - column;
    return row * size + column;
  });
  if (Math.random() < 0.5) transformed.reverse();

  const checkpointCount = Math.min(size, 9);
  const checkpoints = Array.from({ length: checkpointCount }, (_, index) => (
    transformed[Math.round(index * (transformed.length - 1) / (checkpointCount - 1))]
  ));
  return { size, route: transformed, checkpoints };
}

export function extendZipPath(path: number[], index: number, size: number): number[] {
  assertPositiveInteger(size, 'Zip board size');
  const isCellValid = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < size * size;
  if (!isCellValid(index)) {
    throw new RangeError('Kotak Zip berada di luar papan.');
  }
  if (new Set(path).size !== path.length || path.some((cell, pathIndex) => (
    !isCellValid(cell) ||
    (pathIndex > 0 && Math.abs(Math.floor(cell / size) - Math.floor(path[pathIndex - 1] / size)) +
      Math.abs((cell % size) - (path[pathIndex - 1] % size)) !== 1)
  ))) {
    throw new RangeError('Jalur Zip yang sudah dibuat tidak valid.');
  }
  if (!path.length || path[path.length - 1] === index) return path;
  const previousIndex = path[path.length - 1];
  const rowDistance = Math.abs(Math.floor(previousIndex / size) - Math.floor(index / size));
  const columnDistance = Math.abs((previousIndex % size) - (index % size));
  if (rowDistance + columnDistance !== 1) return path;
  if (path.length > 1 && path[path.length - 2] === index) return path.slice(0, -1);
  if (path.includes(index)) return path;
  return [...path, index];
}
