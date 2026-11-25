import React from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import type { ParagraphBlock, ProactiveSuggestion } from '../types/writing';

interface MarginaliaRailProps {
  suggestions: ProactiveSuggestion[];
  blocks: ParagraphBlock[];
  thoughtPartnerEnabled: boolean;
  isReviewing: boolean;
  activeHighlightId: string | null;
  error?: string | null;
  onHoverParagraph: (paragraphId: string | null) => void;
  onFocusParagraph: (paragraphId: string) => void;
  onPreviewSuggestion: (suggestion: ProactiveSuggestion) => void;
  onIterateSuggestion: (suggestion: ProactiveSuggestion) => void;
  onDismissSuggestion: (suggestion: ProactiveSuggestion) => void;
  onTriggerReview: () => void;
}

const CATEGORY_LABELS: Record<ProactiveSuggestion['category'], string> = {
  clarity: 'Clarity',
  argument: 'Argument',
  evidence: 'Evidence',
  flow: 'Flow',
  voice: 'Voice',
};

export const MarginaliaRail: React.FC<MarginaliaRailProps> = ({
  suggestions,
  blocks,
  thoughtPartnerEnabled,
  isReviewing,
  activeHighlightId,
  error,
  onHoverParagraph,
  onFocusParagraph,
  onPreviewSuggestion,
  onIterateSuggestion,
  onDismissSuggestion,
  onTriggerReview,
}) => {
  const paragraphNumberMap = React.useMemo(() => {
    const map = new Map<string, number>();
    blocks.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [blocks]);

  return (
    <aside
      aria-label="Editorial marginalia"
      className="w-full lg:w-[330px] xl:w-[350px] shrink-0"
    >
      <div className="lg:sticky lg:top-20 space-y-4">
        <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Marginalia
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {suggestions.length > 0
                ? `· ${suggestions.length} ${suggestions.length === 1 ? 'note' : 'notes'}`
                : thoughtPartnerEnabled
                  ? '· Reading quietly'
                  : '· Paused'}
            </span>
          </div>

          <button
            type="button"
            onClick={onTriggerReview}
            disabled={isReviewing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading…</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Review</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-3.5 text-xs text-rose-700 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {suggestions.length === 0 ? (
          <div className="py-6 space-y-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            <p>
              {thoughtPartnerEnabled
                ? 'Folio reads along quietly while you write and surfaces a margin note only when it spots a sharp structural, voice, or source-evidence opportunity.'
                : 'Proactive thought partner is paused. You can still select any sentence or press ⌘K to iterate inline.'}
            </p>
            <button
              type="button"
              onClick={onTriggerReview}
              disabled={isReviewing}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {isReviewing ? 'Reading manuscript…' : 'Ask Folio for editorial notes now'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((note) => {
              const pNum = paragraphNumberMap.get(note.paragraphId);
              const isActive = activeHighlightId === note.paragraphId;
              return (
                <article
                  key={note.id}
                  onMouseEnter={() => onHoverParagraph(note.paragraphId)}
                  onMouseLeave={() => onHoverParagraph(null)}
                  className={`rounded-xl border p-4 transition-colors duration-150 bg-white dark:bg-[#141417] ${
                    isActive
                      ? 'border-blue-400 dark:border-blue-600/80'
                      : 'border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Unboxed metadata header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => onFocusParagraph(note.paragraphId)}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {CATEGORY_LABELS[note.category]}
                      </span>
                      {pNum && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Paragraph {pNum}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss margin note"
                      onClick={() => onDismissSuggestion(note)}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quoted excerpt */}
                  {note.excerpt && (
                    <button
                      type="button"
                      onClick={() => onFocusParagraph(note.paragraphId)}
                      className="block text-left mb-2 manuscript-prose italic text-[13.5px] leading-snug text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      “{note.excerpt}”
                    </button>
                  )}

                  {/* Editorial observation */}
                  <p className="text-[13.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 mb-3.5">
                    {note.observation}
                  </p>

                  {/* Action row */}
                  <div className="flex items-center gap-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => onPreviewSuggestion(note)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {note.actionLabel || 'Preview diff'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onIterateSuggestion(note)}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Refine inline
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
