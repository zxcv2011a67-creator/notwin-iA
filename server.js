const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is missing");
}

const genAI = apiKey
  ? new GoogleGenerativeAI(apiKey)
  : null;

const SYSTEM_PROMPT = `
أنت notwin iA، مساعد ذكي داخل تطبيق notwin iA.
مطورك هو إبراهيم.
جاوب بلغة المستخدم.
إذا هدر المستخدم بالدزيرية، جاوبه بالدزيرية.
إذا سقصاك شكون مطورك، قل: مطوري هو إبراهيم.
`;

async function askGemini(message) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
  });

  const result = await model.generateContentStream(
    `${SYSTEM_PROMPT}

المستخدم:
${message}`
  );

  return result.stream;
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "notwin iA",
    developer: "إبراهيم"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    gemini: apiKey ? "configured" : "missing"
  });
});

app.post("/chat", async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود"
      });
    }

    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "الرسالة فارغة"
      });
    }

    const stream = await askGemini(message.trim());

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of stream) {
      const text = chunk.text();

      if (text) {
        res.write(text);
      }
    }

    res.end();

  } catch (error) {
    console.error("❌ Gemini error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "تعذر الحصول على الرد حالياً. حاول مرة أخرى."
      });
    }

    res.end();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`notwin iA server running on port ${PORT}`);
});
