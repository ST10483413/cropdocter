/* ─────────────────────────────────────────────────
   CropDoctor — Core Application Logic  (app.js)
   ─────────────────────────────────────────────────
   Features:
     1. API response parsing (disease name, probability, description)
     2. Demo-mode fallback when API is unavailable
     3. Static treatment knowledge-base lookup
   ───────────────────────────────────────────────── */

// ══════════════════════════════════════════════════
// 1.  TREATMENT KNOWLEDGE BASE
// ══════════════════════════════════════════════════
const treatmentMap = {
  "early blight":
    "Remove infected leaves immediately and dispose of them away from the garden. " +
    "Apply a copper-based fungicide every 7–10 days. " +
    "Improve air circulation by spacing plants properly and pruning lower foliage. " +
    "Rotate crops annually to reduce soil-borne spores.",

  "late blight":
    "Apply a systemic fungicide (e.g. chlorothalonil or mancozeb) as soon as symptoms appear. " +
    "Avoid overhead watering — use drip irrigation instead. " +
    "Remove and destroy heavily infected plants to prevent spread. " +
    "Do not compost infected material.",

  "leaf mold":
    "Increase greenhouse ventilation to lower humidity below 85 %. " +
    "Remove affected leaves and destroy them. " +
    "Apply a fungicide labelled for leaf mold. " +
    "Water at the base of plants to keep foliage dry.",

  "septoria leaf spot":
    "Remove infected lower leaves at the first sign of spots. " +
    "Apply copper fungicide or chlorothalonil on a 7-day schedule. " +
    "Mulch around the base of plants to prevent soil splash. " +
    "Avoid working with wet plants to limit spore spread.",

  "bacterial spot":
    "Apply copper-based bactericide early in the season. " +
    "Remove and destroy severely infected plants. " +
    "Avoid overhead irrigation and working with wet foliage. " +
    "Use certified disease-free seeds and resistant varieties.",

  "target spot":
    "Apply fungicides containing chlorothalonil or mancozeb. " +
    "Improve air circulation through proper spacing and pruning. " +
    "Remove plant debris after harvest to reduce overwintering spores.",

  "yellow leaf curl virus":
    "Control whitefly populations with insecticidal soap or neem oil. " +
    "Use reflective mulch to deter whiteflies. " +
    "Remove and destroy infected plants promptly. " +
    "Plant resistant varieties when available.",

  "mosaic virus":
    "Remove infected plants immediately to prevent spread. " +
    "Control aphid populations, as they are the primary vector. " +
    "Disinfect tools between plants with a 10 % bleach solution. " +
    "Use virus-free certified seeds.",

  "powdery mildew":
    "Apply neem oil or sulfur-based fungicide at first sign of white patches. " +
    "Improve air flow around plants and avoid excess nitrogen fertiliser. " +
    "Water at ground level early in the day.",

  "healthy":
    "Your plant looks healthy! 🎉 Continue regular monitoring, keep watering and " +
    "fertilising on schedule, and scout for pests weekly to catch problems early."
};

// ══════════════════════════════════════════════════
// 2.  DEMO MODE — hardcoded fallback diseases
// ══════════════════════════════════════════════════
const demoDiseases = [
  {
    name: "early blight",
    probability: 0.87,
    description:
      "Fungal disease causing dark, concentric-ring lesions on lower leaves. " +
      "Common in warm, humid conditions — often appears mid-season."
  },
  {
    name: "late blight",
    probability: 0.92,
    description:
      "Aggressive water-mould infection producing large, dark, water-soaked patches. " +
      "Spreads rapidly in cool, wet weather and can destroy crops within days."
  },
  {
    name: "healthy",
    probability: 0.95,
    description:
      "No visible disease symptoms detected. The leaf tissue, colour, and " +
      "structure all appear normal."
  }
];

/** Pick a random demo disease */
function getRandomDemoResult() {
  const pick = demoDiseases[Math.floor(Math.random() * demoDiseases.length)];
  return { ...pick };                // shallow clone so the source array stays clean
}

