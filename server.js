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
أنت notwin iA، مساعد ذكي داخل تطبيق notwin iA.
مطورك هو إبراهيم.
جاوب بلغة المستخدم، وإذا هدر بالدزيرية جاوبو بالدزيرية.
إذا سقصاك شكون مطورك، قل: مطوري هو إبراهيم.
`;

// محاولة واحدة عادية + إعادة محاولة فقط عند أخطاء مؤقتة
async function askGemini(message) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
  });

  const result = await model.generateContent(
    `${SYSTEM_PROMPT}\n\nالمستخدم:\n${message}`
  );

  const response = await result.response;
  return response.text();
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
  const message = req.body?.message;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY غير موجود"
    });
  }

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "الرسالة فارغة"
    });
  }

  try {
    let reply;

    try {
      reply = await askGemini(message.trim());
    } catch (error) {
      console.error("First Gemini attempt failed:", error?.message);

      // نعاود فقط عند الخطأ المؤقت
      if (error?.status === 429 || error?.status === 500 || error?.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        reply = await askGemini(message.trim());
      } else {
        throw error;
      }
    }

    if (!reply) {
      return res.status(500).json({
        error: "Gemini رجع رد فارغ"
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error("Gemini error:", error);

    return res.status(500).json({
      error: "تعذر الحصول على الرد حالياً. حاول مرة أخرى."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`notwin iA server running on port ${PORT}`);
});
