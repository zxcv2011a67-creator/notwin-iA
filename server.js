const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json({ limit: "10mb" }));

// السماح للتطبيق بالاتصال بالسيرفر
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

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error(
    "GEMINI_API_KEY is missing"
  );
}

const genAI = apiKey
  ? new GoogleGenerativeAI(apiKey)
  : null;


// ===============================
// شخصية notwin iA
// ===============================

const SYSTEM_PROMPT = `
أنت notwin iA، المساعد الذكي الرسمي داخل تطبيق notwin iA.

مطورك:
👑 إبراهيم محور الكون 🌍🔥💚

إذا سألك المستخدم:
"شكون مطورك؟"
أو:
"من مطورك؟"
أو أي سؤال مشابه عن المطور، أجب:

"مطوري هو إبراهيم محور الكون 👑🌍🔥💚"

إذا سألك:
"شكون نتا؟"
أجب أنك notwin iA.

جاوب بلغة المستخدم.

إذا كان المستخدم يهدر بالدزيرية،
جاوب بالدزيرية بشكل طبيعي.

كن منطقيًا وواضحًا ومختصرًا عندما يكون السؤال بسيطًا.

إذا لم تعرف الإجابة، قل ذلك بصراحة ولا تخترع معلومات.
`;


// ===============================
// CHAT
// ===============================

async function createStream(message) {

  const model =
    genAI.getGenerativeModel({
      model: "gemini-3.6-flash"
    });

  const result =
    await model.generateContentStream(
      `${SYSTEM_PROMPT}

المستخدم:
${message}`
    );

  return result.stream;
}


// ===============================
// أخطاء مؤقتة
// ===============================

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

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );

}


// ===============================
// الصفحة الرئيسية
// ===============================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    app: "notwin iA",
    developer:
      "إبراهيم محور الكون 👑🌍🔥💚"
  });

});


// ===============================
// Health
// ===============================

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    gemini:
      apiKey
        ? "configured"
        : "missing"
  });

});


// ===============================
// CHAT API
// ===============================

app.post("/chat", async (req, res) => {

  if (!genAI) {

    return res.status(500).json({
      error:
        "مفتاح Gemini غير موجود في السيرفر."
    });

  }

  const message =
    req.body?.message;

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {

    return res.status(400).json({
      error:
        "الرسالة فارغة."
    });

  }

  let stream;

  try {

    stream =
      await createStream(
        message.trim()
      );

  } catch (error) {

    console.error(
      "Gemini attempt 1:",
      error?.message
    );

    // الحد اليومي
    if (error?.status === 429) {

      return res.status(429).json({
        error:
          "وصلت للحد الأقصى من المحاولات المجانية اليوم."
      });

    }

    if (!isTemporaryError(error)) {

      return res.status(500).json({
        error:
          "تعذر الاتصال بـ Gemini حالياً."
      });

    }

    await wait(1500);

    try {

      stream =
        await createStream(
          message.trim()
        );

    } catch (error2) {

      console.error(
        "Gemini attempt 2:",
        error2?.message
      );

      if (error2?.status === 429) {

        return res.status(429).json({
          error:
            "وصلت للحد الأقصى من المحاولات المجانية اليوم."
        });

      }

      return res.status(503).json({
        error:
          "Gemini مشغول حالياً، عاود بعد لحظات 😕"
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

    for await (
      const chunk of stream
    ) {

      const text =
        chunk.text();

      if (text) {

        res.write(text);

      }

    }

    res.end();

  } catch (error) {

    console.error(
      "Streaming error:",
      error
    );

    if (!res.headersSent) {

      return res.status(500).json({
        error:
          "صار خطأ أثناء استقبال الرد."
      });

    }

    res.end();

  }

});


// ===============================
// توليد الصور
// Nano Banana 2 Lite
// ===============================

app.post(
  "/generate-image",
  async (req, res) => {

    if (!apiKey) {

      return res.status(500).json({
        error:
          "مفتاح Gemini غير موجود."
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

      const response =
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              "x-goog-api-key":
                apiKey
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


      // الحد اليومي
      if (
        response.status === 429
      ) {

        return res.status(429).json({
          error:
            "وصلت للحد الأقصى المجاني لتوليد الصور اليوم 😴💕"
        });

      }


      if (!response.ok) {

        let errorData = {};

        try {
          errorData =
            await response.json();
        } catch {}

        console.error(
          "Image API error:",
          errorData
        );

        return res.status(
          response.status
        ).json({

          error:
            "ما قدرناش نولد الصورة حالياً. عاود المحاولة بعد شوية."

        });

      }


      const data =
        await response.json();


      const parts =
        data?.candidates?.[0]?.content?.parts || [];


      const imagePart =
        parts.find(
          part =>
            part.inlineData ||
            part.inline_data
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


// ===============================
// تشغيل السيرفر
// ===============================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `notwin iA server running on port ${PORT}`
    );

  }
);
