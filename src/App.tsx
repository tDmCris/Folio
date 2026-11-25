import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Moon, Paperclip, Plus, Sun } from 'lucide-react';
import { TopBar } from './components/TopBar';
import type { DrawerView } from './components/TopBar';
import { ManuscriptBlock } from './components/ManuscriptBlock';
import { InlineFeedbackBar } from './components/InlineFeedbackBar';
import { MarginaliaRail } from './components/MarginaliaRail';
import { DraftComposerModal } from './components/DraftComposerModal';
import { WorkspaceDrawers } from './components/WorkspaceDrawers';
import { RevisionSessionBanner } from './components/RevisionSessionBanner';
import { INITIAL_DOCUMENTS } from './data/initialDocuments';
import {
  requestDraft,
  requestInlineIteration,
  requestProactiveReview,
} from './services/aiClient';
import type {
  BlockType,
  DocumentSnapshot,
  InlineRevisionSession,
  ParagraphBlock,
  ProactiveSuggestion,
  ProposedEdit,
  RewriteScope,
  SourceAttachment,
  WritingDocument,
} from './types/writing';
import { countWords } from './utils/diff';
import { createId } from './utils/files';

const STORAGE_KEY = 'folio_documents_v1';
const THEME_KEY = 'folio_theme_v1';

interface InlineComposerState {
  paragraphId: string;
  selectedText?: string;
  initialPrompt?: string;
  defaultScope?: RewriteScope;
}

function loadStoredDocuments(): WritingDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DOCUMENTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as WritingDocument[];
    }
  } catch {
    // Fallback to initial documents if storage is corrupted
  }
  return INITIAL_DOCUMENTS;
}

