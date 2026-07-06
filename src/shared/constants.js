(function exposeInlineAIConstants(global) {
  const STORAGE_KEYS = {
    settings: "inlineai_settings",
    terms: "inlineai_terms",
    answers: "inlineai_answers",
    memories: "inlineai_memories",
    schemaVersion: "inlineai_schema_version"
  };

  const CURRENT_SCHEMA_VERSION = 1;

  const MESSAGE_TYPES = {
    apiCall: "INLINEAI_API_CALL",
    apiChunk: "INLINEAI_API_CHUNK",
    apiDone: "INLINEAI_API_DONE",
    apiError: "INLINEAI_API_ERROR",
    testApi: "INLINEAI_TEST_API",
    listModels: "INLINEAI_LIST_MODELS",
    showReady: "INLINEAI_SHOW_READY",
    openMemory: "INLINEAI_OPEN_MEMORY"
  };

  const MODEL_PROVIDERS = [
    {
      id: "deepseek",
      label: "DeepSeek",
      apiBaseUrl: "https://api.deepseek.com/v1",
      defaultModel: "deepseek-chat",
      supportsModelList: true
    },
    {
      id: "kimi",
      label: "Kimi",
      apiBaseUrl: "https://api.moonshot.cn/v1",
      defaultModel: "moonshot-v1-8k",
      supportsModelList: true
    },
    {
      id: "volcengine",
      label: "火山方舟",
      apiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      defaultModel: "",
      supportsModelList: false
    },
    {
      id: "zhipu",
      label: "智谱 GLM",
      apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
      defaultModel: "glm-4-flash",
      supportsModelList: true
    },
    {
      id: "minimax",
      label: "MiniMax",
      apiBaseUrl: "https://api.minimax.chat/v1",
      defaultModel: "MiniMax-Text-01",
      supportsModelList: false
    },
    {
      id: "siliconflow",
      label: "硅基流动",
      apiBaseUrl: "https://api.siliconflow.cn/v1",
      defaultModel: "deepseek-ai/DeepSeek-V3",
      supportsModelList: true
    },
    {
      id: "openai",
      label: "OpenAI",
      apiBaseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4.1-mini",
      supportsModelList: true
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      apiBaseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "openai/gpt-4.1-mini",
      supportsModelList: true
    },
    {
      id: "groq",
      label: "Groq",
      apiBaseUrl: "https://api.groq.com/openai/v1",
      defaultModel: "llama-3.3-70b-versatile",
      supportsModelList: true
    },
    {
      id: "ollama",
      label: "本地 Ollama",
      apiBaseUrl: "http://localhost:11434/v1",
      defaultModel: "llama3.1",
      supportsModelList: true,
      allowEmptyApiKey: true
    },
    {
      id: "lmstudio",
      label: "本地 LM Studio",
      apiBaseUrl: "http://localhost:1234/v1",
      defaultModel: "local-model",
      supportsModelList: true,
      allowEmptyApiKey: true
    },
    {
      id: "custom",
      label: "自定义 OpenAI-compatible",
      apiBaseUrl: "",
      defaultModel: "",
      supportsModelList: true
    }
  ];

  const THEME_COLORS = [
    { id: "green", label: "绿", value: "#6f8f7b" },
    { id: "orange", label: "橙", value: "#c98257" },
    { id: "blue", label: "蓝", value: "#6f89a6" },
    { id: "gray", label: "灰", value: "#85837d" },
    { id: "pink", label: "粉", value: "#bd7f83" }
  ];

  const PROMPT_TEMPLATES = [
    {
      id: "define",
      label: "定义",
      prompt: "请用简洁中文解释“{{term}}”的定义，说明它常出现在哪些语境，并给出 1 个例子。"
    },
    {
      id: "translate",
      label: "翻译",
      prompt: "请翻译“{{term}}”。如果它是英文，请给出自然中文译法；如果它是中文，请给出英文译法，并解释语气差异。"
    },
    {
      id: "example",
      label: "举例",
      prompt: "请围绕“{{term}}”给出 2 个简短例子：一个直观例子，一个更贴近技术或学习场景的例子。"
    },
    {
      id: "summarize",
      label: "总结",
      prompt: "请把“{{term}}”压缩成 3 个要点，帮助我快速记住它。"
    }
  ];

  const DEFAULT_SETTINGS = {
    apiBaseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    modelProvider: "deepseek",
    model: "deepseek-chat",
    defaultQuestion: "联系上下文，请用简洁中文解释这个概念。",
    highlightColor: "#c98257",
    highlightMode: "background",
    linePattern: "dotted",
    matchWholeWord: true,
    caseSensitive: false,
    includePageContext: true,
    defaultSaveScope: "all",
    defaultReminder: "hoverWeak",
    hideReminders: false
  };

  const SAVE_SCOPES = {
    page: "当前页面",
    site: "当前域名家族",
    all: "所有页面"
  };

  const REMINDER_MODES = {
    none: "无提示，仅选中同词时提示",
    hoverWeak: "鼠标移上去后弱提示",
    alwaysWeak: "始终弱提示",
    hoverStrong: "鼠标移上去后明显提示",
    alwaysStrong: "始终明显提示"
  };

  const CSS = {
    highlightClass: "inlineai-highlight",
    localHighlightClass: "inlineai-local-highlight",
    highlightAttribute: "data-inlineai-term-key"
  };

  const PORTS = {
    stream: "inlineai-stream"
  };

  const LIMITS = {
    maxHistoryEntries: 5,
    maxTermKeyLength: 120,
    maxSelectionLength: 240
  };

  function normalizeTerm(term) {
    return String(term || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, LIMITS.maxTermKeyLength);
  }

  function mergeSettings(saved) {
    const migratedMode = saved?.highlightMode || migrateLegacyHighlightStyle(saved?.highlightStyle);
    const savedColor = String(saved?.highlightColor || "").toLowerCase();
    const migratedColor = !savedColor || savedColor === "#fef08c"
      ? DEFAULT_SETTINGS.highlightColor
      : saved.highlightColor;
    const savedQuestion = String(saved?.defaultQuestion || "");
    const legacyDefaultQuestions = [
      "请用简洁中文解释这个概念，并给出 1-2 个例子。",
      "请用简洁中文解释“{{term}}”。优先结合页面上下文说明它在当前文章里的意思；如果上下文足够，给一个和当前文章直接相关的短例子；如果上下文不足，请明确说不足，不要硬举当前文章例子。"
    ];
    const migratedQuestion = !savedQuestion || legacyDefaultQuestions.includes(savedQuestion)
      ? DEFAULT_SETTINGS.defaultQuestion
      : savedQuestion;

    return {
      ...DEFAULT_SETTINGS,
      ...(saved || {}),
      modelProvider: saved?.modelProvider || DEFAULT_SETTINGS.modelProvider,
      defaultQuestion: migratedQuestion,
      highlightColor: migratedColor,
      highlightMode: migratedMode,
      linePattern: saved?.linePattern || DEFAULT_SETTINGS.linePattern,
      matchWholeWord: saved?.matchWholeWord !== false,
      caseSensitive: Boolean(saved?.caseSensitive),
      includePageContext: saved?.includePageContext !== false,
      defaultSaveScope: SAVE_SCOPES[saved?.defaultSaveScope] ? saved.defaultSaveScope : DEFAULT_SETTINGS.defaultSaveScope,
      defaultReminder: REMINDER_MODES[saved?.defaultReminder] ? saved.defaultReminder : DEFAULT_SETTINGS.defaultReminder,
      hideReminders: Boolean(saved?.hideReminders)
    };
  }

  async function ensureStorageSchema(storageArea) {
    const area = storageArea || global.chrome?.storage?.local;
    if (!area) {
      return;
    }

    const stored = await area.get([STORAGE_KEYS.schemaVersion, STORAGE_KEYS.memories]);
    if (stored[STORAGE_KEYS.schemaVersion] !== CURRENT_SCHEMA_VERSION || !stored[STORAGE_KEYS.memories]) {
      await area.set({
        [STORAGE_KEYS.schemaVersion]: CURRENT_SCHEMA_VERSION,
        [STORAGE_KEYS.memories]: stored[STORAGE_KEYS.memories] || {}
      });
    }
    await area.remove([STORAGE_KEYS.terms, STORAGE_KEYS.answers]);
  }

  function migrateLegacyHighlightStyle(style) {
    if (style === "underline") {
      return "underline";
    }
    if (style === "box") {
      return "box";
    }
    return DEFAULT_SETTINGS.highlightMode;
  }

  function completionUrl(baseUrl) {
    const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!trimmed) {
      return "";
    }
    if (/\/chat\/completions$/i.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}/chat/completions`;
  }

  global.InlineAIConstants = {
    STORAGE_KEYS,
    CURRENT_SCHEMA_VERSION,
    MESSAGE_TYPES,
    MODEL_PROVIDERS,
    THEME_COLORS,
    DEFAULT_SETTINGS,
    SAVE_SCOPES,
    REMINDER_MODES,
    PROMPT_TEMPLATES,
    CSS,
    PORTS,
    LIMITS,
    normalizeTerm,
    mergeSettings,
    ensureStorageSchema,
    completionUrl
  };
})(globalThis);
