export type BlockType = 'paragraph' | 'heading' | 'quote';

export interface ParagraphBlock {
  id: string;
  type: BlockType;
  text: string;
}

export interface SourceAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: number;
  /** Plain text content for text/markdown/csv/json files */
  textContent?: string;
  /** Base64 payload (without data URL prefix) for PDFs and images */
  base64Data?: string;
  /** Short human-readable preview snippet */
  previewText?: string;
}

export type RewriteScope = 'auto' | 'selection' | 'paragraph' | 'article';
export type ResolvedScope = 'selection' | 'paragraph' | 'article';

export interface ProposedEdit {
  id: string;
  paragraphId: string;
  action: 'replace' | 'insert_after' | 'delete';
  originalText: string;
  newText: string;
  newType?: BlockType;
  summary: string;
}

export interface InlineRevisionSession {
  id: string;
  targetParagraphId: string;
  selectedText?: string;
  feedback: string;
  requestedScope: RewriteScope;
  chosenScope: ResolvedScope;
  rationale: string;
  edits: ProposedEdit[];
  suggestedTitle?: string;
  history: Array<{ feedback: string; rationale: string }>;
}

export type SuggestionCategory =
  | 'clarity'
  | 'argument'
  | 'evidence'
  | 'flow'
  | 'voice';

export interface ProactiveSuggestion {
  id: string;
  paragraphId: string;
  category: SuggestionCategory;
  excerpt: string;
  observation: string;
  suggestedRewrite: string;
  actionLabel: string;
  createdAt: number;
}

export interface DocumentSnapshot {
  id: string;
  label: string;
  createdAt: number;
  title: string;
  blocks: ParagraphBlock[];
}

export interface WritingDocument {
  id: string;
  title: string;
  subtitle?: string;
  blocks: ParagraphBlock[];
  attachments: SourceAttachment[];
  snapshots: DocumentSnapshot[];
  updatedAt: number;
  createdAt: number;
}
