importScripts(chrome.runtime.getURL("src/shared/constants.js"));

const {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  PORTS,
  mergeSettings,
  ensureStorageSchema,
  completionUrl,
  getEffectiveLanguage,
  t
} = globalThis.InlineAIConstants;

ensureStorageSchema(chrome.storage.local).catch((error) => {
  console.warn("[这是啥来着] Storage schema init failed:", error);
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORTS.stream) {
    return;
  }

  let controller = null;

  port.onDisconnect.addListener(() => {
    if (controller) {
      controller.abort();
    }
  });

  port.onMessage.addListener(async (message) => {
    if (message?.type !== MESSAGE_TYPES.apiCall) {
      return;
    }

    controller = new AbortController();

    let settings = null;
    try {
      settings = await getSettings(message.payload?.settingsOverride);
      await streamChatCompletion({
        port,
        controller,
        requestId: message.requestId,
        settings,
        messages: message.payload?.messages || []
      });
    } catch (error) {
      postPort(port, {
        type: MESSAGE_TYPES.apiError,
        requestId: message.requestId,
        error: humanizeError(error, settings)
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.testApi) {
    testApiConnection(message.payload?.settingsOverride)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: humanizeError(error, message.payload?.settingsOverride) }));

    return true;
  }

  if (message?.type === MESSAGE_TYPES.listModels) {
    listModels(message.payload?.settingsOverride)
      .then((models) => sendResponse({ ok: true, models }))
      .catch((error) => sendResponse({ ok: false, error: humanizeError(error, message.payload?.settingsOverride) }));

    return true;
  }

  return false;
});

async function getSettings(override) {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = mergeSettings(stored[STORAGE_KEYS.settings]);
  return mergeSettings({ ...settings, ...(override || {}) });
}

async function testApiConnection(settingsOverride) {
  const settings = await getSettings(settingsOverride);
  validateSettings(settings);

  const response = await fetch(completionUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: requestHeaders(settings),
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      max_tokens: 8,
      messages: [
        { role: "system", content: "Reply with OK." },
        { role: "user", content: "ping" }
      ]
    })
  });

  if (!response.ok) {
    throw await responseError(response);
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content || "OK";
}

async function listModels(settingsOverride) {
  const settings = await getSettings(settingsOverride);
  const language = getEffectiveLanguage(settings);
  if (!settings.apiBaseUrl) {
    throw new Error(t("background.fillBaseUrl", language));
  }
  if (!settings.apiKey && !isLocalProvider(settings)) {
    throw new Error(t("background.fillApiKey", language));
  }

  const response = await fetch(modelsUrl(settings.apiBaseUrl), {
    method: "GET",
    headers: requestHeaders(settings)
  });

  if (!response.ok) {
    throw await responseError(response);
  }

  const json = await response.json();
  const models = Array.isArray(json?.data)
    ? json.data.map((item) => item?.id || item?.name).filter(Boolean)
    : [];

  if (!models.length) {
    throw new Error(t("background.noModels", language));
  }

  return models;
}

async function streamChatCompletion({ port, controller, requestId, settings, messages }) {
  validateSettings(settings);

  const response = await fetch(completionUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: requestHeaders(settings),
    signal: controller.signal,
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw await responseError(response);
  }

  if (!response.body) {
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || "";
    postPort(port, { type: MESSAGE_TYPES.apiChunk, requestId, chunk: content });
    postPort(port, { type: MESSAGE_TYPES.apiDone, requestId });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = consumeSseBuffer(buffer, (chunk) => {
      postPort(port, { type: MESSAGE_TYPES.apiChunk, requestId, chunk });
    });
  }

  consumeSseBuffer(`${buffer}\n\n`, (chunk) => {
    postPort(port, { type: MESSAGE_TYPES.apiChunk, requestId, chunk });
  });

  postPort(port, { type: MESSAGE_TYPES.apiDone, requestId });
}

function consumeSseBuffer(buffer, onChunk) {
  const events = buffer.split("\n\n");
  const remainder = events.pop() || "";

  for (const event of events) {
    const lines = event.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      try {
        const json = JSON.parse(data);
        const chunk =
          json?.choices?.[0]?.delta?.content ||
          json?.choices?.[0]?.message?.content ||
          json?.delta ||
          "";

        if (chunk) {
          onChunk(chunk);
        }
      } catch (error) {
        console.warn("[这是啥来着] Could not parse stream event:", error);
      }
    }
  }

  return remainder;
}

function validateSettings(settings) {
  const language = getEffectiveLanguage(settings);
  if (!completionUrl(settings.apiBaseUrl)) {
    throw new Error(t("background.fillBaseUrlInSettings", language));
  }
  if (!settings.apiKey && !isLocalProvider(settings)) {
    throw new Error(t("background.fillApiKeyInSettings", language));
  }
  if (!settings.model) {
    throw new Error(t("background.fillModelInSettings", language));
  }
}

function requestHeaders(settings) {
  const headers = { "Content-Type": "application/json" };
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }
  return headers;
}

function modelsUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  if (/\/models$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/i, "/models");
  }
  return `${trimmed}/models`;
}

function isLocalProvider(settings) {
  return /^(ollama|lmstudio)$/i.test(settings.modelProvider || "") || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(settings.apiBaseUrl || "");
}

async function responseError(response) {
  const body = await response.text().catch(() => "");
  let detail = body;

  try {
    const json = JSON.parse(body);
    detail = json?.error?.message || json?.message || body;
  } catch (_) {
    detail = body;
  }

  const message = detail || response.statusText || "API request failed";
  return new Error(`${response.status}: ${message}`);
}

function humanizeError(error, settings) {
  const language = getEffectiveLanguage(settings || {});
  if (error?.name === "AbortError") {
    return t("background.cancelled", language);
  }

  const message = String(error?.message || error || t("background.unknownError", language));
  if (/401|invalid api key|unauthorized/i.test(message)) {
    return t("background.invalidApiKey", language);
  }
  if (/404|model/i.test(message)) {
    return t("background.modelMissing", { message }, language);
  }
  if (/429|rate/i.test(message)) {
    return t("background.rateLimited", language);
  }
  if (/failed to fetch|network/i.test(message)) {
    return t("background.networkFailed", language);
  }

  return message;
}

function postPort(port, message) {
  try {
    port.postMessage(message);
  } catch (error) {
    console.warn("[这是啥来着] Could not post message:", error);
  }
}
