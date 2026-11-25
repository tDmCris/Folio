import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type { Part } from "@google/genai";

export interface IncomingAttachment {
  name: string;
  mimeType: string;
  textContent?: string;
  base64Data?: string;
}

export interface IncomingBlock {
  id: string;
  type: "paragraph" | "heading" | "quote";
  text: string;
}

export interface DraftRequest {
  prompt: string;
  format?: string;
  tone?: string;
  length?: string;
  attachments?: IncomingAttachment[];
}

export interface IterateRequest {
  title: string;
  blocks: IncomingBlock[];
  targetParagraphId: string;
  selectedText?: string;
  feedback: string;
  scope: "auto" | "selection" | "paragraph" | "article";
  attachments?: IncomingAttachment[];
  priorFeedback?: Array<{ feedback: string; rationale: string }>;
  currentPendingEdits?: Array<{ paragraphId: string; newText: string }>;
}

export interface ProactiveRequest {
  title: string;
  blocks: IncomingBlock[];
  recentParagraphId?: string;
  dismissedExcerpts?: string[];
  attachments?: IncomingAttachment[];
  forceReview?: boolean;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error("GEMINI_API_KEY is not configured. Add it in Settings > Secrets."),
      { status: 500 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function buildAttachmentParts(attachments?: IncomingAttachment[]): Part[] {
  if (!attachments || attachments.length === 0) return [];
  const parts: Part[] = [];
  for (const file of attachments) {
    if (file.base64Data && file.mimeType) {
      parts.push({
        text: `Reference file attached: "${file.name}" (${file.mimeType})`,
      });
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.base64Data,
        },
      });
    } else if (file.textContent) {
      const clipped = file.textContent.slice(0, 40000);
      parts.push({
        text: `--- Reference File: ${file.name} ---\n${clipped}\n--- End of ${file.name} ---`,
      });
    }
  }
  return parts;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 450 * attempt));
      }
    }
  }
  throw lastError;
}

export async function generateInitialDraft(req: DraftRequest) {
  const ai = getClient();
  const attachmentParts = buildAttachmentParts(req.attachments);

  const lengthGuidance =
    req.length === "short"
      ? "Keep it concise: roughly 200 to 320 words across 3-4 crisp paragraphs."
      : req.length === "long"
        ? "Develop it thoroughly: roughly 700 to 1000 words with clear section headings and well-paced paragraphs."
        : "Aim for a focused, substantive piece: roughly 400 to 600 words across 5-7 paragraphs.";

  const systemInstruction = `You are a celebrated literary and editorial ghostwriter collaborating directly inside a distraction-free manuscript studio.
Write with clarity, specificity, human cadence, and intellectual honesty.
Avoid generic AI clichés ("In today's fast-paced world", "delve into", "tapestry", "game-changer", "it's worth noting", "unlock the power").
Ground claims in concrete details from any attached reference files whenever relevant.
Format: ${req.format || "Essay"}.
Tone: ${req.tone || "Clear, thoughtful, and sharp"}.
${lengthGuidance}
Return structured JSON matching the schema. Do not include markdown syntax like ** or # inside block text; express section breaks using block type "heading" and pull quotes using "quote".`;

  const promptPart: Part = {
    text: `Writing brief:\n${req.prompt.trim()}`,
  };

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts: [...attachmentParts, promptPart] },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A compelling, specific, publication-grade title.",
            },
            blocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ["paragraph", "heading", "quote"],
                  },
                  text: {
                    type: Type.STRING,
                    description: "Clean prose without raw markdown markers.",
                  },
                },
                required: ["type", "text"],
              },
            },
            editorNote: {
              type: Type.STRING,
              description:
                "A brief 1-sentence note on the angle taken or how attached sources were woven in.",
            },
          },
          required: ["title", "blocks", "editorNote"],
        },
      },
    })
  );

  const raw = (response.text ?? "{}").trim();
  return JSON.parse(raw);
}

