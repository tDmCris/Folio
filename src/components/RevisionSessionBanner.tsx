import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import type { InlineRevisionSession } from '../types/writing';

interface RevisionSessionBannerProps {
  session: InlineRevisionSession;
  isIterating: boolean;
  error?: string | null;
  onAcceptAll: () => void;
  onDiscardAll: () => void;
  onFollowUp: (followUpFeedback: string) => void;
}

const SCOPE_DESCRIPTORS: Record<InlineRevisionSession['chosenScope'], string> = {
  selection: 'Line edit',
  paragraph: 'Paragraph rewrite',
  article: 'Article weave',
};

export const RevisionSessionBanner: React.FC<RevisionSessionBannerProps> = ({
  session,
  isIterating,
  error,
  onAcceptAll,
  onDiscardAll,
  onFollowUp,
}) => {
  const [followUp, setFollowUp] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp.trim() || isIterating) return;
    onFollowUp(followUp.trim());
    setFollowUp('');
  };

  return (
    <div
      role="region"
      aria-label="Active inline revision"
      className="mb-7 rounded-xl border border-blue-200/90 dark:border-blue-900/70 bg-white dark:bg-[#141417] p-4 shadow-sm space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {SCOPE_DESCRIPTORS[session.chosenScope]}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {session.edits.length}{' '}
              {session.edits.length === 1 ? 'change' : 'changes'} proposed
            </span>
          </div>
          <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {session.rationale}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isIterating}
            onClick={onAcceptAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept {session.edits.length > 1 ? 'all' : 'change'}</span>
          </button>
          <button
            type="button"
            disabled={isIterating}
            onClick={onDiscardAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        </div>
      </div>

      {/* Optional suggested title update */}
      {session.suggestedTitle && session.suggestedTitle.trim() && (
        <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Suggested title:{' '}
          </span>
          <span className="manuscript-prose text-sm text-zinc-900 dark:text-zinc-100">
            {session.suggestedTitle}
          </span>
        </div>
      )}

      {/* Zero-copy-paste inline follow-up refinement */}
      <form
        onSubmit={handleSubmit}
        className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2"
      >
        <input
          type="text"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          disabled={isIterating}
          placeholder="Refine this weave inline—e.g. keep the original first sentence or dial back the tone…"
          className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!followUp.trim() || isIterating}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-45 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isIterating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Refining…</span>
            </>
          ) : (
            <>
              <span>Refine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
