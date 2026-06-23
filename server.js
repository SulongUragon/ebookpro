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
      style = "Luxury Black and Gold",
      coverCalibration = "Glossy Bundle Mockup",
      textAccuracyMode = true
    } = req.body;

    if (!coverPrompt) {
      return res.status(400).json({
        error: "Cover prompt is required."
      });
    }

    const finalPrompt = buildCoverPrompt({
      title,
      subtitle,
      coverPrompt,
      style,
      coverCalibration,
      textAccuracyMode
    });

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

app.post("/api/generate-bundle-assets", async (req, res) => {
  try {
    const {
      topic,
      audience,
      promise,
      coverSubtitle,
      language = "Taglish",
      style = "Luxury Black and Gold",
      price = "$27",
      depth = "Premium Paid Ebook",
      title = "",
      subtitle = ""
    } = req.body;

    if (!topic || !audience || !promise) {
      return res.status(400).json({
        error: "Topic, audience, and promise are required."
      });
    }

    const prompt = buildBundleAssetsPrompt({
      topic,
      audience,
      promise,
      coverSubtitle,
      language,
      style,
      price,
      depth,
      title,
      subtitle
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: prompt
    });

    const text = response.output_text;
    const json = extractJson(text);

    res.json(json);
  } catch (error) {
    console.error("Bundle assets generation error:", error);

    res.status(500).json({
      error: "Failed to generate bundle assets.",
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

function buildBundleAssetsPrompt(input) {
  return `
You are a premium digital product strategist, ebook packager, workbook designer, launch copywriter, and AI prompt engineer.

Create 8 separate bundle assets for the current ebook/product idea.

These are companion assets, not a full ebook rewrite.
Keep each asset focused, practical, premium, and ready to copy into Canva, Google Docs, or PDF.

INPUT DETAILS:
Topic: ${input.topic}
Audience: ${input.audience}
Main Promise: ${input.promise}
Preferred Cover Subtitle: ${input.coverSubtitle || ""}
Language: ${input.language}
Style: ${input.style}
Price Positioning: ${input.price}
Ebook Type: ${input.depth}
Current Title: ${input.title || ""}
Current Subtitle: ${input.subtitle || ""}

CRITICAL OUTPUT RULES:
Return ONLY valid JSON.
No markdown.
No code fences.
No explanation outside JSON.
Write in ${input.language}.
Use USD-friendly, premium digital product language.
Do not regenerate the full ebook or cover image.

Return this exact JSON structure:

{
  "mainEbook": {
    "title": "",
    "subtitle": "",
    "purpose": "",
    "copyReadyIntro": "",
    "keySections": [],
    "designNotes": ""
  },
  "workbook": {
    "title": "",
    "purpose": "",
    "pages": [],
    "prompts": [],
    "fields": [],
    "designNotes": ""
  },
  "promptPack": {
    "title": "",
    "purpose": "",
    "promptCategories": [],
    "doneForYouPrompts": [],
    "customizationTips": [],
    "designNotes": ""
  },
  "thirtyDayActionPlan": {
    "title": "",
    "purpose": "",
    "weekByWeekPlan": [],
    "dailyActions": [],
    "milestones": [],
    "designNotes": ""
  },
  "digitalProductIdeaBank": {
    "title": "",
    "purpose": "",
    "ideaCategories": [],
    "readyToSellIdeas": [],
    "validationCriteria": [],
    "designNotes": ""
  },
  "launchCaptionTemplates": {
    "title": "",
    "purpose": "",
    "captionTypes": [],
    "templateCaptions": [],
    "ctaVariations": [],
    "designNotes": ""
  },
  "salesPageCopyTemplate": {
    "title": "",
    "purpose": "",
    "sections": [],
    "headlineOptions": [],
    "bulletBenefitAngles": [],
    "ctaOptions": [],
    "designNotes": ""
  },
  "aiCoverPromptPack": {
    "title": "",
    "purpose": "",
    "coverPromptVariations": [],
    "subtitleDirections": [],
    "styleVariations": [],
    "designNotes": ""
  }
}

CONTENT REQUIREMENTS:
- Generate 8 complete bundle assets.
- Make each asset distinct and useful.
- Keep the workbook, prompt pack, action plan, idea bank, caption templates, sales page template, and AI cover prompt pack highly practical.
- Include the preferred cover subtitle where appropriate.
- The output should be immediately usable as a separate asset bundle.
`;
}

function buildCoverPrompt(input) {
  const { title = "", subtitle = "", coverPrompt = "", style = "Luxury Black and Gold", coverCalibration = "Glossy Bundle Mockup", textAccuracyMode = true } = input || {};

  const calibrationInstructions = {
  "Glossy Bundle Mockup": `
Make it look like a premium paid starter kit bundle. Use glossy highlights, warm gold/cream lighting, deep navy text, laptop, floating bundle cards, and visible high-value assets. Use only short card labels: AI PROMPTS, WORKBOOK, 30-DAY PLAN, SALES PAGE, LAUNCH CHECKLIST, DIGITAL PRODUCT. No long sentences on cards.
`,
  "California Vibrant": `
Use stronger visual identity colors: electric blue, coral orange, cream/sand, deep navy. Make the cover sharper, more vibrant, and less washed out.
`,
  "Luxury Gold": `
Use warm gold, champagne, deep navy, premium shadows, polished glossy finish, subtle reflections, high perceived value.
`,
  "Clean Minimal": `
Use whitespace, clean layout, soft shadows, simple laptop/product visuals, premium but calm.
`,
  "Text-Safe Cover": `
Prioritize readable exact title and subtitle. Keep all text inside safe margins. No extra text. No random labels. Strong title hierarchy.
`,
  "Background Only": `
Do not include title, subtitle, or any readable text in the image. Generate only the premium cover background/design with laptop, product cards, glossy bundle visuals, and safe empty space where the app can later overlay exact text.
`
  };

  const textAccuracyInstructions = textAccuracyMode
  ? `
- Use the exact title and subtitle.
- Title must say exactly: ${title}
- Subtitle must say exactly: ${subtitle}
- No typo.
- No extra random text.
- Keep all text inside safe margins.
- Use smaller subtitle text if needed.
- Do not allow letters to overflow.
- Do not put long sentences on small cards.
`
  : "";

  return `
Create a premium ebook cover image.

EBOOK TITLE:
${title || ""}

SUBTITLE:
${subtitle || ""}

STYLE:
${style}

COVER PROMPT:
${coverPrompt || ""}

COVER CALIBRATION PRESET:
${coverCalibration}

PRESET INSTRUCTIONS:
${calibrationInstructions[coverCalibration] || calibrationInstructions["Glossy Bundle Mockup"]}

IMPORTANT DESIGN RULES:
- Portrait ebook cover composition
- Premium digital product look
- Clean, high-end, modern layout
- The cover must clearly include both the title and subtitle unless Background Only is selected
- Title must be large and dominant unless Background Only is selected
- Subtitle must appear below the title in smaller readable typography unless Background Only is selected
- Use this exact subtitle text if provided: ${subtitle || ""}
- Strong buyer-attracting visual
- Leave clean space for title and subtitle unless Background Only is selected
- Avoid clutter
- Make it look sellable on Gumroad, Shopify, Stan Store, Etsy, or a landing page
- High perceived value
- Professional typography feel
- Strong visual hierarchy
- Modern US market digital product aesthetic
${textAccuracyInstructions}
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