export async function iterateInline(req: IterateRequest) {
  const ai = getClient();
  const attachmentParts = buildAttachmentParts(req.attachments);

  const numberedDoc = req.blocks
    .map(
      (b, idx) =>
        `[${b.id}] (${b.type.toUpperCase()} #${idx + 1}): ${b.text || "(empty)"}`
    )
    .join("\n\n");

  const scopeInstruction =
    req.scope === "selection"
      ? `The writer explicitly locked scope to "selection". Surgically revise ONLY the targeted sentence/phrase inside paragraph [${req.targetParagraphId}], preserving the rest of the paragraph verbatim unless minimal grammar repair is required. Return a single replace edit for [${req.targetParagraphId}].`
      : req.scope === "paragraph"
        ? `The writer explicitly locked scope to "paragraph". Rewrite ONLY paragraph [${req.targetParagraphId}] to cleanly weave in their feedback while fitting naturally with surrounding paragraphs.`
        : req.scope === "article"
          ? `The writer explicitly chose "article" scope. Weave their feedback across the entire manuscript—updating [${req.targetParagraphId}] and any other paragraphs that should shift in tone, structure, argument, or callback to keep the whole piece seamless. Only include paragraphs in "edits" that actually changed.`
          : `The writer selected "auto" (Smart Weave). Use sharp editorial judgment to decide the best scope:
- Choose "selection" if the feedback is a local phrasing, word-choice, or single-sentence fix. Keep the rest of [${req.targetParagraphId}] intact.
- Choose "paragraph" if the feedback reshapes the point, clarity, or evidence of [${req.targetParagraphId}] without breaking other paragraphs.
- Choose "article" if the feedback introduces a new angle, voice shift, structural tweak, or core claim that should ripple cleanly into other paragraphs (or add a bridge paragraph) so the whole piece reads as one cohesive draft. Only include modified or newly inserted paragraphs in "edits".`;

  const priorContext =
    req.priorFeedback && req.priorFeedback.length > 0
      ? `\nPrevious inline rounds on this revision:\n${req.priorFeedback
          .map((item, i) => `Round ${i + 1} feedback: "${item.feedback}" -> Applied: ${item.rationale}`)
          .join("\n")}`
      : "";

  const pendingContext =
    req.currentPendingEdits && req.currentPendingEdits.length > 0
      ? `\nCurrent pending draft edits that the writer is now refining:\n${req.currentPendingEdits
          .map((e) => `[${e.paragraphId}] => ${e.newText}`)
          .join("\n")}`
      : "";

  const systemInstruction = `You are an elite human-caliber developmental and line editor inside Folio, a distraction-free writing canvas.
Your job is to weave the writer's inline feedback directly into their manuscript cleanly, matching their authentic voice and rhythm.
Never add robotic filler or meta-commentary inside the prose itself. Never use markdown markers like ** or # inside block text.
${scopeInstruction}
For every edit:
- Use action "replace" with an existing paragraphId from the document to update that paragraph's full text.
- Use action "insert_after" with an existing paragraphId if a brand-new paragraph or heading should be inserted immediately after that paragraph.
- Use action "delete" with an existing paragraphId if a paragraph should be cut entirely (set newText to "").
Make sure every paragraphId in edits matches an exact ID shown in brackets in the manuscript.`;

  const userPrompt = `Document Title: ${req.title || "Untitled"}

Current Manuscript:
${numberedDoc}

Target Paragraph ID: [${req.targetParagraphId}]
${req.selectedText ? `Selected Text inside target paragraph: "${req.selectedText}"` : "No specific sub-phrase highlighted (targeting paragraph/context)."}
${priorContext}${pendingContext}

Writer's Inline Feedback:
"${req.feedback}"

Return JSON with chosenScope, rationale (1 concise sentence explaining why you edited at that scope and how you wove the feedback in), edits, and optional suggestedTitle (only populate suggestedTitle if the title itself should evolve to match an article-wide change, otherwise omit or set empty string).`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts: [...attachmentParts, { text: userPrompt }] },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chosenScope: {
              type: Type.STRING,
              enum: ["selection", "paragraph", "article"],
            },
            rationale: {
              type: Type.STRING,
              description:
                "A crisp, 1-sentence editorial explanation of how and where the change was woven in.",
            },
            suggestedTitle: {
              type: Type.STRING,
              description:
                "Optional updated title only if article-wide edits warrant changing the headline; otherwise empty string.",
            },
            edits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  paragraphId: {
                    type: Type.STRING,
                    description: "Exact existing paragraph ID from the manuscript.",
                  },
                  action: {
                    type: Type.STRING,
                    enum: ["replace", "insert_after", "delete"],
                  },
                  newText: {
                    type: Type.STRING,
                    description: "Complete revised or inserted block text.",
                  },
                  newType: {
                    type: Type.STRING,
                    enum: ["paragraph", "heading", "quote"],
                  },
                  summary: {
                    type: Type.STRING,
                    description: "Very short 3-6 word summary of this paragraph's edit.",
                  },
                },
                required: ["paragraphId", "action", "newText", "summary"],
              },
            },
          },
          required: ["chosenScope", "rationale", "edits"],
        },
      },
    })
  );

  const raw = (response.text ?? "{}").trim();
  return JSON.parse(raw);
}

