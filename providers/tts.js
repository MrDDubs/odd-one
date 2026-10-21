// providers/tts.js (ESM)
// Generates natural TikTok voice TTS with local audio base64 return

export const TIKTOK_VOICES = [
  { id: "en_us_001", name: "English US (Female 1)" },
  { id: "en_us_002", name: "English US (Female 2)" },
  { id: "en_us_006", name: "English US (Male 1)" },
  { id: "en_us_007", name: "English US (Male 2)" },
  { id: "en_us_009", name: "English US (Male 3)" },
  { id: "en_us_010", name: "English US (Male 4)" },
  { id: "en_uk_001", name: "English UK (Male 1)" },
  { id: "en_uk_003", name: "English UK (Male 2)" },
  { id: "en_au_001", name: "English AU (Female)" },
  { id: "en_au_002", name: "English AU (Male)" },
  { id: "en_male_narration", name: "Story Narrator" },
  { id: "en_male_funny", name: "Wacky / Funny" },
  { id: "en_female_emotional", name: "Peaceful / Emotional" }
];

export async function getTikTokTTS(text, voice = "en_us_001") {
  if (!text || !text.trim()) return null;
  const cleanText = text.trim().slice(0, 300); // TikTok TTS limit per phrase

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch("https://tiktok-tts.weilnet.workers.dev/api/generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cleanText,
        voice: voice || "en_us_001"
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[TTS] TikTok API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data && data.data) {
      return data.data; // Base64 encoded MP3 string
    }
    return null;
  } catch (err) {
    console.warn(`[TTS] Failed to generate TikTok TTS:`, err.message);
    return null;
  }
}
