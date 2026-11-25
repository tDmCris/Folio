import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Check, Heading2, MessageSquarePlus, Quote, Type as TypeIcon, X } from 'lucide-react';
import type { BlockType, ParagraphBlock, ProposedEdit } from '../types/writing';
import { computeWordDiff } from '../utils/diff';

interface ManuscriptBlockProps {
  block: ParagraphBlock;
  index: number;
  isFocused: boolean;
  isHighlightedFromMargin: boolean;
  hasMarginNote: boolean;
  pendingEdit?: ProposedEdit;
  insertedAfterEdits: ProposedEdit[];
  focusMode: boolean;
  registerRef: (id: string, el: HTMLTextAreaElement | null) => void;
  onFocus: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onChangeType: (id: string, type: BlockType) => void;
  onSplitParagraph: (id: string, cursorPos: number) => void;
  onMergeWithPrevious: (id: string) => void;
  onPasteMultiParagraph: (id: string, cursorStart: number, cursorEnd: number, pasted: string) => void;
  onMoveFocus: (id: string, direction: 'up' | 'down') => void;
  onRequestInlineFeedback: (id: string, selectedText?: string) => void;
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  children?: React.ReactNode;
}

export const ManuscriptBlock: React.FC<ManuscriptBlockProps> = ({
  block,
  index,
  isFocused,
  isHighlightedFromMargin,
  hasMarginNote,
  pendingEdit,
  insertedAfterEdits,
  focusMode,
  registerRef,
  onFocus,
  onChangeText,
  onChangeType,
  onSplitParagraph,
  onMergeWithPrevious,
  onPasteMultiParagraph,
  onMoveFocus,
  onRequestInlineFeedback,
  onAcceptEdit,
  onRejectEdit,
  children,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionSnippet, setSelectionSnippet] = React.useState<string>('');

  const syncHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    syncHeight();
  }, [block.text, block.type, pendingEdit]);

  useEffect(() => {
    const handleResize = () => syncHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (end - start >= 3) {
      setSelectionSnippet(el.value.slice(start, end).trim());
    } else {
      setSelectionSnippet('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const selected =
        el.selectionEnd > el.selectionStart
          ? el.value.slice(el.selectionStart, el.selectionEnd).trim()
          : undefined;
      onRequestInlineFeedback(block.id, selected);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSplitParagraph(block.id, el.selectionStart);
      return;
    }

    if (
      e.key === 'Backspace' &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0 &&
      index > 0
    ) {
      e.preventDefault();
      onMergeWithPrevious(block.id);
      return;
    }

    if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      onMoveFocus(block.id, 'up');
      return;
    }

    if (
      e.key === 'ArrowDown' &&
      el.selectionStart === el.value.length &&
      el.selectionEnd === el.value.length
    ) {
      e.preventDefault();
      onMoveFocus(block.id, 'down');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (text.includes('\n')) {
      e.preventDefault();
      const el = e.currentTarget;
      onPasteMultiParagraph(block.id, el.selectionStart, el.selectionEnd, text);
    }
  };

  const proseStyle =
    block.type === 'heading'
      ? 'manuscript-prose text-[23px] md:text-[25px] font-semibold tracking-tight leading-[1.35] text-zinc-950 dark:text-zinc-50 mt-5 mb-1'
      : block.type === 'quote'
        ? 'manuscript-prose text-[18px] md:text-[19px] italic leading-[1.75] text-zinc-700 dark:text-zinc-300 pl-6'
        : 'manuscript-prose text-[18px] md:text-[19.5px] leading-[1.78] text-zinc-800 dark:text-zinc-200';

  return (
    <div
      data-block-id={block.id}
      className={`group relative rounded-xl transition-colors duration-200 ${
        isHighlightedFromMargin
          ? 'bg-blue-50/70 dark:bg-blue-950/25 -mx-3 px-3 py-1.5'
          : 'py-1'
      }`}
    >
      {/* Subtle left margin affordance (desktop hover / active) */}
      {!focusMode && !pendingEdit && (
        <div
          className={`hidden md:flex items-center gap-1 absolute -left-24 top-2 transition-opacity duration-150 ${
            isFocused || selectionSnippet
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            title="Give inline feedback (⌘K)"
            onClick={() => onRequestInlineFeedback(block.id, selectionSnippet || undefined)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={
              block.type === 'paragraph'
                ? 'Switch to heading'
                : block.type === 'heading'
                  ? 'Switch to pull quote'
                  : 'Switch to body paragraph'
            }
            onClick={() => {
              const next: BlockType =
                block.type === 'paragraph'
                  ? 'heading'
                  : block.type === 'heading'
                    ? 'quote'
                    : 'paragraph';
              onChangeType(block.id, next);
            }}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            {block.type === 'heading' ? (
              <Heading2 className="w-3.5 h-3.5" />
            ) : block.type === 'quote' ? (
              <Quote className="w-3.5 h-3.5" />
            ) : (
              <TypeIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* Quiet right-edge margin anchor indicator when a proactive note exists */}
      {!focusMode && hasMarginNote && !pendingEdit && (
        <span
          aria-hidden="true"
          className="hidden lg:block absolute -right-5 top-3.5 w-2 h-px bg-blue-600/60 dark:bg-blue-400/60"
        />
      )}

      {/* Pending Inline Diff View vs Live Editable Block */}
      {pendingEdit ? (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-[#141417] p-4 my-1 shadow-xs">
          <div className="flex items-center justify-between gap-4 mb-2.5 text-xs">
            <span className="font-medium text-blue-700 dark:text-blue-400">
              {pendingEdit.action === 'delete'
                ? 'Proposed cut'
                : pendingEdit.summary || 'Proposed revision'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onAcceptEdit(pendingEdit.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>
              <button
                type="button"
                onClick={() => onRejectEdit(pendingEdit.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            </div>
          </div>

          <div className={proseStyle}>
            {computeWordDiff(pendingEdit.originalText, pendingEdit.newText).map(
              (seg, idx) => {
                if (seg.type === 'delete') {
                  return (
                    <del
                      key={idx}
                      className="bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 line-through decoration-rose-500/70 px-0.5 rounded-xs"
                    >
                      {seg.value}
                    </del>
                  );
                }
                if (seg.type === 'insert') {
                  return (
                    <ins
                      key={idx}
                      className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 underline decoration-emerald-600/50 underline-offset-4 px-0.5 rounded-xs"
                    >
                      {seg.value}
                    </ins>
                  );
                }
                return <span key={idx}>{seg.value}</span>;
              }
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={(el) => {
              textareaRef.current = el;
              registerRef(block.id, el);
            }}
            rows={1}
            value={block.text}
            onFocus={() => onFocus(block.id)}
            onChange={(e) => onChangeText(block.id, e.target.value)}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              index === 0
                ? 'Begin writing, or press ⌘K to collaborate inline with Folio…'
                : ''
            }
            className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 ${proseStyle}`}
          />

          {/* Selection action strip — appears cleanly right when user highlights a sentence/phrase */}
          {selectionSnippet && (
            <div className="mt-1 mb-2 flex items-center gap-3 text-xs">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRequestInlineFeedback(block.id, selectionSnippet);
                  setSelectionSnippet('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Give inline feedback</span>
              </button>
              <span className="text-zinc-400 dark:text-zinc-500">or press ⌘K</span>
            </div>
          )}
        </div>
      )}

      {/* Inline feedback composer slot anchored cleanly right beneath this block */}
      {children}

      {/* Newly woven paragraphs proposed directly after this block */}
      {insertedAfterEdits.map((ins) => (
        <div
          key={ins.id}
          className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4"
        >
          <div className="flex items-center justify-between gap-4 mb-2 text-xs">
            <span className="font-medium text-emerald-800 dark:text-emerald-300">
              New paragraph woven in · {ins.summary}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onAcceptEdit(ins.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Insert</span>
              </button>
              <button
                type="button"
                onClick={() => onRejectEdit(ins.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            </div>
          </div>
          <p className="manuscript-prose text-[18px] md:text-[19px] leading-[1.75] text-emerald-950 dark:text-emerald-100">
            {ins.newText}
          </p>
        </div>
      ))}
    </div>
  );
};
