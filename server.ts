import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateInitialDraft,
  iterateInline,
  runProactiveReview,
} from "./server/gemini.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

function formatGeminiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; message?: string };
  const rawMessage = errorObj?.message || "Unexpected error communicating with Gemini.";
  const status = typeof errorObj?.status === "number" ? errorObj.status : 500;

  if (status === 403 || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key is missing or invalid. Check your key in Settings > Secrets.",
    };
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Rate limit reached. Please wait a moment and try again, or check quota in Settings > Secrets.",
    };
  }
  if (status === 404 || rawMessage.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `Model error: ${rawMessage}`,
    };
  }
  return { status, message: rawMessage };
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/ai/draft", async (req, res) => {
    try {
      const { prompt, format, tone, length, attachments } = req.body ?? {};
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "Please provide a writing prompt." });
      }
      const result = await generateInitialDraft({
        prompt,
        format,
        tone,
        length,
        attachments,
      });
      return res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      console.error("[/api/ai/draft]", err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/ai/iterate", async (req, res) => {
    try {
      const {
        title,
        blocks,
        targetParagraphId,
        selectedText,
        feedback,
        scope,
        attachments,
        priorFeedback,
        currentPendingEdits,
      } = req.body ?? {};

      if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
        return res.status(400).json({ error: "Please enter feedback for Folio to weave in." });
      }
      if (!Array.isArray(blocks) || blocks.length === 0) {
        return res.status(400).json({ error: "Manuscript content is required." });
      }

      const result = await iterateInline({
        title: typeof title === "string" ? title : "",
        blocks,
        targetParagraphId: targetParagraphId || blocks[0].id,
        selectedText,
        feedback,
        scope: scope || "auto",
        attachments,
        priorFeedback,
        currentPendingEdits,
      });
      return res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      console.error("[/api/ai/iterate]", err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/ai/proactive", async (req, res) => {
    try {
      const {
        title,
        blocks,
        recentParagraphId,
        dismissedExcerpts,
        attachments,
        forceReview,
      } = req.body ?? {};

      if (!Array.isArray(blocks) || blocks.length === 0) {
        return res.json({ shouldIntervene: false, suggestions: [] });
      }

      const result = await runProactiveReview({
        title: typeof title === "string" ? title : "",
        blocks,
        recentParagraphId,
        dismissedExcerpts,
        attachments,
        forceReview: Boolean(forceReview),
      });
      return res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      console.error("[/api/ai/proactive]", err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req, res) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Folio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
