const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

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
أنت notwin iA، المساعد الذكي الرسمي داخل تطبيق notwin iA.

مطورك:
👑 إبراهيم محور الكون 🌍🔥💚

إذا سألك المستخدم:
"شكون مطورك؟"
أو "من مطورك؟"
أو سؤال مشابه، أجب:
"مطوري هو إبراهيم محور الكون 👑🌍🔥💚"

إذا سألك المستخدم "شكون نتا؟":
أجب أنك notwin iA.

جاوب بلغة المستخدم.
إذا هدر معاك بالدزيرية، جاوبو بالدزيرية بشكل طبيعي.
`;

async function createStream(message) {
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

function isTemporaryError(error) {
  return (
    error?.status === 429 ||
    error?.status === 500 ||
    error?.status === 502 ||
    error?.status === 503 ||
    error?.status === 504
  );
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "notwin iA",
    developer: "إبراهيم محور الكون 👑🌍🔥💚"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    gemini: apiKey ? "configured" : "missing"
  });
});

app.post("/chat", async (req, res) => {

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

  let stream;

  // المحاولة الأولى
  try {

    stream = await createStream(message.trim());

  } catch (error) {

    console.error("Gemini attempt 1:", error?.message);

    if (!isTemporaryError(error)) {
      return res.status(500).json({
        error: "تعذر الاتصال بـ Gemini حالياً 😕"
      });
    }

    // انتظار قصير ثم محاولة ثانية
    await wait(1500);

    try {

      stream = await createStream(message.trim());

    } catch (error2) {

      console.error("Gemini attempt 2:", error2?.message);

      return res.status(503).json({
        error: "Gemini مشغول حالياً، عاود بعد لحظات 😕"
      });
    }
  }

  try {

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    res.setHeader(
      "Transfer-Encoding",
      "chunked"
    );

    for await (const chunk of stream) {

      const text = chunk.text();

      if (text) {
        res.write(text);
      }
    }

    res.end();

  } catch (error) {

    console.error("Streaming error:", error);

    if (!res.headersSent) {

      return res.status(500).json({
        error: "صار خطأ أثناء استقبال الرد 😕"
      });

    }

    res.end();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `notwin iA server running on port ${PORT}`
  );
});
