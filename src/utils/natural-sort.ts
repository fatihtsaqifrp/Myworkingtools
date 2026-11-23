export function naturalSort<T>(items: T[], keyFn: (item: T) => string, direction: 'asc' | 'desc' = 'asc'): T[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  return [...items].sort((a, b) => {
    const valA = keyFn(a);
    const valB = keyFn(b);
    return direction === 'asc' ? collator.compare(valA, valB) : collator.compare(valB, valA);
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} detik`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  return `${mins} menit ${remSecs} detik`;
}

