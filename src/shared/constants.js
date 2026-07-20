(function exposeInlineAIConstants(global) {
  const STORAGE_KEYS = {
    settings: "inlineai_settings",
    terms: "inlineai_terms",
    answers: "inlineai_answers",
    memories: "inlineai_memories",
    annotationBatches: "inlineai_annotation_batches",
    activeAnnotationBatches: "inlineai_active_annotation_batches",
    onboardingCompleted: "inlineai_onboarding_completed",
    onboardingVersion: "inlineai_onboarding_version",
    onboardingLastStep: "inlineai_onboarding_last_step",
    schemaVersion: "inlineai_schema_version"
  };

  const CURRENT_SCHEMA_VERSION = 3;

  const MESSAGE_TYPES = {
    apiCall: "INLINEAI_API_CALL",
    apiChunk: "INLINEAI_API_CHUNK",
    apiDone: "INLINEAI_API_DONE",
    apiError: "INLINEAI_API_ERROR",
    testApi: "INLINEAI_TEST_API",
    listModels: "INLINEAI_LIST_MODELS",
    showReady: "INLINEAI_SHOW_READY",
    openMemory: "INLINEAI_OPEN_MEMORY",
    openOnboarding: "INLINEAI_OPEN_ONBOARDING"
  };

  const LANGUAGES = {
    auto: { id: "auto", labelKey: "language.auto" },
    zh: { id: "zh", labelKey: "language.zh" },
    en: { id: "en", labelKey: "language.en" }
  };

  const DEFAULT_PROMPTS = {
    zh: "联系上下文{{term}} ，请用简洁中文解释这个概念。如果在该文中单独定义了该词，则回答。",
    en: "Use the surrounding context around {{term}} to briefly explain this concept in English. If the article defines the term explicitly, use that definition."
  };

  const LEGACY_DEFAULT_PROMPTS = [
    "联系上下文，请用简洁中文解释这个概念。",
    "请用简洁中文解释这个概念，并给出 1-2 个例子。",
    "请用简洁中文解释“{{term}}”。优先结合页面上下文说明它在当前文章里的意思；如果上下文足够，给一个和当前文章直接相关的短例子；如果上下文不足，请明确说不足，不要硬举当前文章例子。"
  ];

  const TRANSLATIONS = {
    zh: {
      "app.name": "这是啥来着",
      "app.dialogLabel": "这是啥来着",
      "app.settingsTitle": "这是啥来着 设置",
      "app.historyTitle": "这是啥来着 历史解释",
      "app.onboardingTitle": "这是啥来着 快速教程",
      "app.subtitle": "记忆式阅读助手",
      "language.auto": "自动",
      "language.zh": "中文",
      "language.en": "English",
      "provider.volcengine": "火山方舟",
      "provider.zhipu": "智谱 GLM",
      "provider.siliconflow": "硅基流动",
      "provider.ollama": "本地 Ollama",
      "provider.lmstudio": "本地 LM Studio",
      "provider.custom": "自定义 OpenAI-compatible",
      "color.green": "绿",
      "color.orange": "橙",
      "color.blue": "蓝",
      "color.gray": "灰",
      "color.pink": "粉",
      "saveScope.page": "当前页面",
      "saveScope.site": "当前域名家族",
      "saveScope.all": "所有页面",
      "reminder.none": "无提示，仅选中同词时提示",
      "reminder.hoverWeak": "鼠标移上去后弱提示",
      "reminder.alwaysWeak": "始终弱提示",
      "reminder.hoverStrong": "鼠标移上去后明显提示",
      "reminder.alwaysStrong": "始终明显提示",
      "popup.currentPage": "当前页面",
      "popup.loading": "读取状态中...",
      "popup.refresh": "注入插件 / 刷新",
      "popup.hideReminders": "隐藏提醒",
      "popup.showReminders": "显示提醒",
      "popup.settings": "设置",
      "popup.history": "全部历史解释",
      "popup.themeColor": "主题色",
      "popup.themeColorAria": "快速选择主题色",
      "popup.nonWebPage": "非网页页面",
      "popup.memoryCount": "{memories} 条记忆 / {cards} 张卡片",
      "popup.annotationCount": "{history} 个历史批注批次 / {active} 条暂存批注",
      "popup.apiConfigured": "API 已配置",
      "popup.apiMissing": "API 未配置",
      "popup.internalPage": "浏览器内部页不可注入。普通网页会自动启用。",
      "popup.ready": "普通网页已自动启用。临时解释默认不保存。",
      "popup.refreshed": "这是啥来着已刷新。",
      "popup.pageReloaded": "页面已刷新，插件会自动注入。",
      "popup.selectColor": "选择{color}色",
      "options.statusReady": "已生效",
      "options.localSettings": "本地设置",
      "options.api": "API",
      "options.modelProvider": "模型提供商",
      "options.saveSettings": "保存设置",
      "options.refreshModels": "刷新模型列表",
      "options.testConnection": "测试连接",
      "options.apiHint": "拉不到模型列表时，仍可直接手动填写 OpenAI-compatible 模型名。本地 Ollama/LM Studio 可以留空 API Key。",
      "options.question": "提问",
      "options.language": "语言",
      "options.defaultPrompt": "默认 Prompt",
      "options.promptHint": "默认 Prompt 会随语言自动切换；<code>{{term}}</code> 代表划线内容。",
      "options.includeContext": "划线提问时附带选区前后上下文",
      "options.memoryRules": "记忆规则",
      "options.defaultSaveScope": "默认保存范围",
      "options.hideReminders": "临时隐藏历史悬浮提醒",
      "options.theme": "主题色",
      "options.themeHint": "主题色会同步到圆点、输入框、回答框和工具栏弹窗。",
      "options.historyData": "历史数据",
      "options.clearMemories": "清空历史解释",
      "options.openExplanationHistory": "查看历史解释",
      "options.openAnnotationHistory": "查看历史批注",
      "options.clearAnnotations": "清空历史批注",
      "options.annotationCount": "已保存 {history} 个批注批次，暂存 {active} 条批注。",
      "options.clearAnnotationsConfirm": "确定清空 {count} 个历史批注批次？这个操作不可撤销。",
      "options.annotationsCleared": "已清空所有历史批注。",
      "options.help": "帮助",
      "options.reopenOnboarding": "重新查看快速教程",
      "options.memoryInitial": "已保存 0 条记忆。",
      "options.loadFailed": "加载失败：{message}",
      "options.testingApi": "正在测试 API...",
      "options.connected": "连接成功。",
      "options.connectionFailed": "连接失败。",
      "options.providerAppliedRefresh": "已套用厂商预设，可刷新模型列表。",
      "options.providerAppliedManual": "已套用厂商预设，可手动填写模型名。",
      "options.modelListUnsupported": "这个厂商暂不支持自动拉取模型列表，请手动填写模型名。",
      "options.refreshingModels": "正在刷新模型列表...",
      "options.refreshFailed": "刷新失败，可手动填写模型名。",
      "options.modelsLoaded": "已读取 {count} 个模型，可在 Model 中选择或手动输入。",
      "options.noMemories": "当前没有历史记忆。",
      "options.clearConfirm": "确定清空 {count} 条历史记忆？这个操作不可撤销。",
      "options.memoriesCleared": "已清空所有历史记忆。",
      "options.memoryCount": "已保存 {memories} 条记忆，{cards} 张回答卡。",
      "history.heading": "全部历史解释",
      "history.tabExplanations": "历史解释",
      "history.tabAnnotations": "历史批注",
      "history.annotationHeading": "历史批注",
      "history.annotationSearchPlaceholder": "页面标题、地址、原文、批注",
      "history.annotationSummary": "共 {batches} 个批注批次，{items} 条批注。",
      "history.annotationEmpty": "没有匹配的历史批注。暂存和已处理批次都会保存在浏览器本地。",
      "history.annotationStatusInjected": "已放入输入框",
      "history.annotationStatusCopied": "已复制",
      "history.annotationStatusPendingPaste": "已复制，等待粘贴",
      "history.annotationStatusPasted": "已粘贴",
      "history.annotationStatusCollecting": "暂存中",
      "history.annotationStatusInjecting": "正在放入",
      "history.annotationDeleteConfirm": "删除这个批注批次？",
      "history.openOptions": "设置",
      "history.toolbarLabel": "历史筛选",
      "history.search": "搜索",
      "history.searchPlaceholder": "保存词、回答内容、网站",
      "history.filter": "筛选",
      "history.filterAll": "全部",
      "history.filterCurrentPage": "仅当前页面",
      "history.filterCurrentSite": "当前网站",
      "history.filterGlobal": "全部网页",
      "history.loading": "读取历史中...",
      "history.loadFailed": "读取失败：{message}",
      "history.summary": "共 {terms} 个保存词，{answers} 条回答。",
      "history.empty": "没有匹配的历史解释。临时解释不会出现在这里，点击回答卡片里的“保存”后才会进入历史。",
      "history.noSummary": "暂无回答摘要。",
      "history.unknownSite": "未知网站",
      "history.linkedLocations": "关联位置 {count}",
      "history.answerCount": "共 {count} 条回答",
      "history.copy": "复制",
      "history.openSource": "打开原文",
      "history.collapse": "收起",
      "history.expand": "展开",
      "history.more": "更多",
      "history.delete": "删除",
      "history.excerptAnswer": "节选回答",
      "history.fullAnswer": "完整回答",
      "history.noAnswer": "暂无回答。",
      "history.followup": "追问",
      "history.deleteConfirm": "删除“{term}”的所有历史回答？",
      "history.copied": "已复制。",
      "history.term": "词语：{term}",
      "history.source": "来源：{source}",
      "history.followupLabel": "追问：{query}",
      "history.answerLabel": "回答：{answer}",
      "history.unknownTime": "未知时间",
      "content.waiting": "正在等待回答...",
      "content.bubbleTitle": "点击解释，长按自定义提问",
      "content.bubbleExistingTitle": "点击查看已有回答，长按自定义提问",
      "content.historyHintTitle": "查看已保存解释",
      "content.readyToast": "这是啥来着已刷新。划线后点击圆点解释，长按自定义提问。",
      "content.savedRecordCount": "存有 {count} 条记录",
      "content.customQuestionAria": "自定义问题",
      "content.askPlaceholder": "问点什么...",
      "content.send": "发送",
      "content.sendQuestion": "发送问题",
      "content.sendFollowup": "继续追问",
      "content.annotation": "批注",
      "content.saveAnnotation": "保存这条批注",
      "content.annotationSaved": "已暂存 {count} 条批注。拖入输入框发给 AI，点击此处调整批注。",
      "content.annotationBasketAria": "批注篮，共 {count} 条批注。拖入输入框发给 AI，点击此处调整批注。",
      "content.annotationBasketLabelOne": " 条批注",
      "content.annotationBasketLabelMany": " 条批注",
      "content.annotationPanelTitle": "暂存批注 · {count}",
      "content.annotationEdit": "编辑",
      "content.annotationDelete": "删除",
      "content.annotationCopyAll": "复制全部",
      "content.annotationDrop": "松开放入 {count} 条批注",
      "content.annotationInserted": "已放入输入框",
      "content.annotationCopied": "已复制",
      "content.annotationPasteHere": "已复制，粘贴到这里。",
      "content.annotationPasteToAi": "批注已复制，请粘贴到 AI 输入框。",
      "content.annotationFallbackCopied": "自动注入失败，已复制，直接粘贴就好啦。",
      "content.annotationFallbackFailed": "自动注入和复制都失败了，请点击批注篮手动复制。",
      "content.annotationPasteComplete": "匹配的批注已粘贴完成。",
      "content.annotationHistoryHint": "可以在设置页查看历史批注。",
      "content.annotationNeedNote": "请先填写批注意见。",
      "content.annotationTooLong": "批注内容过长，请删减后再发送",
      "content.annotationLimit": "本次批注已达到 50 条，请先发送或整理。",
      "content.annotationSelectionTooLong": "选中的原文过长，最多 2000 个字符。",
      "content.annotationAnchorMissing": "原文位置已变化",
      "content.annotationCopyFailed": "复制失败，请检查浏览器权限后重试。",
      "content.annotationChangedAfterCopy": "批注已更新，请重新复制或拖动。",
      "onboarding.skip": "跳过教程",
      "onboarding.back": "上一步",
      "onboarding.next": "下一步",
      "onboarding.start": "开始使用",
      "onboarding.progress": "第 {current} 步，共 {total} 步",
      "onboarding.welcomeTitle": "欢迎使用「这是啥来着」",
      "onboarding.welcomeBody": "划选网页中的文字即可快速解释、继续追问、保存回答，并把多处意见整理成批注。",
      "onboarding.modelTitle": "连接你的模型服务",
      "onboarding.modelBody": "选择服务商并填写连接信息。配置保存在浏览器本地，可先测试连接再继续。",
      "onboarding.selectionTitle": "划线，点击圆点",
      "onboarding.selectionBody": "在普通网页划选文字，点击旁边的圆点立即解释；插件会结合可用的页面上下文。",
      "onboarding.customTitle": "长按圆点，自定义提问",
      "onboarding.customBody": "长按圆点打开独立输入框。得到回答后，可在下方输入框继续追问。",
      "onboarding.saveTitle": "需要时再保存",
      "onboarding.saveBody": "临时回答默认不会进入历史。点击保存可保留完整回答，选中回答片段后可只保存节选。",
      "onboarding.annotationTitle": "添加一条批注",
      "onboarding.annotationBody": "选中原文，长按圆点输入意见，然后点击带图标的「批注」。该操作只暂存，不会调用模型。",
      "onboarding.basketTitle": "整理并发送批注",
      "onboarding.basketBody": "批注会暂存在右下角。点击批注篮可以编辑或删除，也可将它拖入 AI 输入框；失败时会自动复制。",
      "onboarding.doneTitle": "设置完成",
      "onboarding.doneBody": "现在可以回到任意普通网页开始使用。以后可在设置页的帮助区域重新打开本教程。",
      "content.annotationEmptyAfterDelete": "本次批注已清空。",
      "content.followupAria": "继续追问",
      "content.followupPlaceholder": "继续围绕这个内容提问",
      "content.followupComposerPlaceholder": "继续追问，Enter 发送，Shift+Enter 换行",
      "content.close": "关闭",
      "content.save": "保存",
      "content.saveExcerpt": "保存节选",
      "content.noSavedAnswers": "这里暂时没有保存的回答。",
      "content.answering": "正在回答",
      "content.delete": "删除",
      "content.deleteSavedAnswer": "删除这条保存的回答",
      "content.defaultQueryTitle": "解释选中文字",
      "content.expandThreadAbout": "展开关于“{term}”的回答",
      "content.explain": "解释",
      "content.needQuestion": "请先输入问题。",
      "content.temporaryAnswer": "回答是临时的，点击保存才会进入历史。",
      "content.noAnswerToSave": "还没有可保存的回答。",
      "content.selectAnswerFirst": "请先选中一段回答。",
      "content.excerptSaved": "已保存节选。",
      "content.savedToHistory": "已保存到历史。",
      "content.deleteCardConfirm": "删除“{term}”的这条回答？",
      "content.recordDeleted": "这条保存记录已经删除。",
      "content.threadQuestion": "问题：{query}",
      "content.threadAnswer": "回答：{answer}",
      "content.threadFollowup": "追问：{query}",
      "content.requestFailed": "请求失败。",
      "content.contextInvalidated": "扩展上下文已失效，请刷新页面后重试。",
      "content.apiFailed": "API 请求失败。",
      "content.backgroundDisconnected": "后台连接已中断，请重试。",
      "content.retry": "重试",
      "content.system.1": "你是“这是啥来着”的阅读解释助手。",
      "content.system.2": "回答要简洁、准确，帮助用户理解网页中刚划线的词语、句子或概念。",
      "content.system.3": "优先使用中文。",
      "content.system.4": "如果提供了页面上下文，请优先结合上下文判断划线内容的具体含义。",
      "content.system.5": "只有在上下文足以支撑时，才给和当前文章直接相关的短例子；上下文不足时不要编造例子。",
      "content.selectedText": "划线内容",
      "content.question": "问题",
      "content.continueAround": "继续围绕“{term}”回答：{question}",
      "content.contextTitle": "页面上下文",
      "content.contextBefore": "前文",
      "content.contextSelected": "选中",
      "content.contextAfter": "后文",
      "content.none": "无",
      "background.fillBaseUrl": "请先填写 API Base URL。",
      "background.fillApiKey": "请先填写 API Key。",
      "background.noModels": "没有从该接口读到模型列表，请手动填写模型名。",
      "background.fillBaseUrlInSettings": "请先在“这是啥来着”设置中填写 API Base URL。",
      "background.fillApiKeyInSettings": "请先在“这是啥来着”设置中填写 API Key。",
      "background.fillModelInSettings": "请先在“这是啥来着”设置中填写模型名称。",
      "background.cancelled": "请求已取消。",
      "background.unknownError": "未知错误",
      "background.invalidApiKey": "API Key 无效或没有权限。",
      "background.modelMissing": "模型或接口不存在：{message}",
      "background.rateLimited": "请求过于频繁或额度不足。",
      "background.networkFailed": "网络请求失败，请检查 API Base URL 或代理。"
    },
    en: {
      "app.name": "这是啥来着",
      "app.dialogLabel": "这是啥来着",
      "app.settingsTitle": "这是啥来着 Settings",
      "app.historyTitle": "这是啥来着 History",
      "app.onboardingTitle": "这是啥来着 Quick Start",
      "app.subtitle": "Memory-based reading assistant",
      "language.auto": "Auto",
      "language.zh": "中文",
      "language.en": "English",
      "provider.volcengine": "Volcengine Ark",
      "provider.zhipu": "Zhipu GLM",
      "provider.siliconflow": "SiliconFlow",
      "provider.ollama": "Local Ollama",
      "provider.lmstudio": "Local LM Studio",
      "provider.custom": "Custom OpenAI-compatible",
      "color.green": "Green",
      "color.orange": "Orange",
      "color.blue": "Blue",
      "color.gray": "Gray",
      "color.pink": "Pink",
      "saveScope.page": "Current page",
      "saveScope.site": "Current domain family",
      "saveScope.all": "All pages",
      "reminder.none": "No reminder, only when selecting the same text",
      "reminder.hoverWeak": "Subtle reminder on hover",
      "reminder.alwaysWeak": "Always subtle reminder",
      "reminder.hoverStrong": "Prominent reminder on hover",
      "reminder.alwaysStrong": "Always prominent reminder",
      "popup.currentPage": "Current page",
      "popup.loading": "Reading status...",
      "popup.refresh": "Inject / Refresh",
      "popup.hideReminders": "Hide reminders",
      "popup.showReminders": "Show reminders",
      "popup.settings": "Settings",
      "popup.history": "All history",
      "popup.themeColor": "Theme color",
      "popup.themeColorAria": "Choose a theme color",
      "popup.nonWebPage": "Non-web page",
      "popup.memoryCount": "{memories} memories / {cards} cards",
      "popup.annotationCount": "{history} annotation batches / {active} pending annotations",
      "popup.apiConfigured": "API configured",
      "popup.apiMissing": "API not configured",
      "popup.internalPage": "Browser internal pages cannot be injected. Regular web pages are enabled automatically.",
      "popup.ready": "Regular web pages are enabled automatically. Temporary explanations are not saved by default.",
      "popup.refreshed": "这是啥来着 has been refreshed.",
      "popup.pageReloaded": "The page has been reloaded. The extension will inject automatically.",
      "popup.selectColor": "Choose {color}",
      "options.statusReady": "Applied",
      "options.localSettings": "Local settings",
      "options.api": "API",
      "options.modelProvider": "Model provider",
      "options.saveSettings": "Save settings",
      "options.refreshModels": "Refresh models",
      "options.testConnection": "Test connection",
      "options.apiHint": "If the model list cannot be fetched, you can still enter an OpenAI-compatible model name manually. Local Ollama/LM Studio can leave API Key empty.",
      "options.question": "Question",
      "options.language": "Language",
      "options.defaultPrompt": "Default Prompt",
      "options.promptHint": "The default prompt follows the selected language automatically; <code>{{term}}</code> represents the selected text.",
      "options.includeContext": "Include surrounding context when asking about selected text",
      "options.memoryRules": "Memory rules",
      "options.defaultSaveScope": "Default save scope",
      "options.hideReminders": "Temporarily hide history hover reminders",
      "options.theme": "Theme color",
      "options.themeHint": "The theme color is applied to the dot, input, answer panel, and toolbar popup.",
      "options.historyData": "History data",
      "options.clearMemories": "Clear explanation history",
      "options.openExplanationHistory": "View explanation history",
      "options.openAnnotationHistory": "View annotation history",
      "options.clearAnnotations": "Clear annotation history",
      "options.annotationCount": "{history} annotation batches saved, {active} annotations pending.",
      "options.clearAnnotationsConfirm": "Delete {count} annotation batches? This cannot be undone.",
      "options.annotationsCleared": "Annotation history cleared.",
      "options.help": "Help",
      "options.reopenOnboarding": "View quick start again",
      "options.memoryInitial": "Saved 0 memories.",
      "options.loadFailed": "Load failed: {message}",
      "options.testingApi": "Testing API...",
      "options.connected": "Connected.",
      "options.connectionFailed": "Connection failed.",
      "options.providerAppliedRefresh": "Provider preset applied. You can refresh the model list.",
      "options.providerAppliedManual": "Provider preset applied. Enter the model name manually.",
      "options.modelListUnsupported": "This provider does not support automatic model listing. Enter the model name manually.",
      "options.refreshingModels": "Refreshing model list...",
      "options.refreshFailed": "Refresh failed. You can enter the model name manually.",
      "options.modelsLoaded": "Loaded {count} models. Choose one in Model or enter it manually.",
      "options.noMemories": "There are no history memories yet.",
      "options.clearConfirm": "Clear {count} history memories? This cannot be undone.",
      "options.memoriesCleared": "All history memories have been cleared.",
      "options.memoryCount": "Saved {memories} memories and {cards} answer cards.",
      "history.heading": "All History",
      "history.tabExplanations": "Explanation history",
      "history.tabAnnotations": "Annotation history",
      "history.annotationHeading": "Annotation history",
      "history.annotationSearchPlaceholder": "Page title, URL, quote, or annotation",
      "history.annotationSummary": "{batches} annotation batches with {items} annotations.",
      "history.annotationEmpty": "No matching annotations. Pending and completed batches are stored locally in your browser.",
      "history.annotationStatusInjected": "Inserted into editor",
      "history.annotationStatusCopied": "Copied",
      "history.annotationStatusPendingPaste": "Copied, waiting for paste",
      "history.annotationStatusPasted": "Pasted",
      "history.annotationStatusCollecting": "Pending",
      "history.annotationStatusInjecting": "Inserting",
      "history.annotationDeleteConfirm": "Delete this annotation batch?",
      "history.openOptions": "Settings",
      "history.toolbarLabel": "History filters",
      "history.search": "Search",
      "history.searchPlaceholder": "Saved terms, answers, websites",
      "history.filter": "Filter",
      "history.filterAll": "All",
      "history.filterCurrentPage": "Current page only",
      "history.filterCurrentSite": "Current site",
      "history.filterGlobal": "All pages",
      "history.loading": "Reading history...",
      "history.loadFailed": "Read failed: {message}",
      "history.summary": "{terms} saved terms, {answers} answers.",
      "history.empty": "No matching history explanations. Temporary explanations do not appear here until you click Save on an answer card.",
      "history.noSummary": "No answer summary yet.",
      "history.unknownSite": "Unknown site",
      "history.linkedLocations": "{count} linked locations",
      "history.answerCount": "{count} answers",
      "history.copy": "Copy",
      "history.openSource": "Open source page",
      "history.collapse": "Collapse",
      "history.expand": "Expand",
      "history.more": "More",
      "history.delete": "Delete",
      "history.excerptAnswer": "Excerpt answer",
      "history.fullAnswer": "Full answer",
      "history.noAnswer": "No answer yet.",
      "history.followup": "Follow-up",
      "history.deleteConfirm": "Delete all history answers for \"{term}\"?",
      "history.copied": "Copied.",
      "history.term": "Term: {term}",
      "history.source": "Source: {source}",
      "history.followupLabel": "Follow-up: {query}",
      "history.answerLabel": "Answer: {answer}",
      "history.unknownTime": "Unknown time",
      "content.waiting": "Waiting for an answer...",
      "content.bubbleTitle": "Click to explain, long-press to ask",
      "content.bubbleExistingTitle": "Click to view saved answers, long-press to ask",
      "content.historyHintTitle": "View saved explanations",
      "content.readyToast": "这是啥来着 has refreshed. Select text, then click the dot to explain or long-press to ask.",
      "content.savedRecordCount": "{count} saved records",
      "content.customQuestionAria": "Custom question",
      "content.askPlaceholder": "Ask something...",
      "content.send": "Send",
      "content.sendQuestion": "Send question",
      "content.sendFollowup": "Send follow-up",
      "content.annotation": "Annotate",
      "content.saveAnnotation": "Save this annotation",
      "content.annotationSaved": "{count} annotations saved. Drag them into an AI editor, or click here to review.",
      "content.annotationBasketAria": "Annotation basket with {count} annotations. Drag it into an AI editor, or click to review.",
      "content.annotationBasketLabelOne": " annotation",
      "content.annotationBasketLabelMany": " annotations",
      "content.annotationPanelTitle": "Pending annotations · {count}",
      "content.annotationEdit": "Edit",
      "content.annotationDelete": "Delete",
      "content.annotationCopyAll": "Copy all",
      "content.annotationDrop": "Drop to insert {count} annotations",
      "content.annotationInserted": "Inserted into editor",
      "content.annotationCopied": "Copied",
      "content.annotationPasteHere": "Copied. Paste it here.",
      "content.annotationPasteToAi": "Annotations copied. Paste them into the AI editor.",
      "content.annotationFallbackCopied": "Automatic insertion failed. The annotations were copied—just paste them.",
      "content.annotationFallbackFailed": "Automatic insertion and copying both failed. Open the basket to copy manually.",
      "content.annotationPasteComplete": "The matching annotations were pasted.",
      "content.annotationHistoryHint": "You can view annotation history from Settings.",
      "content.annotationNeedNote": "Write an annotation first.",
      "content.annotationTooLong": "Annotations are too long. Shorten them before sending.",
      "content.annotationLimit": "This batch has reached 50 annotations. Send or organize it first.",
      "content.annotationSelectionTooLong": "The selected text is too long (maximum 2,000 characters).",
      "content.annotationAnchorMissing": "Original location changed",
      "content.annotationCopyFailed": "Copy failed. Check browser permissions and try again.",
      "content.annotationChangedAfterCopy": "Annotations changed. Copy or drag them again.",
      "onboarding.skip": "Skip tutorial",
      "onboarding.back": "Back",
      "onboarding.next": "Next",
      "onboarding.start": "Start using",
      "onboarding.progress": "Step {current} of {total}",
      "onboarding.welcomeTitle": "Welcome to 这是啥来着",
      "onboarding.welcomeBody": "Select text on a webpage to get an explanation, ask follow-ups, save answers, and organize feedback as annotations.",
      "onboarding.modelTitle": "Connect your model service",
      "onboarding.modelBody": "Choose a provider and enter the connection details. They stay in your browser, and you can test the connection before continuing.",
      "onboarding.selectionTitle": "Select text and click the dot",
      "onboarding.selectionBody": "Select text on a regular webpage, then click the nearby dot for an immediate explanation with available page context.",
      "onboarding.customTitle": "Long-press for a custom question",
      "onboarding.customBody": "Long-press the dot to open the independent composer. After an answer arrives, use the composer below it for follow-ups.",
      "onboarding.saveTitle": "Save only what matters",
      "onboarding.saveBody": "Temporary answers are not added to history automatically. Save the full answer, or select part of it and save only that excerpt.",
      "onboarding.annotationTitle": "Add an annotation",
      "onboarding.annotationBody": "Select source text, long-press the dot, enter your note, and choose Annotate. It is saved locally without calling the model.",
      "onboarding.basketTitle": "Review and send annotations",
      "onboarding.basketBody": "Annotations wait in the lower-right basket. Click to edit or delete, or drag the basket into an AI editor; failed insertion falls back to copying.",
      "onboarding.doneTitle": "You are ready",
      "onboarding.doneBody": "Return to any regular webpage to begin. You can reopen this quick start from the Help section in Settings.",
      "content.annotationEmptyAfterDelete": "The annotation batch is empty.",
      "content.followupAria": "Continue asking",
      "content.followupPlaceholder": "Ask a follow-up about this",
      "content.followupComposerPlaceholder": "Follow up, Enter to send, Shift+Enter for newline",
      "content.close": "Close",
      "content.save": "Save",
      "content.saveExcerpt": "Save excerpt",
      "content.noSavedAnswers": "There are no saved answers yet.",
      "content.answering": "Answering",
      "content.delete": "Delete",
      "content.deleteSavedAnswer": "Delete this saved answer",
      "content.defaultQueryTitle": "Explain selected text",
      "content.expandThreadAbout": "Expand answers about \"{term}\"",
      "content.explain": "Explain",
      "content.needQuestion": "Enter a question first.",
      "content.temporaryAnswer": "This answer is temporary. Click Save to add it to history.",
      "content.noAnswerToSave": "There is no answer to save yet.",
      "content.selectAnswerFirst": "Select part of an answer first.",
      "content.excerptSaved": "Excerpt saved.",
      "content.savedToHistory": "Saved to history.",
      "content.deleteCardConfirm": "Delete this saved answer for \"{term}\"?",
      "content.recordDeleted": "This saved record has been deleted.",
      "content.threadQuestion": "Question: {query}",
      "content.threadAnswer": "Answer: {answer}",
      "content.threadFollowup": "Follow-up: {query}",
      "content.requestFailed": "Request failed.",
      "content.contextInvalidated": "The extension context expired. Refresh the page and try again.",
      "content.apiFailed": "API request failed.",
      "content.backgroundDisconnected": "The background connection was interrupted. Try again.",
      "content.retry": "Retry",
      "content.system.1": "You are the reading explanation assistant for \"这是啥来着\".",
      "content.system.2": "Answer concisely and accurately to help the user understand the selected word, sentence, or concept on the page.",
      "content.system.3": "Use English by default.",
      "content.system.4": "If page context is provided, use it first to determine the selected text's meaning in this article.",
      "content.system.5": "Only give article-specific examples when the context supports them; do not invent examples when context is insufficient.",
      "content.selectedText": "Selected text",
      "content.question": "Question",
      "content.continueAround": "Continue answering about \"{term}\": {question}",
      "content.contextTitle": "Page context",
      "content.contextBefore": "Before",
      "content.contextSelected": "Selected",
      "content.contextAfter": "After",
      "content.none": "None",
      "background.fillBaseUrl": "Enter API Base URL first.",
      "background.fillApiKey": "Enter API Key first.",
      "background.noModels": "No models were returned by this endpoint. Enter the model name manually.",
      "background.fillBaseUrlInSettings": "Enter API Base URL in 这是啥来着 settings first.",
      "background.fillApiKeyInSettings": "Enter API Key in 这是啥来着 settings first.",
      "background.fillModelInSettings": "Enter a model name in 这是啥来着 settings first.",
      "background.cancelled": "Request cancelled.",
      "background.unknownError": "Unknown error",
      "background.invalidApiKey": "API Key is invalid or unauthorized.",
      "background.modelMissing": "Model or endpoint not found: {message}",
      "background.rateLimited": "Requests are too frequent or quota is insufficient.",
      "background.networkFailed": "Network request failed. Check API Base URL or proxy."
    }
  };

  const MODEL_PROVIDERS = [
    { id: "deepseek", label: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", supportsModelList: true },
    { id: "kimi", label: "Kimi", apiBaseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k", supportsModelList: true },
    { id: "volcengine", label: "火山方舟", labelKey: "provider.volcengine", apiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "", supportsModelList: false },
    { id: "zhipu", label: "智谱 GLM", labelKey: "provider.zhipu", apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4-flash", supportsModelList: true },
    { id: "minimax", label: "MiniMax", apiBaseUrl: "https://api.minimax.chat/v1", defaultModel: "MiniMax-Text-01", supportsModelList: false },
    { id: "siliconflow", label: "硅基流动", labelKey: "provider.siliconflow", apiBaseUrl: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3", supportsModelList: true },
    { id: "openai", label: "OpenAI", apiBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4.1-mini", supportsModelList: true },
    { id: "openrouter", label: "OpenRouter", apiBaseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4.1-mini", supportsModelList: true },
    { id: "groq", label: "Groq", apiBaseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", supportsModelList: true },
    { id: "ollama", label: "本地 Ollama", labelKey: "provider.ollama", apiBaseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1", supportsModelList: true, allowEmptyApiKey: true },
    { id: "lmstudio", label: "本地 LM Studio", labelKey: "provider.lmstudio", apiBaseUrl: "http://localhost:1234/v1", defaultModel: "local-model", supportsModelList: true, allowEmptyApiKey: true },
    { id: "custom", label: "自定义 OpenAI-compatible", labelKey: "provider.custom", apiBaseUrl: "", defaultModel: "", supportsModelList: true }
  ];

  const THEME_COLORS = [
    { id: "green", label: "绿", labelKey: "color.green", value: "#6f8f7b", strong: "#466453", soft: "rgba(111, 143, 123, 0.16)", foreground: "#ffffff", border: "rgba(111, 143, 123, 0.34)", shadow: "rgba(70, 100, 83, 0.24)", rgb: "111, 143, 123" },
    { id: "orange", label: "橙", labelKey: "color.orange", value: "#c98257", strong: "#914a20", soft: "rgba(201, 130, 87, 0.16)", foreground: "#ffffff", border: "rgba(201, 130, 87, 0.34)", shadow: "rgba(145, 74, 32, 0.24)", rgb: "201, 130, 87" },
    { id: "blue", label: "蓝", labelKey: "color.blue", value: "#6f89a6", strong: "#405f82", soft: "rgba(111, 137, 166, 0.16)", foreground: "#ffffff", border: "rgba(111, 137, 166, 0.34)", shadow: "rgba(64, 95, 130, 0.24)", rgb: "111, 137, 166" },
    { id: "gray", label: "灰", labelKey: "color.gray", value: "#85837d", strong: "#55534e", soft: "rgba(133, 131, 125, 0.16)", foreground: "#ffffff", border: "rgba(133, 131, 125, 0.34)", shadow: "rgba(85, 83, 78, 0.24)", rgb: "133, 131, 125" },
    { id: "pink", label: "粉", labelKey: "color.pink", value: "#bd7f83", strong: "#884e53", soft: "rgba(189, 127, 131, 0.16)", foreground: "#ffffff", border: "rgba(189, 127, 131, 0.34)", shadow: "rgba(136, 78, 83, 0.24)", rgb: "189, 127, 131" }
  ];

  const PROMPT_TEMPLATES = [
    {
      id: "define",
      label: "定义",
      labelEn: "Define",
      prompt: "请用简洁中文解释“{{term}}”的定义，说明它常出现在哪些语境，并给出 1 个例子。",
      promptEn: "Briefly define \"{{term}}\", explain common contexts where it appears, and give one example."
    },
    {
      id: "translate",
      label: "翻译",
      labelEn: "Translate",
      prompt: "请翻译“{{term}}”。如果它是英文，请给出自然中文译法；如果它是中文，请给出英文译法，并解释语气差异。",
      promptEn: "Translate \"{{term}}\". If it is English, give a natural Chinese translation; if it is Chinese, give an English translation and explain tone differences."
    },
    {
      id: "example",
      label: "举例",
      labelEn: "Examples",
      prompt: "请围绕“{{term}}”给出 2 个简短例子：一个直观例子，一个更贴近技术或学习场景的例子。",
      promptEn: "Give two short examples for \"{{term}}\": one intuitive example and one closer to a technical or learning context."
    },
    {
      id: "summarize",
      label: "总结",
      labelEn: "Summarize",
      prompt: "请把“{{term}}”压缩成 3 个要点，帮助我快速记住它。",
      promptEn: "Summarize \"{{term}}\" into three points that make it easy to remember."
    }
  ];

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

  const DEFAULT_SETTINGS = {
    apiBaseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    modelProvider: "deepseek",
    model: "deepseek-chat",
    language: "auto",
    defaultQuestion: getDefaultQuestion("zh"),
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
    maxSelectionLength: 240,
    maxAnnotationSelectionLength: 2000,
    maxAnnotationNoteLength: 4000,
    maxAnnotationsPerBatch: 50,
    maxAnnotationPayloadLength: 60000
  };

  function normalizeTerm(term) {
    return String(term || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, LIMITS.maxTermKeyLength);
  }

  function mergeSettings(saved) {
    const source = saved || {};
    const migratedMode = source.highlightMode || migrateLegacyHighlightStyle(source.highlightStyle);
    const migratedColor = getThemePreset(source.highlightColor).value;
    const language = LANGUAGES[source.language] ? source.language : DEFAULT_SETTINGS.language;

    return {
      ...DEFAULT_SETTINGS,
      ...source,
      modelProvider: source.modelProvider || DEFAULT_SETTINGS.modelProvider,
      language,
      defaultQuestion: getDefaultQuestion(language),
      highlightColor: migratedColor,
      highlightMode: migratedMode,
      linePattern: source.linePattern || DEFAULT_SETTINGS.linePattern,
      matchWholeWord: source.matchWholeWord !== false,
      caseSensitive: Boolean(source.caseSensitive),
      includePageContext: source.includePageContext !== false,
      defaultSaveScope: SAVE_SCOPES[source.defaultSaveScope] ? source.defaultSaveScope : DEFAULT_SETTINGS.defaultSaveScope,
      defaultReminder: REMINDER_MODES[source.defaultReminder] ? source.defaultReminder : DEFAULT_SETTINGS.defaultReminder,
      hideReminders: Boolean(source.hideReminders)
    };
  }

  async function ensureStorageSchema(storageArea) {
    const area = storageArea || global.chrome?.storage?.local;
    if (!area) {
      return;
    }

    const stored = await area.get([
      STORAGE_KEYS.schemaVersion,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.memories,
      STORAGE_KEYS.annotationBatches,
      STORAGE_KEYS.activeAnnotationBatches
    ]);
    const patch = {};
    const normalizedSettings = mergeSettings(stored[STORAGE_KEYS.settings]);
    if (stored[STORAGE_KEYS.settings] && JSON.stringify(normalizedSettings) !== JSON.stringify(stored[STORAGE_KEYS.settings])) {
      patch[STORAGE_KEYS.settings] = normalizedSettings;
    }
    if (!stored[STORAGE_KEYS.memories] || typeof stored[STORAGE_KEYS.memories] !== "object") patch[STORAGE_KEYS.memories] = {};
    if (!stored[STORAGE_KEYS.annotationBatches] || typeof stored[STORAGE_KEYS.annotationBatches] !== "object") patch[STORAGE_KEYS.annotationBatches] = {};
    if (!stored[STORAGE_KEYS.activeAnnotationBatches] || typeof stored[STORAGE_KEYS.activeAnnotationBatches] !== "object") patch[STORAGE_KEYS.activeAnnotationBatches] = {};
    if (stored[STORAGE_KEYS.schemaVersion] !== CURRENT_SCHEMA_VERSION) patch[STORAGE_KEYS.schemaVersion] = CURRENT_SCHEMA_VERSION;
    if (Object.keys(patch).length) await area.set(patch);
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

  function getThemePreset(value) {
    const normalized = String(value || "").toLowerCase();
    return THEME_COLORS.find((preset) => preset.id === normalized || preset.value.toLowerCase() === normalized)
      || THEME_COLORS.find((preset) => preset.value === DEFAULT_SETTINGS.highlightColor)
      || THEME_COLORS[0];
  }

  function resolveLanguage(settingLanguage, runtimeLanguage) {
    const requested = LANGUAGES[settingLanguage] ? settingLanguage : "auto";
    if (requested !== "auto") {
      return requested;
    }

    const runtime = String(
      runtimeLanguage ||
      global.chrome?.i18n?.getUILanguage?.() ||
      global.navigator?.language ||
      ""
    ).toLowerCase();

    if (runtime.startsWith("en")) {
      return "en";
    }
    return "zh";
  }

  function getEffectiveLanguage(settings) {
    return resolveLanguage(settings?.language || DEFAULT_SETTINGS.language);
  }

  function getDefaultQuestion(language) {
    return DEFAULT_PROMPTS[resolveLanguage(language)] || DEFAULT_PROMPTS.zh;
  }

  function t(key, params, language) {
    let interpolation = params || {};
    let targetLanguage = language;
    if (typeof params === "string" && !language) {
      targetLanguage = params;
      interpolation = {};
    }
    const lang = resolveLanguage(targetLanguage);
    const template = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.zh[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(interpolation, name) ? String(interpolation[name]) : `{${name}}`
    );
  }

  function applyI18n(root, language) {
    const scope = root || global.document;
    if (!scope?.querySelectorAll) {
      return;
    }
    const lang = resolveLanguage(language);
    const doc = scope.ownerDocument || scope;

    if (doc?.documentElement) {
      doc.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    }

    scope.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n, lang);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((node) => {
      node.innerHTML = t(node.dataset.i18nHtml, lang);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder, lang));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle, lang));
    });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel, lang));
    });
    scope.querySelectorAll("[data-i18n-value]").forEach((node) => {
      node.setAttribute("value", t(node.dataset.i18nValue, lang));
    });
    const titleNode = doc?.querySelector?.("title[data-i18n]");
    if (titleNode) {
      doc.title = t(titleNode.dataset.i18n, lang);
    }
  }

  function providerLabel(provider, language) {
    return provider?.labelKey ? t(provider.labelKey, language) : provider?.label || "";
  }

  function colorLabel(color, language) {
    return color?.labelKey ? t(color.labelKey, language) : color?.label || "";
  }

  function saveScopeLabel(scope, language) {
    return t(`saveScope.${scope}`, language);
  }

  function reminderModeLabel(mode, language) {
    return t(`reminder.${mode}`, language);
  }

  function isDefaultPromptQuestion(question, term) {
    const normalized = normalizeComparablePrompt(question);
    if (!normalized) {
      return true;
    }
    const candidates = [
      ...Object.values(DEFAULT_PROMPTS),
      ...LEGACY_DEFAULT_PROMPTS
    ];
    return candidates.some((prompt) =>
      normalizeComparablePrompt(applyTerm(prompt, term)) === normalized ||
      normalizeComparablePrompt(prompt) === normalized
    );
  }

  function applyTerm(prompt, term) {
    return String(prompt || "").replaceAll("{{term}}", term || "");
  }

  function normalizeComparablePrompt(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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
    LANGUAGES,
    DEFAULT_PROMPTS,
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
    getThemePreset,
    ensureStorageSchema,
    resolveLanguage,
    getEffectiveLanguage,
    getDefaultQuestion,
    t,
    applyI18n,
    providerLabel,
    colorLabel,
    saveScopeLabel,
    reminderModeLabel,
    isDefaultPromptQuestion,
    completionUrl
  };
})(globalThis);
