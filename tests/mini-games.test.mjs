import assert from 'node:assert/strict';
import test from 'node:test';
import {
  create2048Board,
  createSudoku,
  createZipPuzzle,
  extendZipPath,
  has2048Moves,
  move2048,
} from '../src/utils/mini-games.ts';

function assertSudokuSolution(solution) {
  assert.equal(solution.length, 81);
  const rows = Array.from({ length: 9 }, (_, row) => solution.slice(row * 9, row * 9 + 9));
  const columns = Array.from({ length: 9 }, (_, column) => solution.filter((_, index) => index % 9 === column));
  const boxes = [];
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      boxes.push(Array.from({ length: 9 }, (_, index) => (
        solution[(boxRow * 3 + Math.floor(index / 3)) * 9 + boxColumn * 3 + index % 3]
      )));
    }
  }
  for (const group of [...rows, ...columns, ...boxes]) {
    assert.deepEqual([...group].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
}

test('Sudoku rejects unknown difficulty and generates valid givens', () => {
  assert.throws(() => createSudoku('expert'), RangeError);
  for (const [difficulty, blanks] of [['Mudah', 34], ['Sedang', 43], ['Sulit', 51]]) {
    const puzzle = createSudoku(difficulty);
    assertSudokuSolution(puzzle.solution);
    assert.equal(puzzle.givens.filter((value) => value === 0).length, blanks);
    assert.ok(puzzle.givens.every((value, index) => value === 0 || value === puzzle.solution[index]));
  }
});

test('2048 rejects malformed boards and directions', () => {
  assert.throws(() => move2048(Array(15).fill(0), 'left'), RangeError);
  assert.throws(() => move2048([3, ...Array(15).fill(0)], 'left'), RangeError);
  assert.throws(() => move2048(Array(16).fill(0), 'diagonal'), RangeError);
  assert.throws(() => has2048Moves([0, -2, ...Array(14).fill(0)]), RangeError);
  assert.equal(create2048Board().filter((tile) => tile > 0).length, 2);
});

test('2048 leaves ineffective moves alone and does not merge a tile twice', () => {
  const stableBoard = [
    2, 4, 8, 16,
    4, 8, 16, 32,
    8, 16, 32, 64,
    16, 32, 64, 128,
  ];
  const unchanged = move2048(stableBoard, 'left');
  assert.equal(unchanged.moved, false);
  assert.equal(unchanged.points, 0);
  assert.equal(unchanged.board, stableBoard);

  const mergeBoard = [2, 2, 2, 2, ...Array(12).fill(0)];
  const merged = move2048(mergeBoard, 'left');
  assert.equal(merged.moved, true);
  assert.equal(merged.points, 8);
  assert.ok(merged.board.filter((tile) => tile === 4).length >= 2);
  assert.ok([10, 12].includes(merged.board.reduce((sum, tile) => sum + tile, 0)));
});

test('Zip rejects invalid levels and path cells while blocking jumps and revisits', () => {
  assert.throws(() => createZipPuzzle(0), RangeError);
  assert.throws(() => extendZipPath([0], 25, 5), RangeError);
  assert.throws(() => extendZipPath([0, 24], 1, 5), RangeError);
  assert.throws(() => extendZipPath([0, 1, 0], 5, 5), RangeError);
  const path = [0, 1];
  assert.equal(extendZipPath(path, 7, 5), path);
  assert.equal(extendZipPath(path, 0, 5)[0], 0);
  assert.deepEqual(extendZipPath(path, 2, 5), [0, 1, 2]);

  for (let level = 1; level <= 12; level += 1) {
    const puzzle = createZipPuzzle(level);
    assert.equal(puzzle.route.length, puzzle.size ** 2);
    assert.equal(new Set(puzzle.route).size, puzzle.route.length);
    for (let index = 1; index < puzzle.route.length; index += 1) {
      const previous = puzzle.route[index - 1];
      const current = puzzle.route[index];
      const distance = Math.abs(Math.floor(previous / puzzle.size) - Math.floor(current / puzzle.size)) +
        Math.abs((previous % puzzle.size) - (current % puzzle.size));
      assert.equal(distance, 1);
    }
  }
});
