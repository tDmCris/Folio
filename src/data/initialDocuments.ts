import type { WritingDocument } from '../types/writing';

export const INITIAL_DOCUMENTS: WritingDocument[] = [
  {
    id: 'doc_editorial_workflow',
    title: 'Why Writing with AI Still Feels Like Relay Racing',
    createdAt: Date.now() - 1000 * 60 * 42,
    updatedAt: Date.now() - 1000 * 60 * 5,
    blocks: [
      {
        id: 'p_intro_1',
        type: 'paragraph',
        text: 'Most writers using AI today live inside an exhausting copy-paste loop. You prompt a chat window for a first draft, haul the result into a document, read a clunky paragraph, haul it back into the chat box with a note, wait for a full regeneration, and splice the pieces together by hand.',
      },
      {
        id: 'p_body_2',
        type: 'paragraph',
        text: 'The friction is not just mechanical—it breaks the rhythm of thought. Good writing rarely happens in giant wholesale replacements. It happens when a sharp remark in the margin forces you to tighten a single sentence, and that tighter sentence quietly changes how the rest of the piece should land.',
      },
      {
        id: 'p_head_3',
        type: 'heading',
        text: 'Editing at the exact grain of the thought',
      },
      {
        id: 'p_body_4',
        type: 'paragraph',
        text: 'Sometimes a note only deserves a surgical five-word swap. Other times, a piece of feedback on paragraph two exposes a contradiction in your conclusion. A real collaborator understands that difference automatically and weaves the change through the manuscript without making you start over.',
      },
      {
        id: 'p_body_5',
        type: 'paragraph',
        text: 'When the draft, the source material, and the editor inhabit the same quiet page, revision stops feeling like file management and starts feeling like thinking out loud.',
      },
    ],
    attachments: [
      {
        id: 'src_field_notes',
        name: 'writer-interviews-q3.md',
        mimeType: 'text/markdown',
        sizeBytes: 1248,
        addedAt: Date.now() - 1000 * 60 * 35,
        previewText:
          'Field notes from 18 newsletter & essay writers: 74% switch tabs 12+ times per article; biggest complaint is losing voice on full rewrites.',
        textContent: `# Writer Workflow Field Notes (Q3, n=18)

Key observations from interviews with independent essayists, product leaders, and journalists:
- 74% of respondents switch between a chat window and their editor more than 12 times per finished piece.
- Average time spent manually reconciling pasted paragraphs back into a draft: 19 minutes per 1,000-word article.
- Biggest frustration: asking a chat assistant to tweak one idea causes it to subtly flatten or rewrite sentences the writer actually loved.
- Most requested behavior: "Read over my shoulder quietly, flag when I bury the point or miss a fact from my notes, and let me approve a clean diff right on the sentence."`,
      },
    ],
    snapshots: [
      {
        id: 'snap_initial',
        label: 'Initial opening draft',
        createdAt: Date.now() - 1000 * 60 * 30,
        title: 'Why Writing with AI Still Feels Like Relay Racing',
        blocks: [
          {
            id: 'p_intro_1',
            type: 'paragraph',
            text: 'Most writers using AI today live inside an exhausting copy-paste loop. You prompt a chat window for a first draft, haul the result into a document, read a clunky paragraph, haul it back into the chat box with a note, wait for a full regeneration, and splice the pieces together by hand.',
          },
          {
            id: 'p_body_2',
            type: 'paragraph',
            text: 'The friction is not just mechanical—it breaks the rhythm of thought. Good writing rarely happens in giant wholesale replacements.',
          },
        ],
      },
    ],
  },
  {
    id: 'doc_product_memo',
    title: 'Q4 Launch Memo: Quiet Software',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
    blocks: [
      {
        id: 'pm_1',
        type: 'paragraph',
        text: 'This quarter we are shipping fewer visible buttons and focusing on latency, reliability, and calm defaults. Every feature we cut from the toolbar buys back cognitive headroom for the person trying to finish hard work.',
      },
      {
        id: 'pm_2',
        type: 'paragraph',
        text: 'Success will not be measured by how many times users open a sidebar, but by how quickly an idea becomes a finished memo without breaking flow.',
      },
    ],
    attachments: [],
    snapshots: [],
  },
];