export async function runProactiveReview(req: ProactiveRequest) {
  const ai = getClient();
  const attachmentParts = buildAttachmentParts(req.attachments);

  const nonEmptyBlocks = req.blocks.filter((b) => b.text.trim().length > 0);
  if (nonEmptyBlocks.length === 0) {
    return { shouldIntervene: false, suggestions: [] };
  }

  const numberedDoc = nonEmptyBlocks
    .map((b, idx) => `[${b.id}] (${b.type} #${idx + 1}): ${b.text}`)
    .join("\n\n");

  const dismissed =
    req.dismissedExcerpts && req.dismissedExcerpts.length > 0
      ? `\nDo NOT repeat suggestions on these already-dismissed excerpts: ${req.dismissedExcerpts.join(" | ")}`
      : "";

  const systemInstruction = `You are a perceptive, restrained literary editor quietly reading alongside a writer.
${
  req.forceReview
    ? "The writer explicitly asked for an editorial margin review. Provide 2 to 3 of the highest-leverage, specific, non-obvious suggestions that genuinely elevate clarity, argument strength, voice, flow, or grounding in attached reference files."
    : "You are observing quietly in the background. Respect the writer's flow: ONLY set shouldIntervene to true if there is a genuinely high-leverage improvement (a buried lead, an unsupported claim that an attached source can back up, a clunky transition, a logical gap, or redundant phrasing). If the writing is already sharp and flowing well, set shouldIntervene to false and return an empty array. Return at most 1-2 suggestions."
}
Rules:
- Each suggestion must point to an exact existing paragraphId from the manuscript.
- "excerpt" must be a verbatim short phrase (4 to 14 words) copied exactly from that paragraph.
- "observation" must be concise (1-2 crisp sentences), insightful, and written like a trusted human editor — never patronizing, never generic praise.
- "suggestedRewrite" must be a complete, ready-to-apply replacement for the entire text of that paragraph that preserves the writer's voice while cleanly executing the improvement.
- "actionLabel" must be a crisp 2-4 word label (e.g., "Sharpen opening claim", "Cite Q3 churn metric", "Tighten transition").`;

  const userPrompt = `Title: ${req.title || "Untitled"}
${req.recentParagraphId ? `Most recently edited paragraph: [${req.recentParagraphId}]` : ""}
${dismissed}

Manuscript:
${numberedDoc}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: { parts: [...attachmentParts, { text: userPrompt }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shouldIntervene: {
              type: Type.BOOLEAN,
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  paragraphId: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    enum: ["clarity", "argument", "evidence", "flow", "voice"],
                  },
                  excerpt: { type: Type.STRING },
                  observation: { type: Type.STRING },
                  suggestedRewrite: { type: Type.STRING },
                  actionLabel: { type: Type.STRING },
                },
                required: [
                  "paragraphId",
                  "category",
                  "excerpt",
                  "observation",
                  "suggestedRewrite",
                  "actionLabel",
                ],
              },
            },
          },
          required: ["shouldIntervene", "suggestions"],
        },
      },
    })
  );

  const raw = (response.text ?? "{}").trim();
  return JSON.parse(raw);
}
