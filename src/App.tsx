import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Markdown from 'react-markdown';
import { Bot, Code, Play, Settings, X } from 'lucide-react';
import { UEBlueprintViewer, BlueprintNodeData, NodeExplanation } from './components/UEBlueprintViewer';

type AIProvider = 'google' | 'nvidia' | 'ollama';

interface AIConfig {
  provider: AIProvider;
  google: { apiKey: string; model: string };
  nvidia: { apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'google',
  google: { apiKey: '', model: 'gemini-3.1-pro-preview' },
  nvidia: { apiKey: '', model: 'meta/llama-3.1-70b-instruct' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' }
};

async function fetchAIExplanation(config: AIConfig, prompt: string, onChunk: (text: string) => void) {
  if (config.provider === 'google') {
    const ai = new GoogleGenAI({ apiKey: config.google.apiKey || process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContentStream({
      model: config.google.model || 'gemini-3.1-pro-preview',
      contents: prompt,
    });
    for await (const chunk of response) {
      onChunk(chunk.text || '');
    }
  } else if (config.provider === 'nvidia') {
    if (!config.nvidia.apiKey) throw new Error('NVIDIA API Key is required');
    const response = await fetch('/api/nvidia/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.nvidia.apiKey}`
      },
      body: JSON.stringify({
        model: config.nvidia.model || 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 2048
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`NVIDIA API Error: ${errData.error || response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta?.content) {
              onChunk(data.choices[0].delta.content);
            }
          } catch (e) {}
        }
      }
    }
  } else if (config.provider === 'ollama') {
    const response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model || 'llama3',
        prompt: prompt,
        stream: true
      })
    });
    if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) onChunk(data.response);
        } catch (e) {}
      }
    }
  }
}

async function fetchAINodesJSON(config: AIConfig, prompt: string): Promise<string> {
  if (config.provider === 'google') {
    const ai = new GoogleGenAI({ apiKey: config.google.apiKey || process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: config.google.model || 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["index", "explanation"]
          }
        }
      }
    });
    return response.text || '';
  } else if (config.provider === 'nvidia') {
    if (!config.nvidia.apiKey) throw new Error('NVIDIA API Key is required');
    const response = await fetch('/api/nvidia/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.nvidia.apiKey}`
      },
      body: JSON.stringify({
        model: config.nvidia.model || 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`NVIDIA API Error: ${errData.error || response.statusText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else if (config.provider === 'ollama') {
    const response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model || 'llama3',
        prompt: prompt,
        stream: false,
        format: 'json'
      })
    });
    if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);
    const data = await response.json();
    return data.response || '';
  }
  return '';
}

export default function App() {
  const [rawText, setRawText] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [renderedNodes, setRenderedNodes] = useState<BlueprintNodeData[]>([]);
  const [nodeExplanations, setNodeExplanations] = useState<NodeExplanation[]>([]);
  
  const [config, setConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('ai-config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('ai-config', JSON.stringify(config));
  }, [config]);

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawText(e.target.value);
    setNodeExplanations([]); // Clear explanations when text changes
  };

  const handleNodesRendered = (nodes: BlueprintNodeData[]) => {
    setRenderedNodes(nodes);
  };

  const handleAILearning = async () => {
    if (!rawText.trim()) return;
    
    setIsLoading(true);
    setAiExplanation('');
    setNodeExplanations([]);
    
    try {
      // 1. Get general explanation
      const prompt = `
You are an expert Unreal Engine Blueprint tutor.
The user has provided the following raw Blueprint text:
<TEXT>
${rawText}
</TEXT>

Please explain this blueprint in Kurdish Sorani (زمانی کوردی سۆرانی) clearly and professionally.
Provide a summary of what the entire blueprint does and why it was created.
Do not make mistakes. Use proper Kurdish terminology where applicable, but keep technical Unreal Engine terms (like Event Tick, Cast To, etc.) in English if they are better understood that way.
      `;

      await fetchAIExplanation(config, prompt, (text) => {
        setAiExplanation((prev) => prev + text);
      });

      // 2. Get node-specific explanations if we have nodes
      if (renderedNodes.length > 0) {
        const nodesContext = renderedNodes.map(n => `Node ${n.index}: Title="${n.title}", Type="${n.type}"`).join('\n');
        
        const nodesPrompt = `
You are an expert Unreal Engine Blueprint tutor.
I have a blueprint with the following nodes:
${nodesContext}

For each node, provide a short, professional explanation in Kurdish Sorani (زمانی کوردی سۆرانی).
Explain what this specific node is, what it does, and why it's used in this context.
Keep it concise (1-2 sentences per node).

Return a JSON array of objects with the following schema:
[
  {
    "index": <number>,
    "explanation": "<string>"
  }
]
        `;

        const nodesResponseText = await fetchAINodesJSON(config, nodesPrompt);

        if (nodesResponseText) {
          try {
            const jsonText = nodesResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedExplanations = JSON.parse(jsonText);
            setNodeExplanations(parsedExplanations);
          } catch (e) {
            console.error('Failed to parse node explanations JSON:', e);
          }
        }
      }

    } catch (error: any) {
      console.error('Error generating AI explanation:', error);
      
      let errorMessage = error.message;
      if (errorMessage === 'Failed to fetch') {
        if (config.provider === 'ollama') {
          errorMessage = 'نەتوانرا پەیوەندی بە Ollama بکرێت. دڵنیابە کە Ollama کار دەکات. تێبینی: بەهۆی ئەوەی ئەم وێبسایتە (HTTPS)ە، ناتوانێت ڕاستەوخۆ پەیوەندی بە (HTTP://localhost) بکات بەهۆی پاراستنی وێبگەڕەوە (Mixed Content). پێویستە Ollama بخەیتە سەر HTTPS یان لە ڕێگەی نەرمەکاڵایەکی وەک ngrok بەکاری بهێنیت.';
        } else if (config.provider === 'nvidia') {
          errorMessage = 'نەتوانرا پەیوەندی بە سێرڤەری NVIDIA بکرێت. ئەمە لەوانەیە بەهۆی کێشەی هێڵی ئینتەرنێت یان ڕێگریکردنی وێبگەڕەوە بێت (CORS). دڵنیابە کە API Key ڕاستە.';
        } else {
          errorMessage = 'کێشە لە پەیوەندیکردن بە سێرڤەر هەیە (Failed to fetch). تکایە هێڵی ئینتەرنێتەکەت بپشکنە.';
        }
      }

      setAiExplanation(`هەڵەیەک ڕوویدا لە کاتی پەیوەندیکردن بە ئەی ئای. تکایە دووبارە هەوڵ بدەرەوە.\n\n**هۆکار:** ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100 font-sans" dir="rtl">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-950 border-b border-neutral-800 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Code className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">فێربوونی بلوپرێنت (Blueprint AI Tutor)</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-neutral-400">
            بەهێزکراوە بە {config.provider === 'google' ? 'Google AI' : config.provider === 'nvidia' ? 'NVIDIA AI' : 'Ollama'}
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-300"
            title="ڕێکخستنەکانی ئەی ئای (AI Settings)"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                ڕێکخستنەکانی ئەی ئای (AI Settings)
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5">
              {/* Provider Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-300">دابینکەری ئەی ئای (AI Provider)</label>
                <select 
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value as AIProvider })}
                  className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  dir="ltr"
                >
                  <option value="google">Google AI Studio (Gemini)</option>
                  <option value="nvidia">NVIDIA Build (Qwen, Llama, etc.)</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              {/* Provider Specific Settings */}
              {config.provider === 'google' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">API Key (Optional if set in env)</label>
                    <input 
                      type="password"
                      value={config.google.apiKey}
                      onChange={(e) => setConfig({ ...config, google: { ...config.google, apiKey: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="AIzaSy..."
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">Model</label>
                    <input 
                      type="text"
                      value={config.google.model}
                      onChange={(e) => setConfig({ ...config, google: { ...config.google, model: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="gemini-3.1-pro-preview"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              {config.provider === 'nvidia' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">NVIDIA API Key</label>
                    <input 
                      type="password"
                      value={config.nvidia.apiKey}
                      onChange={(e) => setConfig({ ...config, nvidia: { ...config.nvidia, apiKey: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="nvapi-..."
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">Model</label>
                    <input 
                      type="text"
                      value={config.nvidia.model}
                      onChange={(e) => setConfig({ ...config, nvidia: { ...config.nvidia, model: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="meta/llama-3.1-70b-instruct"
                      dir="ltr"
                    />
                    <div className="text-xs text-neutral-500" dir="ltr">
                      Examples: meta/llama-3.1-70b-instruct, mistralai/mixtral-8x22b-instruct-v0.1, qwen/qwen2.5-72b-instruct
                    </div>
                  </div>
                </>
              )}

              {config.provider === 'ollama' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">Base URL</label>
                    <input 
                      type="text"
                      value={config.ollama.baseUrl}
                      onChange={(e) => setConfig({ ...config, ollama: { ...config.ollama, baseUrl: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="http://localhost:11434"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-neutral-300">Model</label>
                    <input 
                      type="text"
                      value={config.ollama.model}
                      onChange={(e) => setConfig({ ...config, ollama: { ...config.ollama, model: e.target.value } })}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      placeholder="llama3"
                      dir="ltr"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                پاشەکەوتکردن (Save)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar (Right side due to RTL) */}
        <aside className="w-1/3 min-w-[350px] max-w-[500px] flex flex-col bg-neutral-900 border-l border-neutral-800 z-10 shadow-xl overflow-hidden">
          <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <label htmlFor="blueprint-input" className="text-sm font-medium text-neutral-300">
                کۆدی بلوپرێنت لێرە دابنێ (Paste Blueprint here):
              </label>
              <textarea
                id="blueprint-input"
                className="w-full h-48 p-3 bg-neutral-950 border border-neutral-700 rounded-lg text-sm font-mono text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Begin Object Class=..."
                value={rawText}
                onChange={handlePaste}
                dir="ltr"
              />
            </div>

            <button
              onClick={handleAILearning}
              disabled={isLoading || !rawText.trim()}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium rounded-lg transition-colors shadow-md"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Bot className="w-5 h-5" />
              )}
              ئەی ئای فێربوون (AI Learning)
            </button>

            {/* AI Explanation Area */}
            <div className="flex-1 flex flex-col gap-2 mt-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-500" />
                ڕوونکردنەوەی ئەی ئای:
              </h2>
              <div className="flex-1 p-4 bg-neutral-950 border border-neutral-800 rounded-lg overflow-y-auto">
                {aiExplanation ? (
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <Markdown>{aiExplanation}</Markdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-500 text-sm italic text-center">
                    کۆدی بلوپرێنت دابنێ و دوگمەی "ئەی ئای فێربوون" دابگرە بۆ بینینی ڕوونکردنەوە.
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Canvas Area (Left side) */}
        <section className="flex-1 relative bg-[#1e1e1e]" dir="ltr">
          {rawText.trim() ? (
            <UEBlueprintViewer 
              blueprintText={rawText} 
              onNodesRendered={handleNodesRendered}
              nodeExplanations={nodeExplanations}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-600">
              <div className="text-center flex flex-col items-center gap-3">
                <Code className="w-12 h-12 opacity-20" />
                <p>هیچ نۆدێک نەدۆزرایەوە. کۆدی بلوپرێنت لە بەشی ڕاست دابنێ.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
