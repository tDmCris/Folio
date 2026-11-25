import type { SourceAttachment } from '../types/writing';

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'xml',
  'html',
  'yml',
  'yaml',
  'log',
]);

const BINARY_MIME_PREFIXES = ['image/', 'application/pdf'];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export async function parseFileToAttachment(file: File): Promise<SourceAttachment> {
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" exceeds the 10 MB attachment limit.`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type || (ext === 'pdf' ? 'application/pdf' : 'text/plain');
  const isBinaryMultimodal = BINARY_MIME_PREFIXES.some((prefix) =>
    mimeType.startsWith(prefix)
  );

  if (isBinaryMultimodal) {
    const base64Data = await readFileAsBase64(file);
    return {
      id: createId('src'),
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      addedAt: Date.now(),
      base64Data,
      previewText:
        mimeType === 'application/pdf'
          ? 'PDF document attached for multimodal reading'
          : 'Image attached for visual context',
    };
  }

  if (mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(ext) || mimeType === 'application/json') {
    const textContent = await file.text();
    const cleaned = textContent.replace(/\s+/g, ' ').trim();
    return {
      id: createId('src'),
      name: file.name,
      mimeType: mimeType || 'text/plain',
      sizeBytes: file.size,
      addedAt: Date.now(),
      textContent,
      previewText: cleaned.slice(0, 140) + (cleaned.length > 140 ? '…' : ''),
    };
  }

  throw new Error(
    `Unsupported file type "${file.name}". Attach Markdown, TXT, CSV, JSON, PDF, or images.`
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

export function documentToMarkdown(title: string, blocks: Array<{ type: string; text: string }>): string {
  const lines: string[] = [];
  if (title.trim()) {
    lines.push(`# ${title.trim()}`, '');
  }
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (block.type === 'heading') {
      lines.push(`## ${text}`, '');
    } else if (block.type === 'quote') {
      lines.push(`> ${text}`, '');
    } else {
      lines.push(text, '');
    }
  }
  return lines.join('\n').trim() + '\n';
}