// ══════════════════════════════════════════════════
// 3.  API RESPONSE PARSER
// ══════════════════════════════════════════════════

/**
 * Parse the JSON response coming from a plant-disease detection API.
 *
 * Supported response shapes (auto-detected):
 *   A) { disease: { name, probability, description } }
 *   B) { predictions: [{ class, confidence, description }] }  (sorted desc)
 *   C) { result: { crop, disease, confidence, description } }
 *   D) Plain { name, probability/confidence, description }
 *
 * Returns a normalised object:
 *   { name: string, probability: number (0-1), description: string }
 */
function parseApiResponse(json) {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid API response: expected a JSON object.");
  }

  let name, probability, description;

  // Shape A — nested "disease" key
  if (json.disease && typeof json.disease === "object") {
    const d = json.disease;
    name        = d.name  || d.class || "unknown";
    probability = d.probability ?? d.confidence ?? 0;
    description = d.description || "";

  // Shape B — "predictions" array (take the top prediction)
  } else if (Array.isArray(json.predictions) && json.predictions.length) {
    const top   = json.predictions[0];
    name        = top.class || top.name || "unknown";
    probability = top.confidence ?? top.probability ?? 0;
    description = top.description || "";

  // Shape C — nested "result" key
  } else if (json.result && typeof json.result === "object") {
    const r     = json.result;
    name        = r.disease || r.name || r.class || "unknown";
    probability = r.confidence ?? r.probability ?? 0;
    description = r.description || "";

  // Shape D — flat object
  } else {
    name        = json.name  || json.disease || json.class || "unknown";
    probability = json.probability ?? json.confidence ?? 0;
    description = json.description || "";
  }

  // Normalise probability: if it looks like a percentage (> 1), divide by 100
  if (typeof probability === "number" && probability > 1) {
    probability = probability / 100;
  }

  return {
    name:        String(name).toLowerCase().trim(),
    probability: Math.min(Math.max(Number(probability) || 0, 0), 1),
    description: String(description).trim()
  };
}

// ══════════════════════════════════════════════════
// 4.  TREATMENT LOOKUP
// ══════════════════════════════════════════════════

/**
 * Return treatment advice for a disease name.
 * Falls back to generic advice if the name isn't in the map.
 */
function getTreatment(diseaseName) {
  const key = String(diseaseName).toLowerCase().trim();

  if (treatmentMap[key]) return treatmentMap[key];

  // Try a partial/fuzzy match (e.g. "Tomato Early Blight" → "early blight")
  for (const [mapKey, advice] of Object.entries(treatmentMap)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return advice;
    }
  }

  return (
    "We don't have specific treatment advice for \"" + diseaseName + "\" yet. " +
    "Please consult a local agricultural extension officer for guidance."
  );
}

// ══════════════════════════════════════════════════
// 5.  API CONFIGURATION & CALLS
// ══════════════════════════════════════════════════

/** Configure your API credentials here */
const API_CONFIG = {
  // Choose your active engine: "gemini", "plantid", or "demo"
  engine: "gemini",

  // 1. Gemini API (Recommended: Multimodal AI image detection)
  // Get your free API key at: https://aistudio.google.com/
  geminiKey: "",

  // 2. Plant.id API (Alternative: AI plant health endpoint)
  // Get your key at: https://plant.id/
  plantIdKey: "",

  // 3. Perenual API (Reference Encyclopedia)
  // Get your key at: https://perenual.com/
  perenualKey: "sk-MsZM6a465c14db84418557"
};

/** Helper to convert File object to raw base64 string for API calls */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Split off the data URI prefix (e.g. data:image/jpeg;base64,)
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Fetch pest/disease details from Perenual by disease name.
 * Returns additional info (description, solution, host plants, images) if found.
 *
 * @param {string} diseaseName — e.g. "early blight"
 * @returns {object|null}  enriched data or null if not found
 */
