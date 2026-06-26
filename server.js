import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_TEXT_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const OPENAI_TEXT_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4.1-mini";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static("public"));

function getErrorStatus(error) {
  return Number(error?.status || error?.code || 0);
}

function isQuotaError(error) {
  const message = String(error?.message || "");
  const status = getErrorStatus(error);
  return status === 429 || /quota|rate limit|insufficient/i.test(message);
}

function getFriendlyApiErrorMessage(error, fallbackMessage) {
  if (isQuotaError(error)) {
    return "OpenAI quota/rate limit reached. Try again in a few minutes or lower usage settings.";
  }

  return fallbackMessage;
}

async function createTextResponseWithFallback(input) {
  try {
    const primary = await client.responses.create({
      model: OPENAI_TEXT_MODEL,
      input
    });

    return {
      response: primary,
      usedModel: OPENAI_TEXT_MODEL,
      usedFallback: false
    };
  } catch (error) {
    const canFallback =
      isQuotaError(error) &&
      OPENAI_TEXT_FALLBACK_MODEL &&
      OPENAI_TEXT_FALLBACK_MODEL !== OPENAI_TEXT_MODEL;

    if (!canFallback) {
      throw error;
    }

    const fallback = await client.responses.create({
      model: OPENAI_TEXT_FALLBACK_MODEL,
      input
    });

    return {
      response: fallback,
      usedModel: OPENAI_TEXT_FALLBACK_MODEL,
      usedFallback: true
    };
  }
}

function normalizeSuggestedInputs(raw, context = {}) {
  const creationMode = context.creationMode || "Sellable Digital Product";
  const language = context.language || "English";

  const fallbackAudience = creationMode === "Personal Guide / Workbook"
    ? "Beginners and busy professionals who want practical step-by-step execution"
    : "Creators, coaches, freelancers, and beginners who want to sell digital products";

  const fallbackPromise = creationMode === "Personal Guide / Workbook"
    ? "Build a clear personal action plan and execute it in simple daily steps"
    : "Build and sell their first digital product with confidence";

  const styleOptions = new Set([
    "Luxury Black and Gold",
    "Clean Minimalist Premium",
    "Bold Creator Brand",
    "Modern Agency Style",
    "California Creator Brand",
    "Filipino Digital Seller Style"
  ]);

  const depthOptions = new Set([
    "Premium Paid Ebook",
    "Workbook Toolkit",
    "Lead Magnet",
    "Course Companion",
    "Authority Guide"
  ]);

  const densityOptions = new Set(["Minimal", "Balanced", "Rich"]);

  const safe = (value, fallback = "") => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
  };

  const style = safe(raw?.style, "Luxury Black and Gold");
  const depth = safe(raw?.depth, "Premium Paid Ebook");
  const visualDensity = safe(raw?.visualDensity, "Minimal");

  return {
    audience: safe(raw?.audience, fallbackAudience),
    promise: safe(raw?.promise, fallbackPromise),
    customProductBrief: safe(raw?.customProductBrief, ""),
    coverSubtitle: safe(
      raw?.coverSubtitle,
      creationMode === "Personal Guide / Workbook"
        ? "Your step-by-step action guide for fast progress"
        : "Create, Package, and Launch Your First Sellable Digital Product in 30 Days"
    ),
    style: styleOptions.has(style) ? style : "Luxury Black and Gold",
    price: safe(raw?.price, creationMode === "Personal Guide / Workbook" ? "$17" : "$27"),
    depth: depthOptions.has(depth) ? depth : "Premium Paid Ebook",
    visualDensity: densityOptions.has(visualDensity) ? visualDensity : "Minimal",
    language
  };
}

