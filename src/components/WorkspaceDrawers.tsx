import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { DrawerView } from './TopBar';
import type { DocumentSnapshot, SourceAttachment, WritingDocument } from '../types/writing';
import { countWords } from '../utils/diff';
import {
  createId,
  documentToMarkdown,
  formatFileSize,
  parseFileToAttachment,
} from '../utils/files';

interface WorkspaceDrawersProps {
  activeDrawer: DrawerView;
  documents: WritingDocument[];
  activeDoc: WritingDocument;
  onClose: () => void;
  onSelectDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onOpenNewDraft: () => void;
  onAddAttachments: (files: SourceAttachment[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSaveSnapshot: (label: string) => void;
  onRestoreSnapshot: (snapshot: DocumentSnapshot) => void;
}

function formatRelativeTime(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const WorkspaceDrawers: React.FC<WorkspaceDrawersProps> = ({
  activeDrawer,
  documents,
  activeDoc,
  onClose,
  onSelectDocument,
  onDeleteDocument,
  onOpenNewDraft,
  onAddAttachments,
  onRemoveAttachment,
  onSaveSnapshot,
  onRestoreSnapshot,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'md' | 'txt' | null>(null);

  if (!activeDrawer) return null;

  const titles: Record<Exclude<DrawerView, null>, string> = {
    documents: 'Documents',
    sources: 'Sources',
    history: 'Revision History',
    export: 'Export Manuscript',
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    const added: SourceAttachment[] = [];
    for (const file of Array.from(fileList)) {
      try {
        added.push(await parseFileToAttachment(file));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Unable to attach file.');
      }
    }
    if (added.length > 0) {
      onAddAttachments(added);
    }
  };

  const handleSaveManualNote = () => {
    if (!noteBody.trim()) return;
    const text = noteBody.trim();
    const name = (noteTitle.trim() || `Source Note ${activeDoc.attachments.length + 1}`) + '.md';
    onAddAttachments([
      {
        id: createId('src'),
        name,
        mimeType: 'text/markdown',
        sizeBytes: new Blob([text]).size,
        addedAt: Date.now(),
        textContent: text,
        previewText: text.slice(0, 140) + (text.length > 140 ? '…' : ''),
      },
    ]);
    setNoteTitle('');
    setNoteBody('');
    setShowAddNote(false);
  };

  const markdownOutput = documentToMarkdown(activeDoc.title, activeDoc.blocks);
  const plainTextOutput = [
    activeDoc.title.trim(),
    ...activeDoc.blocks.map((b) => b.text.trim()).filter(Boolean),
  ].join('\n\n');

  const handleCopy = async (mode: 'md' | 'txt') => {
    const content = mode === 'md' ? markdownOutput : plainTextOutput;
    await navigator.clipboard.writeText(content);
    setCopiedMode(mode);
    window.setTimeout(() => setCopiedMode(null), 1800);
  };

  const handleDownloadMarkdown = () => {
    const slug =
      (activeDoc.title || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'manuscript';
    const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="fixed inset-0 bg-zinc-950/20 dark:bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-label={titles[activeDrawer]}
        className="relative z-10 w-full max-w-md h-full bg-white dark:bg-[#141417] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
      >
        <div className="px-6 h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {titles[activeDrawer]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* DOCUMENTS */}
          {activeDrawer === 'documents' && (
            <>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewDraft();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Draft</span>
              </button>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {documents.map((doc) => {
                  const words = countWords(doc.blocks.map((b) => b.text).join(' '));
                  const isCurrent = doc.id === activeDoc.id;
                  return (
                    <div
                      key={doc.id}
                      className="py-3.5 flex items-start justify-between gap-3 group"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDocument(doc.id);
                          onClose();
                        }}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <p
                          className={`manuscript-prose text-[15px] font-medium truncate ${
                            isCurrent
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}
                        >
                          {doc.title.trim() || 'Untitled draft'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                          {words} words · {doc.attachments.length}{' '}
                          {doc.attachments.length === 1 ? 'source' : 'sources'} ·{' '}
                          {formatRelativeTime(doc.updatedAt)}
                        </p>
                      </button>

                      {documents.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Delete ${doc.title || 'draft'}`}
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* SOURCES */}
          {activeDrawer === 'sources' && (
            <>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Attached files stay grounded in context whenever you ask Folio to weave inline edits or run a proactive margin review.
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach files</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddNote((v) => !v)}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                >
                  {showAddNote ? 'Cancel' : 'Add text note'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.csv,.json,.pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    handleFileUpload(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
              )}

              {showAddNote && (
                <div className="space-y-2.5 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title (optional)"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
                  />
                  <textarea
                    rows={4}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Paste quotes, data points, or reference excerpts…"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualNote}
                    disabled={!noteBody.trim()}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 rounded-md disabled:opacity-40 cursor-pointer"
                  >
                    Save to sources
                  </button>
                </div>
              )}

              {activeDoc.attachments.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  No reference files attached to this draft yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeDoc.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => onRemoveAttachment(file.id)}
                          className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {formatFileSize(file.sizeBytes)} · Added {formatRelativeTime(file.addedAt)}
                      </p>
                      {file.previewText && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                          {file.previewText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* HISTORY */}
          {activeDrawer === 'history' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Snapshots save automatically before every accepted AI weave.
                </p>
                <button
                  type="button"
                  onClick={() => onSaveSnapshot('Manual checkpoint')}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Save snapshot
                </button>
              </div>

              {activeDoc.snapshots.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No snapshots saved yet.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {activeDoc.snapshots.map((snap) => {
                    const words = countWords(snap.blocks.map((b) => b.text).join(' '));
                    return (
                      <div key={snap.id} className="py-3.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {snap.label}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                            {words} words · {formatRelativeTime(snap.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreSnapshot(snap);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* EXPORT */}
          {activeDrawer === 'export' && (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCopy('md')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 rounded-lg cursor-pointer"
                >
                  {copiedMode === 'md' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Markdown</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('txt')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer"
                >
                  {copiedMode === 'txt' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Text</span>
                    </>
                  ) : (
                    <span>Copy Plain Text</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Markdown preview
                </span>
                <pre className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {markdownOutput}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
