import type {
  BlockType,
  ParagraphBlock,
  ResolvedScope,
  RewriteScope,
  SourceAttachment,
  SuggestionCategory,
} from '../types/writing';

function serializeAttachments(attachments: SourceAttachment[]) {
  return attachments.map((a) => ({
    name: a.name,
    mimeType: a.mimeType,
    textContent: a.textContent,
    base64Data: a.base64Data,
  }));
}

export interface DraftResponse {
  title: string;
  blocks: Array<{ type: BlockType; text: string }>;
  editorNote: string;
}

export async function requestDraft(params: {
  prompt: string;
  format: string;
  tone: string;
  length: string;
  attachments: SourceAttachment[];
}): Promise<DraftResponse> {
  const res = await fetch('/api/ai/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.prompt,
      format: params.format,
      tone: params.tone,
      length: params.length,
      attachments: serializeAttachments(params.attachments),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Could not generate draft.');
  }
  return data as DraftResponse;
}

export interface IterateResponse {
  chosenScope: ResolvedScope;
  rationale: string;
  suggestedTitle?: string;
  edits: Array<{
    paragraphId: string;
    action: 'replace' | 'insert_after' | 'delete';
    newText: string;
    newType?: BlockType;
    summary: string;
  }>;
}

export async function requestInlineIteration(params: {
  title: string;
  blocks: ParagraphBlock[];
  targetParagraphId: string;
  selectedText?: string;
  feedback: string;
  scope: RewriteScope;
  attachments: SourceAttachment[];
  priorFeedback?: Array<{ feedback: string; rationale: string }>;
  currentPendingEdits?: Array<{ paragraphId: string; newText: string }>;
}): Promise<IterateResponse> {
  const res = await fetch('/api/ai/iterate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      blocks: params.blocks,
      targetParagraphId: params.targetParagraphId,
      selectedText: params.selectedText,
      feedback: params.feedback,
      scope: params.scope,
      attachments: serializeAttachments(params.attachments),
      priorFeedback: params.priorFeedback,
      currentPendingEdits: params.currentPendingEdits,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Could not weave inline feedback.');
  }
  return data as IterateResponse;
}

export interface ProactiveResponse {
  shouldIntervene: boolean;
  suggestions: Array<{
    paragraphId: string;
    category: SuggestionCategory;
    excerpt: string;
    observation: string;
    suggestedRewrite: string;
    actionLabel: string;
  }>;
}

export async function requestProactiveReview(params: {
  title: string;
  blocks: ParagraphBlock[];
  recentParagraphId?: string;
  dismissedExcerpts?: string[];
  attachments: SourceAttachment[];
  forceReview?: boolean;
}): Promise<ProactiveResponse> {
  const res = await fetch('/api/ai/proactive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      blocks: params.blocks,
      recentParagraphId: params.recentParagraphId,
      dismissedExcerpts: params.dismissedExcerpts,
      attachments: serializeAttachments(params.attachments),
      forceReview: params.forceReview,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Could not review draft.');
  }
  return data as ProactiveResponse;
}
