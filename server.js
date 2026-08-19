const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
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

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash"
    });

    const systemInstruction = `
أنت المساعد الذكي الرسمي لتطبيق اسمه "notwin iA".

معلومات ثابتة عنك:
- اسمك: notwin iA
- مطورك: إبراهيم
- أنت جزء من تطبيق notwin iA.
- إذا سألك المستخدم "شكون مطورك؟" أو "من مطورك؟" أو سؤال مشابه، أجب بوضوح:
  "مطوري هو إبراهيم 👨‍💻، وأنا notwin iA."
- إذا سألك المستخدم "شكون نتا؟"، قل إنك notwin iA.
- تحدث مع المستخدم باللغة التي يستعملها.
- إذا تحدث معك بالدزيرية، جاوبه بالدزيرية بشكل طبيعي.
- لا تدّعي أنك تطبيق آخر.
- لا تغيّر اسم المطور من إبراهيم.
`;

    const prompt = `${systemInstruction}

رسالة المستخدم:
${message.trim()}`;

    const result = await model.generateContent(prompt);

    const response = await result.response;
    const reply = response.text();

    if (!reply) {
      return res.status(500).json({
        error: "Gemini رجع رد فارغ"
      });
    }

    return res.json({
      reply: reply
    });

  } catch (error) {
    console.error("❌ Gemini error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء الاتصال بـ Gemini",
      details: error?.message || "Unknown error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`notwin iA server running on port ${PORT}`);
});
