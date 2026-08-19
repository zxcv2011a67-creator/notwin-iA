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

async function askGemini(message) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
  });

  const systemInstruction = `
أنت المساعد الذكي الرسمي لتطبيق اسمه "notwin iA".

معلومات ثابتة:
- اسمك: notwin iA
- مطورك: إبراهيم
- إذا سألك المستخدم عن مطورك، قل بوضوح إن مطورك هو إبراهيم.
- إذا سألك من أنت، قل إنك notwin iA.
- تحدث بلغة المستخدم.
- إذا تحدث المستخدم بالدزيرية، جاوبه بالدزيرية بشكل طبيعي.
`;

  const prompt = `${systemInstruction}

رسالة المستخدم:
${message}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

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

    let reply;

    // المحاولة الأولى
    try {
      reply = await askGemini(message.trim());
    } catch (error) {
      console.error("المحاولة الأولى فشلت:", error?.message);

      // نعاود المحاولة بعد ثانيتين
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        reply = await askGemini(message.trim());
      } catch (error2) {
        console.error("المحاولة الثانية فشلت:", error2?.message);

        // محاولة ثالثة بعد 4 ثواني
        await new Promise(resolve => setTimeout(resolve, 4000));

        reply = await askGemini(message.trim());
      }
    }

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
      error: "تعذر الحصول على رد من Gemini حالياً. حاول مرة أخرى بعد قليل."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`notwin iA server running on port ${PORT}`);
});
