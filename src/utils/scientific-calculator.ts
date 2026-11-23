type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'left' | 'right' | 'comma'; value: string };

const FUNCTIONS: Record<string, (args: number[], degrees: boolean) => number> = {
  sin: ([value], degrees) => Math.sin(degrees ? value * Math.PI / 180 : value),
  cos: ([value], degrees) => Math.cos(degrees ? value * Math.PI / 180 : value),
  tan: ([value], degrees) => Math.tan(degrees ? value * Math.PI / 180 : value),
  asin: ([value], degrees) => {
    const result = Math.asin(value);
    return degrees ? result * 180 / Math.PI : result;
  },
  acos: ([value], degrees) => {
    const result = Math.acos(value);
    return degrees ? result * 180 / Math.PI : result;
  },
  atan: ([value], degrees) => {
    const result = Math.atan(value);
    return degrees ? result * 180 / Math.PI : result;
  },
  sqrt: ([value]) => Math.sqrt(value),
  cbrt: ([value]) => Math.cbrt(value),
  abs: ([value]) => Math.abs(value),
  ln: ([value]) => Math.log(value),
  log: ([value]) => Math.log10(value),
  log10: ([value]) => Math.log10(value),
  exp: ([value]) => Math.exp(value),
  floor: ([value]) => Math.floor(value),
  ceil: ([value]) => Math.ceil(value),
  round: ([value]) => Math.round(value),
  min: (values) => Math.min(...values),
  max: (values) => Math.max(...values),
};

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < expression.length) {
    if (/\s/.test(expression[position])) {
      position += 1;
      continue;
    }

    const rest = expression.slice(position);
    const numberMatch = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) });
      position += numberMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[a-z]+/i);
    if (identifierMatch) {
      tokens.push({ type: 'identifier', value: identifierMatch[0].toLowerCase() });
      position += identifierMatch[0].length;
      continue;
    }

    const character = expression[position];
    if ('+-*/^%!'.includes(character)) {
      tokens.push({ type: 'operator', value: character });
    } else if (character === '(') {
      tokens.push({ type: 'left', value: character });
    } else if (character === ')') {
      tokens.push({ type: 'right', value: character });
    } else if (character === ',') {
      tokens.push({ type: 'comma', value: character });
    } else {
      throw new Error(`Karakter tidak dikenal: ${character}`);
    }
    position += 1;
  }

  return tokens;
}

export function evaluateScientificExpression(expression: string, degrees: boolean, answer: number): number {
  const tokens = tokenize(expression);
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (type: Token['type'], value?: string) => {
    const token = take();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error('Periksa kembali penulisan ekspresi.');
    }
    return token;
  };

  const parseAdditive = (): number => {
    let value = parseMultiplicative();
    while (
      peek()?.type === 'operator' &&
      (peek()!.value === '+' || peek()!.value === '-')
    ) {
      const operator = take();
      if (operator?.type !== 'operator') throw new Error('Periksa kembali penulisan ekspresi.');
      const right = parseMultiplicative();
      value = operator.value === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseMultiplicative = (): number => {
    let value = parseUnary();
    while (true) {
      const token = peek();
      if (token?.type === 'operator' && ['*', '/'].includes(token.value)) {
        const operator = take()!.value;
        const right = parseUnary();
        value = operator === '*' ? value * right : value / right;
      } else if (
        token?.type === 'number' ||
        token?.type === 'identifier' ||
        token?.type === 'left'
      ) {
        value *= parseUnary();
      } else {
        return value;
      }
    }
  };

  const parseUnary = (): number => {
    if (
      peek()?.type === 'operator' &&
      (peek()!.value === '+' || peek()!.value === '-')
    ) {
      const sign = take();
      if (sign?.type !== 'operator') throw new Error('Periksa kembali penulisan ekspresi.');
      const value = parseUnary();
      return sign.value === '-' ? -value : value;
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePostfix();
    if (peek()?.type === 'operator' && peek()!.value === '^') {
      take();
      return base ** parseUnary();
    }
    return base;
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (
      peek()?.type === 'operator' &&
      (peek()!.value === '!' || peek()!.value === '%')
    ) {
      const operator = take();
      if (operator?.type !== 'operator') throw new Error('Periksa kembali penulisan ekspresi.');
      if (operator.value === '%') {
        value /= 100;
      } else {
        if (!Number.isInteger(value) || value < 0 || value > 170) {
          throw new Error('Faktorial hanya berlaku untuk bilangan bulat 0–170.');
        }
        for (let factor = value - 1; factor > 1; factor -= 1) value *= factor;
      }
    }
    return value;
  };

  const parsePrimary = (): number => {
    const token = take();
    if (!token) throw new Error('Ekspresi belum lengkap.');

    if (token.type === 'number') return token.value;
    if (token.type === 'left') {
      const value = parseAdditive();
      expect('right');
      return value;
    }
    if (token.type !== 'identifier') throw new Error('Periksa kembali penulisan ekspresi.');

    if (token.value === 'pi') return Math.PI;
    if (token.value === 'e') return Math.E;
    if (token.value === 'ans') return answer;

    const fn = FUNCTIONS[token.value];
    if (!fn) throw new Error(`Fungsi "${token.value}" tidak dikenal.`);
    expect('left');
    const args = [parseAdditive()];
    while (peek()?.type === 'comma') {
      take();
      args.push(parseAdditive());
    }
    expect('right');
    if ((token.value === 'min' || token.value === 'max') ? args.length < 2 : args.length !== 1) {
      throw new Error(token.value === 'min' || token.value === 'max'
        ? `${token.value} memerlukan minimal dua angka.`
        : `${token.value} memerlukan satu angka.`);
    }
    return fn(args, degrees);
  };

  if (!tokens.length) throw new Error('Masukkan ekspresi terlebih dahulu.');
  const result = parseAdditive();
  if (position !== tokens.length) throw new Error('Periksa kembali penulisan ekspresi.');
  if (!Number.isFinite(result)) throw new Error('Hasil tidak terdefinisi atau di luar jangkauan.');
  return Object.is(result, -0) ? 0 : result;
}
