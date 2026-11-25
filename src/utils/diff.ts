export interface DiffSegment {
  type: 'equal' | 'delete' | 'insert';
  value: string;
}

/**
 * Computes a clean word-and-whitespace preserving LCS diff between original
 * and revised prose so inline revisions read naturally like editorial redlines.
 */
export function computeWordDiff(original: string, revised: string): DiffSegment[] {
  if (original === revised) {
    return original ? [{ type: 'equal', value: original }] : [];
  }
  if (!original) {
    return revised ? [{ type: 'insert', value: revised }] : [];
  }
  if (!revised) {
    return [{ type: 'delete', value: original }];
  }

  const tokenize = (str: string) => str.match(/\S+|\s+/g) ?? [];
  const a = tokenize(original);
  const b = tokenize(revised);

  // Guard against extremely large paragraphs to keep diffing instantaneous (<5ms)
  if (a.length * b.length > 160000) {
    return [
      { type: 'delete', value: original },
      { type: 'insert', value: revised },
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i];
    const nextRow = dp[i + 1];
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        row[j] = nextRow[j + 1] + 1;
      } else {
        row[j] = nextRow[j] >= row[j + 1] ? nextRow[j] : row[j + 1];
      }
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: 'equal', value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'delete', value: a[i] });
      i++;
    } else {
      raw.push({ type: 'insert', value: b[j] });
      j++;
    }
  }

  while (i < m) {
    raw.push({ type: 'delete', value: a[i++] });
  }
  while (j < n) {
    raw.push({ type: 'insert', value: b[j++] });
  }

  // Merge adjacent segments of the same type for clean DOM rendering
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
