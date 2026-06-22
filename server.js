import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static("public"));

app.post("/api/generate-ebook", async (req, res) => {
  try {
    const {
      topic,
      audience,
      promise,
      coverSubtitle,
      language = "Taglish",
      style = "Luxury Black and Gold",
      price = "$27",
      depth = "Premium Paid Ebook"
    } = req.body;

    if (!topic || !audience || !promise) {
      return res.status(400).json({
        error: "Topic, audience, and promise are required."
      });
    }

    const prompt = buildEbookPrompt({
      topic,
      audience,
      promise,
      coverSubtitle,
      language,
      style,
      price,
      depth
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: prompt
    });

    const text = response.output_text;
    const json = extractJson(text);

    res.json(json);
  } catch (error) {
    console.error("Ebook generation error:", error);

    res.status(500).json({
      error: "Failed to generate ebook.",
      details: error.message
    });
  }
});

app.post("/api/generate-cover", async (req, res) => {
  try {
    const {
      title,
      subtitle,
      coverPrompt,
      style = "Luxury Black and Gold"
    } = req.body;

    if (!coverPrompt) {
      return res.status(400).json({
        error: "Cover prompt is required."
      });
    }

    const finalPrompt = `
Create a premium ebook cover image.

EBOOK TITLE:
${title || ""}

SUBTITLE:
${subtitle || ""}

STYLE:
${style}

COVER DIRECTION:
${coverPrompt}

IMPORTANT DESIGN RULES:
- Portrait ebook cover composition
- Premium digital product look
- Clean, high-end, modern layout
- The cover must clearly include both the title and subtitle
- Title must be large and dominant
- Subtitle must appear below the title in smaller readable typography
- Use this exact subtitle text if provided: ${subtitle || ""}
- Strong buyer-attracting visual
- No mockup
- No laptop
- No hands holding the book
- Leave clean space for title and subtitle
- Avoid clutter
- Make it look sellable on Gumroad, Shopify, Stan Store, Etsy, or a landing page
- High perceived value
- Professional typography feel
- Strong visual hierarchy
- Modern US market digital product aesthetic
`;

    const image = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: finalPrompt,
      size: "1024x1536"
    });

    const base64Image = image.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new Error("No image returned from OpenAI.");
    }

    res.json({
      imageUrl: `data:image/png;base64,${base64Image}`
    });
  } catch (error) {
    console.error("Cover generation error:", error);

    res.status(500).json({
      error: "Failed to generate cover image.",
      details: error.message
    });
  }
});

function buildEbookPrompt(input) {
  return `
You are an elite premium ebook strategist, digital product creator, conversion copywriter, curriculum designer, brand designer, visual director, Canva/Figma layout planner, and AI image prompt engineer.

Create a complete premium ebook product package.

This should not feel like a basic PDF.
It should feel like a high-value digital product people would want to buy, save, use, and recommend.

INPUT DETAILS:
Topic: ${input.topic}
Target Audience: ${input.audience}
Main Promise: ${input.promise}
Preferred Cover Subtitle: ${input.coverSubtitle || ""}
Language: ${input.language}
Visual Style: ${input.style}
Price Positioning: ${input.price}
Ebook Type: ${input.depth}
Market Positioning: US / California-based digital product market

CRITICAL OUTPUT RULES:
Return ONLY valid JSON.
No markdown.
No code fences.
No explanation outside JSON.
Write in ${input.language}.
Make the output specific, premium, practical, and buyer-attracting.
Avoid generic advice.
Use USD pricing logic.
Make the ebook feel sellable as a digital product.
If Preferred Cover Subtitle is provided, use it as the selectedSubtitle or strongly align with it.

Return this exact JSON structure:

{
  "strategy": {
    "bestAngle": "",
    "targetBuyer": "",
    "primaryPromise": "",
    "positioningStatement": "",
    "whyItWillSell": "",
    "recommendedPrice": "",
    "premiumValueStack": []
  },
  "titles": {
    "selectedTitle": "",
    "selectedSubtitle": "",
    "alternativeTitles": [],
    "alternativeSubtitles": []
  },
  "coverConcept": {
    "visualTheme": "",
    "titlePlacement": "",
    "subtitlePlacement": "",
    "backgroundStyle": "",
    "colorPalette": [
      { "name": "", "hex": "" },
      { "name": "", "hex": "" },
      { "name": "", "hex": "" }
    ],
    "fontDirection": "",
    "imageIdea": "",
    "mood": "",
    "buyerAttractionReason": "",
    "aiCoverPrompt": ""
  },
  "visualIdentity": {
    "brandFeel": "",
    "fontPairing": "",
    "iconStyle": "",
    "illustrationStyle": "",
    "photoStyle": "",
    "pageLayoutStyle": "",
    "sectionDividerStyle": "",
    "calloutBoxStyle": "",
    "quoteBoxStyle": "",
    "worksheetStyle": "",
    "premiumDesignRules": []
  },
  "tableOfContents": [
    {
      "chapterNumber": 1,
      "chapterTitle": "",
      "chapterPromise": "",
      "readerOutcome": ""
    }
  ],
  "chapters": [
    {
      "chapterNumber": 1,
      "chapterTitle": "",
      "chapterPurpose": "",
      "opening": "",
      "coreLesson": "",
      "practicalExamples": [],
      "stepByStepProcess": [],
      "commonMistakes": [],
      "actionChecklist": [],
      "miniWorksheet": {
        "title": "",
        "instructions": "",
        "fields": []
      },
      "keyTakeaway": "",
      "visualDirections": {
        "heroImageIdea": "",
        "supportingGraphics": [],
        "infographicIdea": "",
        "diagramIdea": "",
        "aiImagePrompts": []
      }
    }
  ],
  "frameworks": [
    {
      "name": "",
      "purpose": "",
      "visualLayout": "",
      "explanation": "",
      "howToUse": "",
      "designDirection": "",
      "aiGraphicPrompt": ""
    }
  ],
  "worksheets": [
    {
      "title": "",
      "type": "",
      "purpose": "",
      "instructions": "",
      "fields": [],
      "designNotes": ""
    }
  ],
  "salesAssets": {
    "productDescription": "",
    "shortSalesCaption": "",
    "longSalesCaption": "",
    "landingPageHeadline": "",
    "landingPageSubheadline": "",
    "bulletBenefits": [],
    "bonusIdeas": [],
    "launchPost": "",
    "dmSalesScript": ""
  },
  "finalPages": {
    "welcomeLetter": "",
    "howToUseThisEbook": "",
    "quickWinSection": "",
    "finalActionPlan": [],
    "closingMessage": "",
    "finalCTA": "",
    "backCoverCopy": ""
  }
}

CONTENT REQUIREMENTS:
- Create 6 strong chapters.
- Create at least 5 premium frameworks.
- Create at least 6 worksheets/templates.
- Include cover image prompt.
- Include chapter image prompts.
- Include sales assets.
- Make the ebook feel like a complete paid digital product package.
`;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("The AI did not return valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Premium Ebook Generator running at http://localhost:${PORT}`);
});