app.post("/api/suggest-inputs", async (req, res) => {
  try {
    const {
      topic,
      creationMode = "Sellable Digital Product",
      language = "English"
    } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic is required."
      });
    }

    const prompt = buildInputAutofillPrompt({
      topic,
      creationMode,
      language
    });

    const { response, usedModel, usedFallback } = await createTextResponseWithFallback(prompt);
    const json = extractJson(response.output_text);
    const normalized = normalizeSuggestedInputs(json, {
      creationMode,
      language
    });

    res.json({
      ...normalized,
      meta: {
        textModel: usedModel,
        usedFallbackModel: usedFallback
      }
    });
  } catch (error) {
    console.error("Suggest input generation error:", error);

    const status = isQuotaError(error) ? 429 : 500;

    res.status(status).json({
      error: getFriendlyApiErrorMessage(error, "Failed to generate suggested form inputs."),
      details: String(error?.message || "Unknown error")
    });
  }
});

app.post("/api/generate-ebook", async (req, res) => {
  try {
    const {
      topic,
      creationMode = "Sellable Digital Product",
      audience,
      promise,
      customProductBrief = "",
      coverSubtitle,
      language = "Taglish",
      style = "Luxury Black and Gold",
      price = "$27",
      depth = "Premium Paid Ebook",
      visualDensity = "Balanced"
    } = req.body;

    if (!topic || !audience || !promise) {
      return res.status(400).json({
        error: "Topic, audience, and promise are required."
      });
    }

    const prompt = buildEbookPrompt({
      topic,
      creationMode,
      audience,
      promise,
      customProductBrief,
      coverSubtitle,
      language,
      style,
      price,
      depth,
      visualDensity
    });

    const { response, usedModel, usedFallback } = await createTextResponseWithFallback(prompt);

    const text = response.output_text;
    const json = extractJson(text);

    res.json({
      ...json,
      meta: {
        textModel: usedModel,
        usedFallbackModel: usedFallback
      }
    });
  } catch (error) {
    console.error("Ebook generation error:", error);

    const status = isQuotaError(error) ? 429 : 500;

    res.status(status).json({
      error: getFriendlyApiErrorMessage(error, "Failed to generate ebook."),
      details: String(error?.message || "Unknown error")
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
      customCoverDirection = "",
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
      customCoverDirection,
      textAccuracyMode
    });

    const image = await client.images.generate({
      model: OPENAI_IMAGE_MODEL,
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

    const status = isQuotaError(error) ? 429 : 500;

    res.status(status).json({
      error: getFriendlyApiErrorMessage(error, "Failed to generate cover image."),
      details: String(error?.message || "Unknown error")
    });
  }
});

app.post("/api/generate-bundle-assets", async (req, res) => {
  try {
    const {
      topic,
      creationMode = "Sellable Digital Product",
      audience,
      promise,
      customProductBrief = "",
      coverSubtitle,
      language = "Taglish",
      style = "Luxury Black and Gold",
      price = "$27",
      depth = "Premium Paid Ebook",
      visualDensity = "Balanced",
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
      creationMode,
      audience,
      promise,
      customProductBrief,
      coverSubtitle,
      language,
      style,
      price,
      depth,
      visualDensity,
      title,
      subtitle
    });

    const { response, usedModel, usedFallback } = await createTextResponseWithFallback(prompt);

    const text = response.output_text;
    const json = extractJson(text);
    const normalized = normalizeBundleAssetsByCreationMode(json, creationMode);

    res.json({
      ...normalized,
      meta: {
        textModel: usedModel,
        usedFallbackModel: usedFallback
      }
    });
  } catch (error) {
    console.error("Bundle assets generation error:", error);

    const status = isQuotaError(error) ? 429 : 500;

    res.status(status).json({
      error: getFriendlyApiErrorMessage(error, "Failed to generate bundle assets."),
      details: String(error?.message || "Unknown error")
    });
  }
});

app.post("/api/generate-interior-images", async (req, res) => {
  try {
    const {
      title = "",
      subtitle = "",
      topic = "",
      style = "Luxury Black and Gold",
      visualDensity = "Balanced",
      chapters = [],
      frameworks = [],
      worksheets = []
    } = req.body;

    if (!title && !topic) {
      return res.status(400).json({
        error: "Title or topic is required."
      });
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({
        error: "Chapters array is required to generate interior images."
      });
    }

    const plan = buildInteriorImagePlan({
      title,
      subtitle,
      topic,
      style,
      visualDensity,
      chapters,
      frameworks,
      worksheets
    });

    const images = [];

    let quotaLimited = false;

    for (const item of plan) {
      let image;

      try {
        image = await client.images.generate({
          model: OPENAI_IMAGE_MODEL,
          prompt: item.prompt,
          size: "1024x1024"
        });
      } catch (error) {
        if (isQuotaError(error)) {
          quotaLimited = true;
          break;
        }
        throw error;
      }

      const base64Image = image.data?.[0]?.b64_json;

      if (!base64Image) {
        throw new Error("No interior image returned from OpenAI.");
      }

      images.push({
        label: item.label,
        chapterNumber: item.chapterNumber || null,
        imageUrl: `data:image/png;base64,${base64Image}`
      });
    }

    res.json({
      visualDensity,
      totalImages: images.length,
      images,
      quotaLimited
    });
  } catch (error) {
    console.error("Interior image generation error:", error);

    const message = String(error?.message || "");
    const status = getErrorStatus(error);
    const quotaError = isQuotaError(error);

    res.status(quotaError ? 429 : 500).json({
      error: quotaError
        ? "OpenAI quota/rate limit reached while generating interior images."
        : "Failed to generate interior images.",
      details: message
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
Creation Mode: ${input.creationMode || "Sellable Digital Product"}
Target Audience: ${input.audience}
Main Promise: ${input.promise}
Custom Product Brief:
${input.customProductBrief || "None provided"}
Preferred Cover Subtitle: ${input.coverSubtitle || ""}
Language: ${input.language}
Visual Style: ${input.style}
Price Positioning: ${input.price}
Ebook Type: ${input.depth}
Visual Density: ${input.visualDensity || "Balanced"}
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
Use the custom product brief as high-priority direction. Do not ignore it. Integrate relevant details into the ebook and bundle assets without making the output messy.
Use Creation Mode to shape the entire output.

If Creation Mode is Sellable Digital Product:
- Position the output as a paid digital product.
- Include buyer-focused transformation.
- Include offer angle, pricing logic, value stack, sales page copy, launch captions, product bonuses, and bundle assets when relevant.
- Make the ebook/package commercially useful and ready to sell.

If Creation Mode is Personal Guide / Workbook:
- Position the output as a personalized guide for the user's own goal.
- Do not make it overly sales-focused.
- Focus on practical steps, personal action plans, checklists, trackers, reflection questions, weekly plans, and habit/action systems.
- Avoid unnecessary sales page copy unless the user asks for it.
- Make the output feel useful for personal reading, self-guidance, and execution.
Use the selected Visual Density to control image prompts and visual directions.

If Minimal:
- Include only cover image prompt and limited visual directions.
- Do not overdo images.

If Balanced:
- Include one strong image prompt per chapter.
- Include key visuals for frameworks, checklists, or worksheets only when useful.

If Rich:
- Include one strong image prompt per chapter.
- Include extra visual prompts for frameworks, checklists, worksheets, action plans, and key sections.
- Make the ebook feel like a premium visual digital product bundle.

Important:
- Do not create an image for every small subtopic.
- Avoid clutter.
- Keep visuals purposeful and premium.
- Image prompts should be specific, buyer-attracting, and aligned with the selected style.
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

function buildInputAutofillPrompt(input) {
  return `
You are a premium digital product strategist.

Generate practical form values for an ebook generator based on topic.

INPUT:
Topic: ${input.topic}
Creation Mode: ${input.creationMode}
Language: ${input.language}

OUTPUT RULES:
- Return ONLY valid JSON.
- No markdown, no code fences.
- Use concise but specific copy.
- Keep values commercially usable.

Return this exact JSON shape:
{
  "audience": "...",
  "promise": "...",
  "customProductBrief": "...",
  "coverSubtitle": "...",
  "style": "Luxury Black and Gold OR Clean Minimalist Premium OR Bold Creator Brand OR Modern Agency Style OR California Creator Brand OR Filipino Digital Seller Style",
  "price": "$17 or $27 or $47",
  "depth": "Premium Paid Ebook OR Workbook Toolkit OR Lead Magnet OR Course Companion OR Authority Guide",
  "visualDensity": "Minimal OR Balanced OR Rich"
}
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
Creation Mode: ${input.creationMode || "Sellable Digital Product"}
Audience: ${input.audience}
Main Promise: ${input.promise}
Custom Product Brief:
${input.customProductBrief || "None provided"}
Preferred Cover Subtitle: ${input.coverSubtitle || ""}
Language: ${input.language}
Style: ${input.style}
Price Positioning: ${input.price}
Ebook Type: ${input.depth}
Visual Density: ${input.visualDensity || "Balanced"}
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
Use the custom product brief as high-priority direction. Do not ignore it. Integrate relevant details into the ebook and bundle assets without making the output messy.
Use Creation Mode to shape the entire output.

If Creation Mode is Sellable Digital Product:
- Position assets for selling and launching.
- Focus on commercial value and buyer-ready packaging.

If Creation Mode is Personal Guide / Workbook:
- Position assets for personal use and execution.
- Avoid unnecessary sales-focused material.

If Creation Mode is Sellable Digital Product, return this exact JSON structure:

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

If Creation Mode is Personal Guide / Workbook, return this exact JSON structure:

{
  "mainGuide": {
    "title": "",
    "purpose": "",
    "copyReadyIntro": "",
    "keySections": [],
    "designNotes": ""
  },
  "actionWorkbook": {
    "title": "",
    "purpose": "",
    "pages": [],
    "prompts": [],
    "fields": [],
    "designNotes": ""
  },
  "checklist": {
    "title": "",
    "purpose": "",
    "items": [],
    "usageTips": [],
    "designNotes": ""
  },
  "weeklyPlan": {
    "title": "",
    "purpose": "",
    "weekByWeekPlan": [],
    "milestones": [],
    "designNotes": ""
  },
  "tracker": {
    "title": "",
    "purpose": "",
    "trackingAreas": [],
    "reviewRhythm": "",
    "designNotes": ""
  },
  "reflectionQuestions": {
    "title": "",
    "purpose": "",
    "questionSets": [],
    "journalPrompts": [],
    "designNotes": ""
  },
  "resourceList": {
    "title": "",
    "purpose": "",
    "categories": [],
    "recommendedResources": [],
    "designNotes": ""
  },
  "aiPromptPack": {
    "title": "",
    "purpose": "",
    "promptCategories": [],
    "doneForYouPrompts": [],
    "customizationTips": [],
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

function normalizeBundleAssetsByCreationMode(bundle, creationMode) {
  const mode = creationMode || "Sellable Digital Product";
  const source = bundle && typeof bundle === "object" ? bundle : {};

  if (mode !== "Personal Guide / Workbook") {
    return source;
  }

  const alreadyPersonal = source.mainGuide || source.actionWorkbook || source.aiPromptPack;
  if (alreadyPersonal) {
    return source;
  }

  return {
    mainGuide: source.mainEbook || {},
    actionWorkbook: source.workbook || {},
    checklist: source.thirtyDayActionPlan || {},
    weeklyPlan: source.thirtyDayActionPlan || {},
    tracker: source.digitalProductIdeaBank || {},
    reflectionQuestions: source.launchCaptionTemplates || {},
    resourceList: source.salesPageCopyTemplate || {},
    aiPromptPack: source.aiCoverPromptPack || source.promptPack || {}
  };
}

function buildCoverPrompt(input) {
  const {
    title = "",
    subtitle = "",
    coverPrompt = "",
    style = "Luxury Black and Gold",
    coverCalibration = "Glossy Bundle Mockup",
    customCoverDirection = "",
    textAccuracyMode = true
  } = input || {};

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
- If Custom Cover Direction is provided, treat it as the primary visual direction.
- Keep the base style and quality rules, but prioritize Custom Cover Direction for composition, mood, and art direction.
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

CUSTOM COVER DIRECTION (HIGHEST PRIORITY IF PROVIDED):
${customCoverDirection || "None provided. Follow the cover prompt and preset instructions."}

${textAccuracyInstructions}
`;
}

function buildInteriorImagePlan(input) {
  const {
    title = "",
    subtitle = "",
    topic = "",
    style = "Luxury Black and Gold",
    visualDensity = "Balanced",
    chapters = [],
    frameworks = [],
    worksheets = []
  } = input || {};

  const density = ["Minimal", "Balanced", "Rich"].includes(visualDensity) ? visualDensity : "Balanced";
  const cleanTitle = title || topic || "Premium Ebook";
  const cleanSubtitle = subtitle || "";

  const buildPrompt = ({ scene, chapterTitle = "", extra = "" }) => `
Create a premium interior ebook image for a digital product guide.

BOOK TITLE: ${cleanTitle}
BOOK SUBTITLE: ${cleanSubtitle}
TOPIC: ${topic || cleanTitle}
STYLE: ${style}
VISUAL DENSITY: ${density}
CHAPTER CONTEXT: ${chapterTitle || "General"}
SCENE DIRECTION: ${scene}

RULES:
- High-end, buyer-attracting visual style
- No text overlays, no typography blocks, no watermarks
- Clean composition, not cluttered
- Portrait-friendly interior illustration style
- Purposeful visual storytelling aligned with chapter intent
${extra ? `- ${extra}` : ""}
`;

  const plan = [];

  if (density === "Minimal") {
    const chapter = chapters[0] || {};
    const heroIdea = chapter.visualDirections?.heroImageIdea || chapter.chapterPromise || chapter.chapterTitle || topic;
    plan.push({
      label: "Interior Hero Image",
      chapterNumber: null,
      prompt: buildPrompt({
        chapterTitle: chapter.chapterTitle || "",
        scene: heroIdea,
        extra: "Generate one versatile hero visual for the ebook interior."
      })
    });
    return plan;
  }

  chapters.forEach((chapter, index) => {
    const chapterNumber = Number(chapter.chapterNumber) || (index + 1);
    const heroIdea = chapter.visualDirections?.heroImageIdea
      || (Array.isArray(chapter.visualDirections?.aiImagePrompts) && chapter.visualDirections.aiImagePrompts[0])
      || chapter.chapterPromise
      || chapter.chapterTitle
      || `Chapter ${chapterNumber}`;

    plan.push({
      label: `Chapter ${chapterNumber}: ${chapter.chapterTitle || "Interior Visual"}`,
      chapterNumber,
      prompt: buildPrompt({
        chapterTitle: chapter.chapterTitle || "",
        scene: heroIdea,
        extra: "This should be the primary chapter visual."
      })
    });
  });

  if (density === "Rich") {
    const extras = [];

    (frameworks || []).forEach((framework, index) => {
      const source = framework.aiGraphicPrompt || framework.designDirection || framework.visualLayout || framework.purpose || framework.name;
      if (!source) return;
      extras.push({
        label: `Framework Visual ${index + 1}: ${framework.name || "Framework"}`,
        prompt: buildPrompt({
          chapterTitle: framework.name || "Framework",
          scene: source,
          extra: "Create a supporting framework visual with clean structure and premium style."
        })
      });
    });

    (worksheets || []).forEach((worksheet, index) => {
      const source = worksheet.designNotes || worksheet.purpose || worksheet.title;
      if (!source) return;
      extras.push({
        label: `Worksheet Visual ${index + 1}: ${worksheet.title || "Worksheet"}`,
        prompt: buildPrompt({
          chapterTitle: worksheet.title || "Worksheet",
          scene: source,
          extra: "Create a supporting worksheet-inspired visual, not a literal form screenshot."
        })
      });
    });

    for (const extra of extras) {
      if (plan.length >= 10) break;
      plan.push({
        label: extra.label,
        chapterNumber: null,
        prompt: extra.prompt
      });
    }
  }

  return plan.slice(0, 10);
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
  console.log(`Ebook Studio running at http://localhost:${PORT}`);
});