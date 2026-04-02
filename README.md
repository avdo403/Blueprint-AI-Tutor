# Blueprint AI Tutor (فێربوونی بلوپرێنت بە ئەی ئای)

A web application built with React and Vite that acts as an intelligent tutor for Unreal Engine Blueprints. It allows users to paste raw Blueprint code, visualizes it, and provides detailed explanations in Kurdish Sorani using advanced AI models like Google Gemini, NVIDIA AI (Llama/Qwen), and local Ollama.

ئەم پڕۆژەیە بەرنامەیەکی وێبە کە یارمەتی گەشەپێدەرانی یاری دەدات بۆ تێگەیشتن لە کۆدی بلوپرێنتی Unreal Engine بە یارمەتی ژیری دەستکرد (AI). دەتوانیت کۆدی بلوپرێنت کۆپی بکەیت و لێرە دایبنێیت، پاشان ئەی ئای بە کوردی ڕوونکردنەوەی تەواوت پێدەدات لەسەر هەر نۆدێک.

## ✨ Features (تایبەتمەندییەکان)

- **Blueprint Visualization:** Visualizes Unreal Engine Blueprint nodes from string formatted clipboard data. (نیشاندانی نۆدەکانی بلوپرێنت لە شێوەی وێنەیی).
- **Multi-AI Support:** (پشتیوانی چەندین جۆری ئەی ئای):
  - Google Gemini (API)
  - NVIDIA AI Cloud (Llama, Qwen, Mistral)
  - Ollama (بۆ بەکارهێنانی لۆکاڵی بەبێ ئینتەرنێت)
- **Kurdish Explanations:** Explains complex Unreal Engine logic in clear Kurdish Sorani. (ڕوونکردنەوەی تەواوی کۆدەکان بە زمانی کوردی سۆرانی).

## 🚀 How to Run Locally (چۆنیەتی کارپێکردن)

**Prerequisites (پێداویستییەکان):**
- [Node.js](https://nodejs.org/) installed on your machine.

**Steps (هەنگاوەکان):**

1. Install dependencies (دابەزاندنی پێداویستییەکان):
   ```bash
   npm install
   ```
2. Run the application (کارپێکردنی بەرنامەکە):
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`

## ⚙️ Configuration (ڕێکخستنەکان)

You can click on the Settings (Settings Icon) in the top right corner of the application to configure your preferred AI provider:
- **Google Gemini:** Requires a Google API Key.
- **NVIDIA AI:** Requires an NVIDIA API Key.
- **Ollama:** Make sure Ollama is running locally on `http://localhost:11434`.

---
*Developed for the Kurdish Game Development Community.*
