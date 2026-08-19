const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json({ limit: "1mb" }));

// السماح للتطبيق بالاتصال بالسيرفر
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
  console.error("❌ GEMINI_API_KEY is missing");
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "notwin iA",
    message: "notwin iA server is running"
  });
});

// فحص السيرفر
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    gemini: apiKey ? "configured" : "missing"
  });
});

// الدردشة
app.post("/chat", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Render"
      });
    }

    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "الرسالة فارغة"
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const result = await model.generateContent(message.trim());

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
  console.log(`✅ notwin iA server running on port ${PORT}`);
});
