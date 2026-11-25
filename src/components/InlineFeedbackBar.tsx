import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, X } from 'lucide-react';
import type { RewriteScope } from '../types/writing';

interface InlineFeedbackBarProps {
  paragraphIndex: number;
  selectedText?: string;
  initialPrompt?: string;
  defaultScope?: RewriteScope;
  hasSources: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (feedback: string, scope: RewriteScope) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  { label: 'Tighten', text: 'Tighten the prose and cut unnecessary words without losing meaning.' },
  { label: 'Sharpen', text: 'Make the core point sharper, more concrete, and more memorable.' },
  { label: 'Weave sources', text: 'Weave in a specific supporting fact or figure from my attached source files.' },
  { label: 'Improve flow', text: 'Smooth the transition with surrounding paragraphs so the logic flows effortlessly.' },
];

const SCOPE_OPTIONS: Array<{ value: RewriteScope; label: string; hint: string }> = [
  { value: 'auto', label: 'Auto', hint: 'Folio chooses line, paragraph, or whole article' },
  { value: 'selection', label: 'Line', hint: 'Surgically revise only the targeted line' },
  { value: 'paragraph', label: 'Paragraph', hint: 'Rewrite this paragraph' },
  { value: 'article', label: 'Article', hint: 'Weave changes across the full manuscript' },
];

export const InlineFeedbackBar: React.FC<InlineFeedbackBarProps> = ({
  paragraphIndex,
  selectedText,
  initialPrompt = '',
  defaultScope = 'auto',
  hasSources,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}) => {
  const [feedback, setFeedback] = useState(initialPrompt);
  const [scope, setScope] = useState<RewriteScope>(defaultScope);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFeedback(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || isSubmitting) return;
    onSubmit(feedback.trim(), scope);
  };

  const activeScopeHint = SCOPE_OPTIONS.find((s) => s.value === scope)?.hint;

  return (
    <div
      className="my-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] shadow-lg shadow-zinc-900/5 dark:shadow-black/40 p-4 transition-all"
      role="region"
      aria-label="Inline editorial feedback"
    >
      {/* Context header row */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
          <span className="font-medium text-zinc-800 dark:text-zinc-200 shrink-0">
            Inline feedback
          </span>
          <span aria-hidden="true">·</span>
          {selectedText ? (
            <span className="truncate italic manuscript-prose text-zinc-700 dark:text-zinc-300">
              “{selectedText}”
            </span>
          ) : (
            <span className="shrink-0">Paragraph {paragraphIndex + 1}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close inline feedback"
          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main feedback input */}
      <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          disabled={isSubmitting}
          placeholder="Tell Folio what to rethink, tighten, or weave in…"
          className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!feedback.trim() || isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Weaving…</span>
            </>
          ) : (
            <>
              <span>Weave</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Scope segmented control & quick presets */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            Scope
          </span>
          <div
            className="inline-flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg"
            role="radiogroup"
            aria-label="Rewrite scope"
          >
            {SCOPE_OPTIONS.map((opt) => {
              const active = scope === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={isSubmitting}
                  onClick={() => setScope(opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="hidden sm:inline text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-[260px]">
            {activeScopeHint}
          </span>
        </div>

        {/* Quick 1-click editorial directions */}
        <div className="flex items-center gap-3 text-xs">
          {QUICK_PROMPTS.filter((p) => p.label !== 'Weave sources' || hasSources).map(
            (preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isSubmitting}
                onClick={() => onSubmit(preset.text, scope)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            )
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
