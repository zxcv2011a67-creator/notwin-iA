const express = require("express");

const app = express();

app.use(express.json({ limit: "10mb" }));

// ========================================
// CORS
// ========================================

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


// ========================================
// الإعدادات
// ========================================

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;


// ========================================
// API الشات الجديد
// ========================================

const CHAT_API =
  "https://norch-project.gleeze.com/api/gemini/2.5/flash-lite";


// ========================================
// شخصية notwin iA
// ========================================

const SYSTEM_PROMPT = `
أنت notwin iA، المساعد الذكي الرسمي داخل تطبيق notwin iA.

مطورك:
إبراهيم محور الكون 👑🌍🔥💚

إذا سألك المستخدم:
شكون مطورك؟
من مطورك؟
شكون دارك؟
من صنعك؟
أو أي سؤال مشابه عن المطور، أجب:

مطوري هو إبراهيم محور الكون 👑🌍🔥💚

إذا سألك المستخدم:
شكون نتا؟
من أنت؟
أجب:

أنا notwin iA، مساعدك الذكي.

جاوب دائمًا بلغة المستخدم.

إذا كان المستخدم يهدر بالدزيرية، جاوبو بالدزيرية بشكل طبيعي.

إذا كان السؤال بسيطًا، جاوب باختصار.

إذا لم تعرف الإجابة، قل إنك لا تعرف بدل اختراع معلومات.

كن واضحًا ومفيدًا ومحترمًا.
`;


// ========================================
// بناء السؤال
// ========================================

function buildPrompt(message) {

  return `${SYSTEM_PROMPT}

رسالة المستخدم:
${message}

أجب المستخدم مباشرة بدون شرح للتعليمات.`;

}


// ========================================
// CHAT
// ========================================

app.post("/chat", async (req, res) => {

  const message = req.body?.message;

  // التحقق من الرسالة
  if (
    typeof message !== "string" ||
    !message.trim()
  ) {

    return res.status(400).json({
      error: "الرسالة فارغة."
    });

  }


  const finalPrompt =
    buildPrompt(message.trim());


  try {

    const apiUrl =
      `${CHAT_API}?prompt=${encodeURIComponent(finalPrompt)}`;


    const response =
      await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });


    let data = {};

    try {

      data = await response.json();

    } catch (error) {

      console.error(
        "Invalid JSON from chat API:",
        error
      );

    }


    // API رجع خطأ
    if (!response.ok) {

      console.error(
        "Chat API error:",
        response.status,
        data
      );

      return res.status(502).json({
        error:
          "خدمة الذكاء الاصطناعي غير متاحة حاليًا، عاود بعد شوية 😕"
      });

    }


    // استخراج الرد
    const answer =
      data?.response ||
      data?.answer ||
      data?.text;


    if (
      typeof answer !== "string" ||
      !answer.trim()
    ) {

      console.error(
        "Empty AI response:",
        data
      );

      return res.status(502).json({
        error:
          "الذكاء الاصطناعي ما رجعش رد حاليًا 😕"
      });

    }


    // نفس النظام القديم:
    // الواجهة تستقبل نص عادي
    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.send(answer.trim());


  } catch (error) {

    console.error(
      "Chat API connection error:",
      error
    );

    return res.status(503).json({
      error:
        "تعذر الاتصال بخدمة الذكاء الاصطناعي 😕\nعاود المحاولة بعد شوية."
    });

  }

});


// ========================================
// توليد الصور بواسطة Gemini
// ========================================

app.post(
  "/generate-image",
  async (req, res) => {

    if (!GEMINI_API_KEY) {

      return res.status(500).json({
        error:
          "مفتاح Gemini غير موجود في Render."
      });

    }


    const prompt =
      req.body?.prompt;


    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {

      return res.status(400).json({
        error:
          "وصف الصورة فارغ."
      });

    }


    try {

      const imageApiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent";


      const response =
        await fetch(
          imageApiUrl,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-goog-api-key":
                GEMINI_API_KEY
            },

            body: JSON.stringify({

              contents: [
                {
                  parts: [
                    {
                      text:
                        prompt.trim()
                    }
                  ]
                }
              ],

              generationConfig: {
                responseModalities:
                  ["IMAGE"]
              }

            })
          }
        );


      let data = {};

      try {

        data =
          await response.json();

      } catch (error) {

        console.error(
          "Invalid image API response:",
          error
        );

      }


      // حد Gemini
      if (
        response.status === 429
      ) {

        return res.status(429).json({
          error:
            "وصلت للحد المجاني لتوليد الصور حاليًا 😴💕"
        });

      }


      if (!response.ok) {

        console.error(
          "Gemini image error:",
          response.status,
          data
        );

        return res.status(
          response.status
        ).json({
          error:
            "ما قدرناش نولد الصورة حاليًا 😕"
        });

      }


      const parts =
        data?.candidates?.[0]?.content?.parts || [];


      const imagePart =
        parts.find(
          part =>
            part?.inlineData ||
            part?.inline_data
        );


      if (!imagePart) {

        return res.status(500).json({
          error:
            "Gemini ما رجعش صورة."
        });

      }


      const imageData =
        imagePart.inlineData ||
        imagePart.inline_data;


      return res.json({

        success: true,

        mimeType:
          imageData.mimeType ||
          imageData.mime_type ||
          "image/png",

        image:
          imageData.data

      });


    } catch (error) {

      console.error(
        "Image generation error:",
        error
      );

      return res.status(500).json({
        error:
          "صار خطأ أثناء توليد الصورة 😕"
      });

    }

  }
);


// ========================================
// الصفحة الرئيسية
// ========================================

app.get("/", (req, res) => {

  res.json({

    status: "online",

    app: "notwin iA",

    chat: "norch-project Gemini 2.5 Flash Lite",

    images:
      GEMINI_API_KEY
        ? "Gemini configured"
        : "Gemini key missing",

    developer:
      "إبراهيم محور الكون 👑🌍🔥💚"

  });

});


// ========================================
// Health
// ========================================

app.get("/health", (req, res) => {

  res.json({

    status: "ok",

    chat:
      "configured",

    geminiImages:
      GEMINI_API_KEY
        ? "configured"
        : "missing"

  });

});


// ========================================
// تشغيل السيرفر
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `notwin iA server running on port ${PORT}`
    );

  }
);