async function fetchPerenualDiseaseInfo(diseaseName) {
  if (!API_CONFIG.perenualKey) return null;

  try {
    const query = encodeURIComponent(diseaseName);
    const url   = `https://perenual.com/api/pest-disease-list?key=${API_CONFIG.perenualKey}&q=${query}`;
    const res   = await fetch(url);

    if (!res.ok) {
      console.warn("Perenual API responded with status", res.status);
      return null;
    }

    const json = await res.json();

    // The API returns { data: [ … ] } — take the best match
    if (json.data && json.data.length > 0) {
      const match = json.data[0];
      return {
        scientificName: match.scientific_name || "",
        description:    (match.description && match.description.length)
                          ? match.description.map(d => typeof d === "object" ? d.description || d.subtitle || "" : d).join(" ")
                          : "",
        solution:       (match.solution && match.solution.length)
                          ? match.solution.map(s => typeof s === "object" ? s.description || s.subtitle || "" : s).join(" ")
                          : "",
        host:           Array.isArray(match.host) ? match.host : [],
        images:         (match.images && match.images.length) ? match.images : [],
        family:         match.family || ""
      };
    }

    return null;
  } catch (err) {
    console.warn("Perenual lookup failed:", err);
    return null;
  }
}

/**
 * Diagnose the plant using Google Gemini 1.5 Flash API.
 *
 * @param {File} imageFile — the file chosen by the user
 * @returns {object} parsed results matching internal format
 */
async function diagnoseWithGemini(imageFile) {
  const base64Image = await fileToBase64(imageFile);
  const mimeType = imageFile.type || "image/jpeg";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_CONFIG.geminiKey}`;

  const prompt = `Analyze this crop leaf image. Identify if the plant has a disease or pest infestation.
If healthy, return healthy status.
Return the result strictly as a JSON object matching this schema (do not wrap in markdown tags like \`\`\`json):
{
  "is_healthy": boolean,
  "disease_name": "string (name of disease, or 'healthy')",
  "probability": 0.95, // estimation of probability (number between 0.0 and 1.0)
  "description": "string (short description of symptoms and disease)",
  "treatment": {
    "biological": ["biological treatment step 1", "step 2..."],
    "chemical": ["chemical treatment step 1", "step 2..."],
    "prevention": ["preventative measure step 1", "step 2..."]
  }
}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API responded with status ${response.status}`);
  }

  const json = await response.json();
  const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("Empty response from Gemini API");
  }

  const parsedJson = JSON.parse(textResponse.trim());
  const isHealthy = !!parsedJson.is_healthy;

  let treatmentText = "";
  if (parsedJson.treatment) {
    const t = parsedJson.treatment;
    const parts = [];
    if (Array.isArray(t.biological) && t.biological.length) {
      parts.push("🌿 Biological Treatment:\n" + t.biological.map(l => `• ${l}`).join("\n"));
    }
    if (Array.isArray(t.chemical) && t.chemical.length) {
      parts.push("🧪 Chemical Treatment:\n" + t.chemical.map(l => `• ${l}`).join("\n"));
    }
    if (Array.isArray(t.prevention) && t.prevention.length) {
      parts.push("🛡️ Prevention & Control:\n" + t.prevention.map(l => `• ${l}`).join("\n"));
    }
    treatmentText = parts.join("\n\n");
  }

  return {
    name: parsedJson.disease_name || (isHealthy ? "healthy" : "unknown disease"),
    probability: parsedJson.probability ?? 0.8,
    description: parsedJson.description || "No description provided.",
    treatment: treatmentText || (isHealthy ? "Your plant looks healthy! 🎉" : "Please consult a local agricultural extension officer.")
  };
}

/**
 * Diagnose the plant using Plant.id Health Assessment API.
 *
 * @param {File} imageFile — the file chosen by the user
 * @returns {object} parsed results matching internal format
 */