export default function App() {
  const [documents, setDocuments] = useState<WritingDocument[]>(loadStoredDocuments);
  const [activeDocId, setActiveDocId] = useState<string>(() => loadStoredDocuments()[0].id);

  // Theme state synced cleanly with <html class="dark">
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  // Persist documents to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch {
      // Ignore quota errors on large binary attachments
    }
  }, [documents]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? documents[0],
    [documents, activeDocId]
  );

  // Workspace chrome states
  const [activeDrawer, setActiveDrawer] = useState<DrawerView>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [thoughtPartnerEnabled, setThoughtPartnerEnabled] = useState(true);

  // Editor & inline feedback states
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [inlineComposer, setInlineComposer] = useState<InlineComposerState | null>(null);
  const [revisionSession, setRevisionSession] = useState<InlineRevisionSession | null>(null);
  const [isIterating, setIsIterating] = useState(false);
  const [iterateError, setIterateError] = useState<string | null>(null);

  // Draft generation states
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftBannerNote, setDraftBannerNote] = useState<string | null>(null);

  // Proactive marginalia states
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [dismissedExcerpts, setDismissedExcerpts] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [hoveredMarginBlockId, setHoveredMarginBlockId] = useState<string | null>(null);

  // Refs for smooth focus transitions across blocks
  const blockRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const lastReviewedFingerprintRef = useRef<string>('');
  const charsChangedSinceReviewRef = useRef<number>(0);
  const initialReviewTriggeredRef = useRef<boolean>(false);

  const registerBlockRef = useCallback((id: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      blockRefs.current.set(id, el);
    } else {
      blockRefs.current.delete(id);
    }
  }, []);

  const focusBlockAt = useCallback((id: string, cursorPos?: number) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(id);
      if (!el) return;
      el.focus();
      const pos = cursorPos ?? el.value.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  // Auto-resize title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [activeDoc.title, activeDoc.id]);

  // Helper to update active document cleanly
  const updateActiveDoc = useCallback(
    (updater: (doc: WritingDocument) => WritingDocument) => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === activeDoc.id ? { ...updater(doc), updatedAt: Date.now() } : doc
        )
      );
    },
    [activeDoc.id]
  );

  // Reset transient editing states when switching documents
  const handleSelectDocument = (id: string) => {
    setActiveDocId(id);
    setInlineComposer(null);
    setRevisionSession(null);
    setSuggestions([]);
    setDismissedExcerpts([]);
    setReviewError(null);
    setDraftBannerNote(null);
    lastReviewedFingerprintRef.current = '';
    charsChangedSinceReviewRef.current = 0;
  };

  // Document text handlers
  const handleTitleChange = (title: string) => {
    updateActiveDoc((doc) => ({ ...doc, title }));
  };

  const handleChangeBlockText = (id: string, text: string) => {
    const prevBlock = activeDoc.blocks.find((b) => b.id === id);
    const delta = Math.abs(text.length - (prevBlock?.text.length ?? 0));
    charsChangedSinceReviewRef.current += delta;

    updateActiveDoc((doc) => ({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    }));
  };

  const handleChangeBlockType = (id: string, type: BlockType) => {
    updateActiveDoc((doc) => ({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    }));
  };

  const handleSplitParagraph = (id: string, cursorPos: number) => {
    const idx = activeDoc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const current = activeDoc.blocks[idx];
    const before = current.text.slice(0, cursorPos);
    const after = current.text.slice(cursorPos);
    const newBlock: ParagraphBlock = {
      id: createId('p'),
      type: 'paragraph',
      text: after,
    };

    updateActiveDoc((doc) => {
      const nextBlocks = [...doc.blocks];
      nextBlocks[idx] = { ...current, text: before };
      nextBlocks.splice(idx + 1, 0, newBlock);
      return { ...doc, blocks: nextBlocks };
    });

    setFocusedBlockId(newBlock.id);
    focusBlockAt(newBlock.id, 0);
  };

  const handleMergeWithPrevious = (id: string) => {
    const idx = activeDoc.blocks.findIndex((b) => b.id === id);
    if (idx <= 0) return;
    const prev = activeDoc.blocks[idx - 1];
    const current = activeDoc.blocks[idx];
    const joinPos = prev.text.length;
    const mergedText = prev.text + current.text;

    updateActiveDoc((doc) => {
      const nextBlocks = [...doc.blocks];
      nextBlocks[idx - 1] = { ...prev, text: mergedText };
      nextBlocks.splice(idx, 1);
      return { ...doc, blocks: nextBlocks };
    });

    setFocusedBlockId(prev.id);
    focusBlockAt(prev.id, joinPos);
  };

  const handlePasteMultiParagraph = (
    id: string,
    cursorStart: number,
    cursorEnd: number,
    pasted: string
  ) => {
    const idx = activeDoc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const current = activeDoc.blocks[idx];
    const parts = pasted
      .replace(/\r\n/g, '\n')
      .split(/\n{1,}/)
      .map((s) => s.trim())
      .filter((s, i, arr) => s.length > 0 || (i === 0 && arr.length === 1));

    if (parts.length <= 1) return;

    const prefix = current.text.slice(0, cursorStart);
    const suffix = current.text.slice(cursorEnd);
    const firstText = prefix + parts[0];
    const middleBlocks: ParagraphBlock[] = parts.slice(1, -1).map((text) => ({
      id: createId('p'),
      type: 'paragraph',
      text,
    }));
    const lastBlock: ParagraphBlock = {
      id: createId('p'),
      type: 'paragraph',
      text: parts[parts.length - 1] + suffix,
    };

    charsChangedSinceReviewRef.current += pasted.length;

    updateActiveDoc((doc) => {
      const nextBlocks = [...doc.blocks];
      nextBlocks[idx] = { ...current, text: firstText };
      nextBlocks.splice(idx + 1, 0, ...middleBlocks, lastBlock);
      return { ...doc, blocks: nextBlocks };
    });

    focusBlockAt(lastBlock.id, parts[parts.length - 1].length);
  };

  const handleMoveFocus = (id: string, direction: 'up' | 'down') => {
    const idx = activeDoc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const target = activeDoc.blocks[idx - 1];
      setFocusedBlockId(target.id);
      focusBlockAt(target.id, target.text.length);
    } else if (direction === 'down' && idx < activeDoc.blocks.length - 1) {
      const target = activeDoc.blocks[idx + 1];
      setFocusedBlockId(target.id);
      focusBlockAt(target.id, 0);
    }
  };

  const handleAppendEmptyParagraph = () => {
    const newBlock: ParagraphBlock = { id: createId('p'), type: 'paragraph', text: '' };
    updateActiveDoc((doc) => ({ ...doc, blocks: [...doc.blocks, newBlock] }));
    setFocusedBlockId(newBlock.id);
    focusBlockAt(newBlock.id, 0);
  };

  // Snapshots
  const saveSnapshot = useCallback(
    (label: string) => {
      const snap: DocumentSnapshot = {
        id: createId('snap'),
        label,
        createdAt: Date.now(),
        title: activeDoc.title,
        blocks: activeDoc.blocks.map((b) => ({ ...b })),
      };
      updateActiveDoc((doc) => ({
        ...doc,
        snapshots: [snap, ...doc.snapshots].slice(0, 20),
      }));
    },
    [activeDoc.blocks, activeDoc.title, updateActiveDoc]
  );

  const handleRestoreSnapshot = (snap: DocumentSnapshot) => {
    setRevisionSession(null);
    setInlineComposer(null);
    updateActiveDoc((doc) => ({
      ...doc,
      title: snap.title,
      blocks: snap.blocks.map((b) => ({ ...b })),
    }));
  };

  // Draft creation (AI or Blank)
  const handleGenerateDraft = async (params: {
    prompt: string;
    format: string;
    tone: string;
    length: string;
    attachments: SourceAttachment[];
  }) => {
    setIsGeneratingDraft(true);
    setDraftError(null);
    try {
      const result = await requestDraft(params);
      const newBlocks: ParagraphBlock[] =
        result.blocks && result.blocks.length > 0
          ? result.blocks.map((b) => ({
              id: createId('p'),
              type: b.type || 'paragraph',
              text: b.text,
            }))
          : [{ id: createId('p'), type: 'paragraph', text: '' }];

      const newDoc: WritingDocument = {
        id: createId('doc'),
        title: result.title || 'Untitled draft',
        blocks: newBlocks,
        attachments: params.attachments,
        snapshots: [
          {
            id: createId('snap'),
            label: 'Initial AI draft',
            createdAt: Date.now(),
            title: result.title || 'Untitled draft',
            blocks: newBlocks.map((b) => ({ ...b })),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setDocuments((prev) => [newDoc, ...prev]);
      setActiveDocId(newDoc.id);
      setIsDraftModalOpen(false);
      setInlineComposer(null);
      setRevisionSession(null);
      setSuggestions([]);
      setDismissedExcerpts([]);
      setDraftBannerNote(result.editorNote || null);
      lastReviewedFingerprintRef.current = newBlocks.map((b) => b.text).join('\n');
      charsChangedSinceReviewRef.current = 0;
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Unable to generate draft.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleStartBlank = (attachments: SourceAttachment[]) => {
    const firstBlock: ParagraphBlock = { id: createId('p'), type: 'paragraph', text: '' };
    const newDoc: WritingDocument = {
      id: createId('doc'),
      title: '',
      blocks: [firstBlock],
      attachments,
      snapshots: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setIsDraftModalOpen(false);
    setInlineComposer(null);
    setRevisionSession(null);
    setSuggestions([]);
    setDismissedExcerpts([]);
    setDraftBannerNote(null);
    lastReviewedFingerprintRef.current = '';
    charsChangedSinceReviewRef.current = 0;
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (remaining.length === 0) return prev;
      if (id === activeDoc.id) {
        setActiveDocId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Inline Iteration (Smart Weave: Auto / Line / Paragraph / Article)
  const runInlineWeave = async (params: {
    targetParagraphId: string;
    selectedText?: string;
    feedback: string;
    scope: RewriteScope;
    existingSession?: InlineRevisionSession | null;
  }) => {
    setIsIterating(true);
    setIterateError(null);
    try {
      const res = await requestInlineIteration({
        title: activeDoc.title,
        blocks: activeDoc.blocks,
        targetParagraphId: params.targetParagraphId,
        selectedText: params.selectedText,
        feedback: params.feedback,
        scope: params.scope,
        attachments: activeDoc.attachments,
        priorFeedback: params.existingSession?.history,
        currentPendingEdits: params.existingSession?.edits.map((e) => ({
          paragraphId: e.paragraphId,
          newText: e.newText,
        })),
      });

      const blockLookup = new Map(activeDoc.blocks.map((b) => [b.id, b]));
      const mappedEdits: ProposedEdit[] = (res.edits || [])
        .filter((e) => blockLookup.has(e.paragraphId))
        .map((e) => {
          const orig = blockLookup.get(e.paragraphId)!;
          return {
            id: createId('edit'),
            paragraphId: e.paragraphId,
            action: e.action,
            originalText: e.action === 'insert_after' ? '' : orig.text,
            newText: e.action === 'delete' ? '' : e.newText,
            newType: e.newType,
            summary: e.summary || 'Revision',
          };
        })
        .filter((e) => e.action !== 'replace' || e.newText.trim() !== e.originalText.trim());

      if (mappedEdits.length === 0) {
        setIterateError(
          'Folio felt the current text already matched your note. Try being more specific or choosing Paragraph / Article scope.'
        );
        return;
      }

      const nextSession: InlineRevisionSession = {
        id: createId('rev'),
        targetParagraphId: params.targetParagraphId,
        selectedText: params.selectedText,
        feedback: params.feedback,
        requestedScope: params.scope,
        chosenScope: res.chosenScope || 'paragraph',
        rationale: res.rationale,
        edits: mappedEdits,
        suggestedTitle:
          res.suggestedTitle && res.suggestedTitle.trim() !== activeDoc.title.trim()
            ? res.suggestedTitle.trim()
            : undefined,
        history: [
          ...(params.existingSession?.history ?? []),
          { feedback: params.feedback, rationale: res.rationale },
        ],
      };

      setRevisionSession(nextSession);
      setInlineComposer(null);
      setDraftBannerNote(null);
    } catch (err) {
      setIterateError(err instanceof Error ? err.message : 'Unable to weave feedback.');
    } finally {
      setIsIterating(false);
    }
  };

  // Apply single edit or all edits from revision session
  const applyEditsToDoc = useCallback(
    (editsToApply: ProposedEdit[], suggestedTitle?: string, snapshotLabel?: string) => {
      if (snapshotLabel) {
        saveSnapshot(snapshotLabel);
      }

      updateActiveDoc((doc) => {
        let nextBlocks = [...doc.blocks];
        for (const edit of editsToApply) {
          const idx = nextBlocks.findIndex((b) => b.id === edit.paragraphId);
          if (idx === -1) continue;
          if (edit.action === 'replace') {
            nextBlocks[idx] = {
              ...nextBlocks[idx],
              text: edit.newText,
              type: edit.newType ?? nextBlocks[idx].type,
            };
          } else if (edit.action === 'delete') {
            if (nextBlocks.length > 1) {
              nextBlocks.splice(idx, 1);
            } else {
              nextBlocks[idx] = { ...nextBlocks[idx], text: '' };
            }
          } else if (edit.action === 'insert_after') {
            nextBlocks.splice(idx + 1, 0, {
              id: createId('p'),
              type: edit.newType ?? 'paragraph',
              text: edit.newText,
            });
          }
        }
        return {
          ...doc,
          title: suggestedTitle || doc.title,
          blocks: nextBlocks,
        };
      });

      // Clear any stale margin suggestions attached to edited paragraphs
      const editedIds = new Set(editsToApply.map((e) => e.paragraphId));
      setSuggestions((prev) => prev.filter((s) => !editedIds.has(s.paragraphId)));
      charsChangedSinceReviewRef.current = 0;
    },
    [saveSnapshot, updateActiveDoc]
  );

  const handleAcceptSingleEdit = (editId: string) => {
    if (!revisionSession) return;
    const target = revisionSession.edits.find((e) => e.id === editId);
    if (!target) return;
    applyEditsToDoc([target], undefined, `Before: ${target.summary}`);
    const remaining = revisionSession.edits.filter((e) => e.id !== editId);
    if (remaining.length === 0) {
      setRevisionSession(null);
    } else {
      setRevisionSession({ ...revisionSession, edits: remaining });
    }
  };

  const handleRejectSingleEdit = (editId: string) => {
    if (!revisionSession) return;
    const remaining = revisionSession.edits.filter((e) => e.id !== editId);
    if (remaining.length === 0) {
      setRevisionSession(null);
    } else {
      setRevisionSession({ ...revisionSession, edits: remaining });
    }
  };

  const handleAcceptAllEdits = () => {
    if (!revisionSession) return;
    applyEditsToDoc(
      revisionSession.edits,
      revisionSession.suggestedTitle,
      `Before inline weave (${revisionSession.chosenScope})`
    );
    setRevisionSession(null);
  };

  // Proactive Thought Partner engine
  const triggerProactivePass = useCallback(
    async (forceReview: boolean) => {
      const nonEmpty = activeDoc.blocks.filter((b) => b.text.trim().length > 0);
      const totalWordCount = countWords(nonEmpty.map((b) => b.text).join(' '));
      if (totalWordCount < 25) {
        if (forceReview) {
          setReviewError('Write a couple of sentences first so Folio has context to review.');
        }
        return;
      }

      const fingerprint = `${activeDoc.title}\n${activeDoc.blocks.map((b) => b.text).join('\n')}`;
      if (!forceReview && fingerprint === lastReviewedFingerprintRef.current) {
        return;
      }

      setIsReviewing(true);
      setReviewError(null);
      try {
        const res = await requestProactiveReview({
          title: activeDoc.title,
          blocks: activeDoc.blocks,
          recentParagraphId: focusedBlockId ?? undefined,
          dismissedExcerpts,
          attachments: activeDoc.attachments,
          forceReview,
        });

        lastReviewedFingerprintRef.current = fingerprint;
        charsChangedSinceReviewRef.current = 0;

        if (res.shouldIntervene && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
          const validIds = new Set(activeDoc.blocks.map((b) => b.id));
          const incoming: ProactiveSuggestion[] = res.suggestions
            .filter((s) => validIds.has(s.paragraphId))
            .map((s) => ({
              id: createId('note'),
              paragraphId: s.paragraphId,
              category: s.category,
              excerpt: s.excerpt,
              observation: s.observation,
              suggestedRewrite: s.suggestedRewrite,
              actionLabel: s.actionLabel,
              createdAt: Date.now(),
            }));

          if (incoming.length > 0) {
            setSuggestions((prev) => {
              if (forceReview) return incoming;
              const byPara = new Map(prev.map((item) => [item.paragraphId, item]));
              for (const note of incoming) {
                byPara.set(note.paragraphId, note);
              }
              return Array.from(byPara.values()).slice(0, 3);
            });
          }
        }
      } catch (err) {
        if (forceReview) {
          setReviewError(err instanceof Error ? err.message : 'Unable to review manuscript.');
        }
      } finally {
        setIsReviewing(false);
      }
    },
    [activeDoc.attachments, activeDoc.blocks, activeDoc.title, dismissedExcerpts, focusedBlockId]
  );

  // Quiet background invocation after natural writing pauses
  useEffect(() => {
    if (
      !thoughtPartnerEnabled ||
      isReviewing ||
      isIterating ||
      Boolean(revisionSession) ||
      Boolean(inlineComposer) ||
      isDraftModalOpen
    ) {
      return;
    }

    if (charsChangedSinceReviewRef.current < 55) {
      return;
    }

    const timer = window.setTimeout(() => {
      triggerProactivePass(false);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [
    activeDoc.blocks,
    thoughtPartnerEnabled,
    isReviewing,
    isIterating,
    revisionSession,
    inlineComposer,
    isDraftModalOpen,
    triggerProactivePass,
  ]);

  // Run one initial quiet proactive check on mount so the user sees live Gemini marginalia right away
  useEffect(() => {
    if (initialReviewTriggeredRef.current || !thoughtPartnerEnabled) return;
    initialReviewTriggeredRef.current = true;
    const timer = window.setTimeout(() => {
      triggerProactivePass(false);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [thoughtPartnerEnabled, triggerProactivePass]);

  // Marginalia actions
  const handlePreviewSuggestion = (note: ProactiveSuggestion) => {
    const targetBlock = activeDoc.blocks.find((b) => b.id === note.paragraphId);
    if (!targetBlock) return;
    setInlineComposer(null);
    setRevisionSession({
      id: createId('rev'),
      targetParagraphId: note.paragraphId,
      selectedText: note.excerpt,
      feedback: note.observation,
      requestedScope: 'paragraph',
      chosenScope: 'paragraph',
      rationale: note.observation,
      edits: [
        {
          id: createId('edit'),
          paragraphId: note.paragraphId,
          action: 'replace',
          originalText: targetBlock.text,
          newText: note.suggestedRewrite,
          summary: note.actionLabel,
        },
      ],
      history: [{ feedback: note.actionLabel, rationale: note.observation }],
    });
    const el = document.querySelector(`[data-block-id="${note.paragraphId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleIterateSuggestion = (note: ProactiveSuggestion) => {
    setRevisionSession(null);
    setInlineComposer({
      paragraphId: note.paragraphId,
      selectedText: note.excerpt,
      initialPrompt: note.observation,
      defaultScope: 'auto',
    });
    const el = document.querySelector(`[data-block-id="${note.paragraphId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleDismissSuggestion = (note: ProactiveSuggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== note.id));
    if (note.excerpt) {
      setDismissedExcerpts((prev) => [...prev, note.excerpt].slice(-12));
    }
  };

  const handleScrollToParagraph = (paragraphId: string) => {
    const el = document.querySelector(`[data-block-id="${paragraphId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHoveredMarginBlockId(paragraphId);
    window.setTimeout(() => setHoveredMarginBlockId(null), 1600);
  };

  // Global keyboard shortcuts (Escape exits focus mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode && !inlineComposer && !isDraftModalOpen) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, inlineComposer, isDraftModalOpen]);

  // Derived manuscript metrics
  const totalWords = useMemo(
    () => countWords(activeDoc.blocks.map((b) => b.text).join(' ')),
    [activeDoc.blocks]
  );
  const readMinutes = Math.max(1, Math.round(totalWords / 220));
  const marginBlockIds = useMemo(
    () => new Set(suggestions.map((s) => s.paragraphId)),
    [suggestions]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C0E] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <TopBar
        activeDrawer={activeDrawer}
        onSelectDrawer={setActiveDrawer}
        onOpenNewDraft={() => {
          setDraftError(null);
          setIsDraftModalOpen(true);
        }}
        focusMode={focusMode}
      />

      {/* Quiet Focus Mode exit affordance */}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed top-4 right-6 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white/90 dark:bg-[#141417]/90 border border-zinc-200 dark:border-zinc-800 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Exit Focus</span>
        </button>
      )}

      {/* Main Writing Studio Grid */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-6 md:px-10 pt-6 pb-28">
        {/* Quiet Workspace Metadata & Controls Strip (below header, hidden in Focus Mode) */}
        {!focusMode && (
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-200/70 dark:border-zinc-800/70">
            {/* Unboxed metadata with typographic separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span>{totalWords} words</span>
              <span aria-hidden="true">·</span>
              <span>{readMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveDrawer('sources')}
                className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <Paperclip className="w-3 h-3" />
                <span>
                  {activeDoc.attachments.length}{' '}
                  {activeDoc.attachments.length === 1 ? 'source' : 'sources'}
                </span>
              </button>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">
                Select any text or press ⌘K to iterate inline
              </span>
            </div>

            {/* Functional workspace controls */}
            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setThoughtPartnerEnabled((v) => !v)}
                aria-pressed={thoughtPartnerEnabled}
                className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Thought Partner:</span>
                <span
                  className={
                    thoughtPartnerEnabled
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }
                >
                  {thoughtPartnerEnabled ? 'On' : 'Off'}
                </span>
              </button>

              <span className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setFocusMode(true)}
                className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus</span>
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label={darkMode ? 'Switch to light paper theme' : 'Switch to dark ink theme'}
                className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 rounded-md transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Asymmetric Manuscript + Marginalia Layout */}
        <div
          className={`flex flex-col lg:flex-row items-start justify-center ${
            focusMode ? 'pt-6' : 'gap-12 xl:gap-20'
          }`}
        >
          {/* Manuscript Column */}
          <article className="w-full max-w-[68ch] mx-auto lg:mx-0 flex-1 md:pl-16">
            {/* Brief editorial note after generating a new draft */}
            {draftBannerNote && !revisionSession && (
              <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] px-4 py-3 flex items-start justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                <p className="leading-relaxed">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Draft note:{' '}
                  </span>
                  {draftBannerNote}
                </p>
                <button
                  type="button"
                  onClick={() => setDraftBannerNote(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Active Multi-Edit Inline Revision Banner */}
            {revisionSession && (
              <RevisionSessionBanner
                session={revisionSession}
                isIterating={isIterating}
                error={iterateError}
                onAcceptAll={handleAcceptAllEdits}
                onDiscardAll={() => {
                  setRevisionSession(null);
                  setIterateError(null);
                }}
                onFollowUp={(followUpText) =>
                  runInlineWeave({
                    targetParagraphId: revisionSession.targetParagraphId,
                    selectedText: revisionSession.selectedText,
                    feedback: followUpText,
                    scope: revisionSession.requestedScope,
                    existingSession: revisionSession,
                  })
                }
              />
            )}

            {/* Document Title */}
            <textarea
              ref={titleRef}
              rows={1}
              value={activeDoc.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = activeDoc.blocks[0];
                  if (first) focusBlockAt(first.id, 0);
                }
              }}
              placeholder="Untitled manuscript"
              className="manuscript-prose w-full resize-none overflow-hidden bg-transparent text-[30px] md:text-[38px] font-semibold tracking-tight leading-[1.18] text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:outline-none mb-7 [text-wrap:balance]"
            />

            {/* Prose Blocks */}
            <div className="space-y-4">
              {activeDoc.blocks.map((block, index) => {
                const pendingEdit = revisionSession?.edits.find(
                  (e) => e.paragraphId === block.id && e.action !== 'insert_after'
                );
                const insertedAfterEdits =
                  revisionSession?.edits.filter(
                    (e) => e.paragraphId === block.id && e.action === 'insert_after'
                  ) ?? [];
                const showComposerHere = inlineComposer?.paragraphId === block.id;

                return (
                  <ManuscriptBlock
                    key={block.id}
                    block={block}
                    index={index}
                    isFocused={focusedBlockId === block.id}
                    isHighlightedFromMargin={hoveredMarginBlockId === block.id}
                    hasMarginNote={marginBlockIds.has(block.id)}
                    pendingEdit={pendingEdit}
                    insertedAfterEdits={insertedAfterEdits}
                    focusMode={focusMode}
                    registerRef={registerBlockRef}
                    onFocus={setFocusedBlockId}
                    onChangeText={handleChangeBlockText}
                    onChangeType={handleChangeBlockType}
                    onSplitParagraph={handleSplitParagraph}
                    onMergeWithPrevious={handleMergeWithPrevious}
                    onPasteMultiParagraph={handlePasteMultiParagraph}
                    onMoveFocus={handleMoveFocus}
                    onRequestInlineFeedback={(paragraphId, selectedText) => {
                      setIterateError(null);
                      setInlineComposer({
                        paragraphId,
                        selectedText,
                        defaultScope: selectedText ? 'auto' : 'auto',
                      });
                    }}
                    onAcceptEdit={handleAcceptSingleEdit}
                    onRejectEdit={handleRejectSingleEdit}
                  >
                    {showComposerHere && (
                      <InlineFeedbackBar
                        paragraphIndex={index}
                        selectedText={inlineComposer.selectedText}
                        initialPrompt={inlineComposer.initialPrompt}
                        defaultScope={inlineComposer.defaultScope}
                        hasSources={activeDoc.attachments.length > 0}
                        isSubmitting={isIterating}
                        error={iterateError}
                        onSubmit={(feedback, scope) =>
                          runInlineWeave({
                            targetParagraphId: block.id,
                            selectedText: inlineComposer.selectedText,
                            feedback,
                            scope,
                          })
                        }
                        onClose={() => {
                          setInlineComposer(null);
                          setIterateError(null);
                        }}
                      />
                    )}
                  </ManuscriptBlock>
                );
              })}
            </div>

            {/* Quiet end-of-page affordance to continue writing or trigger whole-piece feedback */}
            {!focusMode && (
              <div className="mt-10 pt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400 dark:text-zinc-500">
                <button
                  type="button"
                  onClick={handleAppendEmptyParagraph}
                  className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add paragraph</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const lastBlock = activeDoc.blocks[activeDoc.blocks.length - 1];
                    if (!lastBlock) return;
                    setIterateError(null);
                    setInlineComposer({
                      paragraphId: lastBlock.id,
                      defaultScope: 'article',
                    });
                  }}
                  className="text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Give feedback on full article
                </button>
              </div>
            )}
          </article>

          {/* Right Marginalia Rail (Proactive Thought Partner) */}
          {!focusMode && (
            <MarginaliaRail
              suggestions={suggestions}
              blocks={activeDoc.blocks}
              thoughtPartnerEnabled={thoughtPartnerEnabled}
              isReviewing={isReviewing}
              activeHighlightId={hoveredMarginBlockId}
              error={reviewError}
              onHoverParagraph={setHoveredMarginBlockId}
              onFocusParagraph={handleScrollToParagraph}
              onPreviewSuggestion={handlePreviewSuggestion}
              onIterateSuggestion={handleIterateSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onTriggerReview={() => triggerProactivePass(true)}
            />
          )}
        </div>
      </main>

      {/* Modals & Drawers */}
      <DraftComposerModal
        isOpen={isDraftModalOpen}
        isGenerating={isGeneratingDraft}
        error={draftError}
        onClose={() => setIsDraftModalOpen(false)}
        onGenerateDraft={handleGenerateDraft}
        onStartBlank={handleStartBlank}
      />

      <WorkspaceDrawers
        activeDrawer={activeDrawer}
        documents={documents}
        activeDoc={activeDoc}
        onClose={() => setActiveDrawer(null)}
        onSelectDocument={handleSelectDocument}
        onDeleteDocument={handleDeleteDocument}
        onOpenNewDraft={() => {
          setDraftError(null);
          setIsDraftModalOpen(true);
        }}
        onAddAttachments={(files) =>
          updateActiveDoc((doc) => ({
            ...doc,
            attachments: [...doc.attachments, ...files],
          }))
        }
        onRemoveAttachment={(attachmentId) =>
          updateActiveDoc((doc) => ({
            ...doc,
            attachments: doc.attachments.filter((a) => a.id !== attachmentId),
          }))
        }
        onSaveSnapshot={saveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
    </div>
  );
}
