import React, { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Trash2, X } from 'lucide-react';
import type { SourceAttachment } from '../types/writing';
import { createId, formatFileSize, parseFileToAttachment } from '../utils/files';

interface DraftComposerModalProps {
  isOpen: boolean;
  isGenerating: boolean;
  error?: string | null;
  onClose: () => void;
  onGenerateDraft: (params: {
    prompt: string;
    format: string;
    tone: string;
    length: string;
    attachments: SourceAttachment[];
  }) => void;
  onStartBlank: (attachments: SourceAttachment[]) => void;
}

const FORMATS = ['Essay', 'Article', 'Memo', 'Newsletter', 'Post'];
const TONES = ['Sharp & Direct', 'Thoughtful', 'Conversational', 'Executive'];
const LENGTHS = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Long' },
];

export const DraftComposerModal: React.FC<DraftComposerModalProps> = ({
  isOpen,
  isGenerating,
  error,
  onClose,
  onGenerateDraft,
  onStartBlank,
}) => {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState('Essay');
  const [tone, setTone] = useState('Sharp & Direct');
  const [length, setLength] = useState('medium');
  const [attachments, setAttachments] = useState<SourceAttachment[]>([]);
  const [pastedNote, setPastedNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileError(null);
    const parsed: SourceAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const attachment = await parseFileToAttachment(file);
        parsed.push(attachment);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'Failed to read file.');
      }
    }
    if (parsed.length > 0) {
      setAttachments((prev) => [...prev, ...parsed]);
    }
  };

  const handleAddPastedNote = () => {
    const trimmed = pastedNote.trim();
    if (!trimmed) return;
    setAttachments((prev) => [
      ...prev,
      {
        id: createId('src'),
        name: `Reference Note ${prev.length + 1}.txt`,
        mimeType: 'text/plain',
        sizeBytes: new Blob([trimmed]).size,
        addedAt: Date.now(),
        textContent: trimmed,
        previewText: trimmed.slice(0, 140) + (trimmed.length > 140 ? '…' : ''),
      },
    ]);
    setPastedNote('');
    setShowNoteInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerateDraft({ prompt: prompt.trim(), format, tone, length, attachments });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 dark:bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-4">
          <div>
            <h2
              id="draft-modal-title"
              className="manuscript-prose text-xl font-semibold text-zinc-950 dark:text-zinc-50"
            >
              Start a new draft
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Brief Folio with a prompt and reference files, or open a clean page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Prompt input */}
          <div>
            <label
              htmlFor="draft-prompt"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              What are we writing?
            </label>
            <textarea
              id="draft-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe the thesis, audience, key points, or angle you want to explore…"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 px-4 py-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 resize-y"
            />
          </div>

          {/* Format, Tone, Length controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Format
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                disabled={isGenerating}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Voice
              </span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={isGenerating}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Length
              </span>
              <div className="grid grid-cols-3 p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setLength(l.id)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      length === l.id
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reference File Attachments */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Reference files (PDF, images, Markdown, CSV, TXT)
              </span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setShowNoteInput((v) => !v)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  {showNoteInput ? 'Cancel note' : 'Paste note'}
                </button>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach files</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json,.pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {showNoteInput && (
              <div className="mb-3 space-y-2">
                <textarea
                  rows={3}
                  value={pastedNote}
                  onChange={(e) => setPastedNote(e.target.value)}
                  placeholder="Paste interview quotes, stats, or outline notes…"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleAddPastedNote}
                  disabled={!pastedNote.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Add reference note
                </button>
              </div>
            )}

            {attachments.length > 0 ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl">
                {attachments.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                          {file.name}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 truncate">
                          {formatFileSize(file.sizeBytes)} · {file.previewText}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((a) => a.id !== file.id))
                      }
                      aria-label={`Remove ${file.name}`}
                      className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400 hover:border-blue-500 transition-colors cursor-pointer"
              >
                Drop research docs, PDFs, screenshots, or notes here — they stay connected to this draft for inline edits too.
              </div>
            )}

            {fileError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{fileError}</p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onStartBlank(attachments)}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Start blank page instead
            </button>

            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-45 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting manuscript…</span>
                </>
              ) : (
                <span>Generate draft</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