async function diagnoseWithPlantId(imageFile) {
  const base64Image = await fileToBase64(imageFile);
  const url = "https://api.plant.id/v3/health_assessment";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Api-Key": API_CONFIG.plantIdKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      images: [base64Image],
      language: "en",
      details: ["description", "treatment", "cause", "common_names", "url"]
    })
  });

  if (!response.ok) {
    throw new Error(`Plant.id API responded with status ${response.status}`);
  }

  const json = await response.json();
  const result = json.result;

  if (!result) {
    throw new Error("No result block found in Plant.id response");
  }

  const isHealthy = result.is_healthy ? !!result.is_healthy.binary : true;

  if (isHealthy) {
    return {
      name: "healthy",
      probability: result.is_healthy ? (result.is_healthy.probability ?? 1.0) : 1.0,
      description: "Your plant appears to be healthy!",
      treatment: "Your plant looks healthy! 🎉 Continue regular monitoring, keep watering and fertilising on schedule, and scout for pests weekly to catch problems early."
    };
  } else {
    const suggestions = result.disease ? result.disease.suggestions : [];
    if (!suggestions || suggestions.length === 0) {
      throw new Error("No suggestions found in unhealthy diagnosis");
    }

    const top = suggestions[0];
    let treatmentText = "";
    if (top.details && top.details.treatment) {
      const t = top.details.treatment;
      if (typeof t === "string") {
        treatmentText = t;
      } else if (typeof t === "object") {
        const parts = [];
        if (Array.isArray(t.biological) && t.biological.length) {
          parts.push("🌿 Biological Treatment:\n" + t.biological.map(l => `• ${l}`).join("\n"));
        }
        if (Array.isArray(t.chemical) && t.chemical.length) {
          parts.push("🧪 Chemical Treatment:\n" + t.chemical.map(l => `• ${l}`).join("\n"));
        }
        if (Array.isArray(t.prevention) && t.prevention.length) {
          parts.push("🛡️ Prevention & Control:\n" + t.prevention.map(l => `• ${l}`).join("\n"));
        }
        treatmentText = parts.join("\n\n");
      }
    }

    return {
      name: top.name || "unknown disease",
      probability: top.probability ?? 0.0,
      description: top.details?.description || "No description available.",
      treatment: treatmentText || "Please consult a local agricultural extension officer for guidance."
    };
  }
}

/**
 * Main diagnose function routing.
 *
 * Routes requests to Gemini API, Plant.id API, or falls back to Demo Mode
 * depending on configuration and credential availability.
 *
 * @param {File} imageFile  — the file chosen by the user
 * @returns {{ data: object, isDemo: boolean, perenualInfo: object|null }}
 */
async function diagnose(imageFile) {
  let isDemo = false;
  let parsedResult = null;

  // 1. Run Gemini API
  if (API_CONFIG.engine === "gemini") {
    if (API_CONFIG.geminiKey) {
      try {
        parsedResult = await diagnoseWithGemini(imageFile);
      } catch (err) {
        console.error("Gemini API error, falling back to Demo Mode:", err);
      }
    } else {
      console.warn("⚠️ Gemini API key not configured — falling back to Demo Mode.");
    }
  }
  // 2. Run Plant.id API
  else if (API_CONFIG.engine === "plantid") {
    if (API_CONFIG.plantIdKey) {
      try {
        parsedResult = await diagnoseWithPlantId(imageFile);
      } catch (err) {
        console.error("Plant.id API error, falling back to Demo Mode:", err);
      }
    } else {
      console.warn("⚠️ Plant.id API key not configured — falling back to Demo Mode.");
    }
  }

  // 3. Fallback / Demo Mode
  if (!parsedResult) {
    parsedResult = getRandomDemoResult();
    isDemo = true;
  }

  // Try to enrich with Perenual if it is a disease
  let perenualInfo = null;
  if (parsedResult.name !== "healthy" && API_CONFIG.perenualKey) {
    perenualInfo = await fetchPerenualDiseaseInfo(parsedResult.name);
    if (perenualInfo && perenualInfo.description && !parsedResult.description) {
      parsedResult.description = perenualInfo.description;
    }
  }

  return { data: parsedResult, isDemo, perenualInfo };
}

// ══════════════════════════════════════════════════
// 6.  DOM WIRING
// ══════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {

  // ── Element refs ──
  const uploadZone   = document.getElementById("upload-zone");
  const fileInput    = document.getElementById("file-input");
  const uploadIdle   = document.getElementById("upload-idle");
  const uploadPreview= document.getElementById("upload-preview");
  const previewImg   = document.getElementById("preview-img");
  const clearBtn     = document.getElementById("clear-btn");
  const analyzeBtn   = document.getElementById("analyze-btn");
  const spinner      = document.getElementById("spinner");
  const btnLabel     = analyzeBtn.querySelector(".btn-label");
  const modeBadge    = document.getElementById("mode-badge");

  const resultsSection   = document.getElementById("results");
  const resultDisease    = document.getElementById("result-disease");
  const confidenceBar    = document.getElementById("confidence-bar");
  const confidencePct    = document.getElementById("confidence-pct");
  const resultDescription= document.getElementById("result-description");
  const resultTreatment  = document.getElementById("result-treatment");
  const resetBtn         = document.getElementById("reset-btn");

  let selectedFile = null;

  // ── File selection helpers ──
  function showPreview(file) {
    selectedFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    uploadIdle.classList.add("hidden");
    uploadPreview.classList.remove("hidden");
    analyzeBtn.disabled = false;
  }

  function clearPreview() {
    selectedFile = null;
    previewImg.src = "";
    uploadPreview.classList.add("hidden");
    uploadIdle.classList.remove("hidden");
    analyzeBtn.disabled = true;
    fileInput.value = "";
  }

  // ── Upload zone interactions ──
  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) showPreview(fileInput.files[0]);
  });

  // Drag & drop
  ["dragenter", "dragover"].forEach(evt =>
    uploadZone.addEventListener(evt, (e) => { e.preventDefault(); uploadZone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    uploadZone.addEventListener(evt, () => uploadZone.classList.remove("dragover"))
  );
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) showPreview(file);
  });

  clearBtn.addEventListener("click", (e) => { e.stopPropagation(); clearPreview(); });

  // ── Analyze ──
  analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    // UI → loading state
    analyzeBtn.disabled = true;
    btnLabel.textContent = "Analyzing…";
    spinner.classList.remove("hidden");
    resultsSection.classList.add("hidden");
    modeBadge.classList.add("badge--hidden");

    // Call API (or demo fallback)
    const { data, isDemo, perenualInfo } = await diagnose(selectedFile);

    // Show / hide demo badge
    if (isDemo) {
      modeBadge.classList.remove("badge--hidden");
    }

    // Populate results
    const pctValue = Math.round(data.probability * 100);
    resultDisease.textContent     = data.name;
    confidenceBar.style.setProperty("--pct", pctValue + "%");
    confidencePct.textContent     = pctValue + "%";
    resultDescription.textContent = data.description || "No additional description available.";

    // Use Perenual solution if available, otherwise fall back to local treatmentMap
    if (perenualInfo && perenualInfo.solution) {
      resultTreatment.textContent = perenualInfo.solution;
    } else {
      resultTreatment.textContent = getTreatment(data.name);
    }

    // UI → show results
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Reset button state
    btnLabel.textContent = "Analyze Plant";
    spinner.classList.add("hidden");
    analyzeBtn.disabled = false;
  });

  // ── Reset ──
  resetBtn.addEventListener("click", () => {
    resultsSection.classList.add("hidden");
    clearPreview();
    modeBadge.classList.add("badge--hidden");
    document.getElementById("hero").scrollIntoView({ behavior: "smooth" });
  });
});
