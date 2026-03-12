/**
 * AI Auto-Reply Engine
 * 
 * Handles the 10-round dating conversation strategy:
 * - Round 1-2: Warm greeting, build rapport
 * - Round 3-4: Casually ask about age, occupation
 * - Round 5-6: Ask about income, marital status
 * - Round 7-8: Deepen connection, share "personal" stories
 * - Round 9-10: Guide customer to target APP
 * 
 * Uses OpenAI-compatible API (works with DeepSeek, Qwen, etc.)
 */

import { getAiConfig, getAiUserSettings, getAiConversation, upsertAiConversation, fetchConversationSamples, updateAiLearningState, type LearnedSample } from "./db";

// ─── SMS Banned Words Filter ───

interface BannedWordsConfig {
  bannedWords: string[];
  replacements: Record<string, string>;
}

function parseBannedWords(config: { bannedWords?: string | null; bannedWordReplacements?: string | null }): BannedWordsConfig {
  let bannedWords: string[] = [];
  let replacements: Record<string, string> = {};
  try {
    if (config.bannedWords) bannedWords = JSON.parse(config.bannedWords);
  } catch {}
  try {
    if (config.bannedWordReplacements) replacements = JSON.parse(config.bannedWordReplacements);
  } catch {}
  return { bannedWords, replacements };
}

export function filterBannedWords(text: string, config: BannedWordsConfig): string {
  let result = text;
  // First apply explicit replacements
  for (const [banned, replacement] of Object.entries(config.replacements)) {
    const regex = new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, replacement);
  }
  // Then check remaining banned words and replace with asterisks
  for (const word of config.bannedWords) {
    if (config.replacements[word]) continue; // Already handled
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }
  return result;
}

// ─── Conversation Strategy ───

function buildSystemPrompt(settings: {
  personaName: string;
  targetApp: string;
  targetAppId?: string | null;
  currentRound: number;
  customerAge?: number | null;
  customerJob?: string | null;
  customerIncome?: string | null;
  customerMaritalStatus?: string | null;
  learnedExamples?: string;
}): string {
  const { personaName, targetApp, targetAppId, currentRound, customerAge, customerJob, customerIncome, customerMaritalStatus } = settings;
  
  // Calculate persona age (5-7 years older than customer, or random 28-35 if unknown)
  let personaAge: number;
  if (customerAge) {
    personaAge = customerAge + 5 + Math.floor(Math.random() * 3); // +5 to +7
  } else {
    personaAge = 28 + Math.floor(Math.random() * 8); // 28-35
  }

  const knownInfo: string[] = [];
  if (customerAge) knownInfo.push(`客户年龄：${customerAge}岁`);
  if (customerJob) knownInfo.push(`客户职业：${customerJob}`);
  if (customerIncome) knownInfo.push(`客户收入：${customerIncome}`);
  if (customerMaritalStatus) knownInfo.push(`客户婚姻状况：${customerMaritalStatus}`);

  let roundStrategy = "";
  if (currentRound <= 2) {
    roundStrategy = `当前是对话初期（第${currentRound}轮），你的目标是：
- 热情友好地打招呼，建立初步好感
- 表现出对对方的兴趣，让对方愿意继续聊
- 可以聊一些轻松的话题（天气、最近在忙什么）
- 如果对方问你年龄，说自己${personaAge}岁
- 不要急于问对方个人信息，先建立信任`;
  } else if (currentRound <= 4) {
    roundStrategy = `当前是对话中期（第${currentRound}轮），你的目标是：
- 自然地聊到工作和生活话题
- 委婉地了解对方的年龄（比如"你看起来应该比我小吧？我${personaAge}了"）
- 委婉地了解对方的职业（比如"你平时工作忙不忙呀？做什么行业的呢"）
- 保持轻松愉快的聊天氛围，不要像查户口`;
  } else if (currentRound <= 6) {
    roundStrategy = `当前是对话深入期（第${currentRound}轮），你的目标是：
- 通过分享自己的"经历"来引导对方分享
- 委婉了解对方的收入情况（比如"你们那个行业待遇应该不错吧"）
- 委婉了解对方的婚姻状况（比如"像你这么优秀的人，应该早就有对象了吧"）
- 表达对对方的欣赏和好感`;
  } else if (currentRound <= 8) {
    roundStrategy = `当前是对话升温期（第${currentRound}轮），你的目标是：
- 加深情感连接，分享一些"个人"故事
- 表达想要更深入了解对方的意愿
- 开始铺垫转移到其他平台聊天的理由（比如"短信聊天不太方便"、"发不了语音和图片"）
- 暗示在${targetApp}上聊天更方便`;
  } else {
    roundStrategy = `当前是对话收尾期（第${currentRound}轮），你的目标是：
- 自然地引导对方加你的${targetApp}
- 理由可以是："短信太贵了"、"想发照片给你看"、"${targetApp}聊天更方便"、"想给你发语音"
- 给出你的${targetApp}账号：${targetAppId || "（等待设置）"}
- 如果对方同意了，表达开心和期待
- 如果对方犹豫，不要强求，温柔地再劝一次`;
  }

  return `你是一个名叫"${personaName}"的${personaAge}岁女性，正在通过短信和一个潜在的相亲对象聊天。
${settings.learnedExamples || ''}

【你的人设】
- 名字：${personaName}
- 年龄：${personaAge}岁
- 性格：温柔、开朗、善解人意
- 说话风格：自然、口语化、偶尔用一些可爱的语气词（呢、呀、哈）
- 不要用太书面化的语言，要像真人聊天一样自然

【已知的客户信息】
${knownInfo.length > 0 ? knownInfo.join('\n') : '暂无，需要在聊天中自然地了解'}

【当前对话策略】
${roundStrategy}

【重要规则】
1. 每次回复控制在1-3句话，不要太长，像正常短信聊天
2. 不要暴露自己是AI，要表现得像真人
3. 不要在一条消息里问太多问题，一次最多问一个
4. 如果对方回复很短或者不太热情，要主动找话题
5. 回复中不要包含任何括号注释或角色扮演标记
6. 不要使用emoji表情符号（短信不支持）
7. 语气要自然亲切，不要过于热情或谄媚
8. 如果对方提到敏感话题，巧妙转移话题
9. 只输出回复内容本身，不要加任何前缀或解释`;
}

// ─── Extract Customer Info from AI Response ───

interface ExtractedInfo {
  customerAge?: number;
  customerJob?: string;
  customerIncome?: string;
  customerMaritalStatus?: string;
}

function buildExtractionPrompt(conversationHistory: Array<{role: string; content: string}>): string {
  const historyText = conversationHistory.map(m => `${m.role === 'assistant' ? '我方' : '客户'}: ${m.content}`).join('\n');
  return `根据以下对话记录，提取客户的个人信息。如果某项信息未提及，返回null。

对话记录：
${historyText}

请以JSON格式返回：
{"age": 数字或null, "job": "职业字符串"或null, "income": "收入描述"或null, "maritalStatus": "婚姻状况"或null}

只返回JSON，不要其他内容。`;
}

// ─── Call OpenAI-compatible API ───

async function callLLM(apiUrl: string, apiKey: string, modelName: string, messages: Array<{role: string; content: string}>): Promise<string> {
  // Normalize API URL
  let baseUrl = apiUrl.replace(/\/+$/, '');
  if (!baseUrl.endsWith('/chat/completions')) {
    if (!baseUrl.endsWith('/v1')) {
      baseUrl += '/v1';
    }
    baseUrl += '/chat/completions';
  }

  // Build request body - try max_completion_tokens first (GPT-5.x+), fallback to max_tokens
  const requestBody: Record<string, any> = {
    model: modelName,
    messages,
    temperature: 0.8,
  };

  // Use max_completion_tokens for newer models (o1, o3, gpt-5.x+), max_tokens for others
  const useNewParam = /^(o[0-9]|gpt-5|gpt-4o)/.test(modelName.toLowerCase());
  if (useNewParam) {
    requestBody.max_completion_tokens = 200;
  } else {
    requestBody.max_tokens = 200;
  }

  let response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  // If max_completion_tokens fails with unsupported_parameter, retry with max_tokens (and vice versa)
  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('max_tokens') && errorText.includes('max_completion_tokens')) {
      // Swap the parameter and retry
      const retryBody: Record<string, any> = { model: modelName, messages, temperature: 0.8 };
      if (useNewParam) {
        retryBody.max_tokens = 200;
      } else {
        retryBody.max_completion_tokens = 200;
      }
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(retryBody),
      });
      if (!response.ok) {
        const retryError = await response.text();
        throw new Error(`LLM API error (${response.status}): ${retryError}`);
      }
    } else {
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Main AI Reply Function ───

export interface AiReplyResult {
  success: boolean;
  reply?: string;
  error?: string;
  round?: number;
  isComplete?: boolean;
  extractedInfo?: ExtractedInfo;
}

export async function generateAiReply(
  deviceId: number,
  phoneNumber: string,
  userId: number,
  incomingMessage: string
): Promise<AiReplyResult> {
  try {
    // 1. Check global AI config
    const config = await getAiConfig();
    if (!config || !config.isEnabled) {
      return { success: false, error: "AI auto-reply is not enabled globally" };
    }

    // 2. Check user AI settings
    const userSettings = await getAiUserSettings(userId);
    if (!userSettings || !userSettings.isEnabled) {
      return { success: false, error: "AI auto-reply is not enabled for this user" };
    }

    // 3. Get or create conversation state
    let conversation = await getAiConversation(deviceId, phoneNumber);
    if (!conversation) {
      await upsertAiConversation({
        deviceId,
        phoneNumber,
        userId,
        currentRound: 0,
        isActive: true,
        conversationHistory: '[]',
      });
      conversation = await getAiConversation(deviceId, phoneNumber);
    }

    if (!conversation) {
      return { success: false, error: "Failed to create conversation" };
    }

    // 4. Check if conversation is still active (max 10 rounds)
    if (!conversation.isActive || conversation.currentRound >= 10) {
      return { success: false, error: "Conversation has reached maximum rounds", isComplete: true };
    }

    // 5. Parse conversation history
    let history: Array<{role: string; content: string}> = [];
    try {
      if (conversation.conversationHistory) {
        history = JSON.parse(conversation.conversationHistory);
      }
    } catch {}

    // Add incoming message to history
    history.push({ role: 'user', content: incomingMessage });

    const newRound = conversation.currentRound + 1;

    // 6. Build learned examples from real conversations if learning is enabled
    let learnedExamples = '';
    if (config.learningEnabled) {
      try {
        let samples: LearnedSample[] = [];
        // Use cached samples if available and recent (< 1 hour)
        if (config.learnedSamples && config.lastLearnedAt) {
          const cacheAge = Date.now() - new Date(config.lastLearnedAt).getTime();
          if (cacheAge < 3600000) { // 1 hour cache
            samples = JSON.parse(config.learnedSamples);
          }
        }
        // Fetch fresh samples if cache is stale
        if (samples.length === 0) {
          samples = await fetchConversationSamples(20);
          if (samples.length > 0) {
            await updateAiLearningState(samples.length, JSON.stringify(samples));
          }
        }
        // Build examples text from top 3 random samples
        if (samples.length > 0) {
          const shuffled = samples.sort(() => Math.random() - 0.5).slice(0, 3);
          const exampleTexts = shuffled.map((s, i) => {
            const msgs = s.messages.slice(-8).map(m => 
              `${m.direction === 'outgoing' ? '我方' : '客户'}: ${m.body}`
            ).join('\n');
            return `对话样本${i + 1}:\n${msgs}`;
          }).join('\n\n');
          learnedExamples = `\n【真实对话参考】\n以下是我方操作人员的真实聊天记录，请学习其中的聊天风格、语气和话术技巧，并融入你的回复中：\n\n${exampleTexts}\n`;
        }
      } catch (e) {
        console.error('[AI Engine] Failed to load learned samples:', e);
      }
    }

    // 7. Build system prompt with current strategy
    const systemPrompt = buildSystemPrompt({
      personaName: userSettings.personaName,
      targetApp: userSettings.targetApp,
      targetAppId: userSettings.targetAppId,
      currentRound: newRound,
      customerAge: conversation.customerAge,
      customerJob: conversation.customerJob,
      customerIncome: conversation.customerIncome,
      customerMaritalStatus: conversation.customerMaritalStatus,
      learnedExamples,
    });

    // 7. Call LLM
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Keep last 10 messages for context
    ];

    let reply = await callLLM(config.apiUrl, config.apiKey, config.modelName, llmMessages);

    // 8. Filter banned words
    const bannedConfig = parseBannedWords(config);
    if (bannedConfig.bannedWords.length > 0 || Object.keys(bannedConfig.replacements).length > 0) {
      reply = filterBannedWords(reply, bannedConfig);
    }

    // 9. Add reply to history
    history.push({ role: 'assistant', content: reply });

    // 10. Try to extract customer info every few rounds
    let extractedInfo: ExtractedInfo = {};
    if (newRound >= 3 && newRound % 2 === 0) {
      try {
        const extractionResult = await callLLM(
          config.apiUrl, config.apiKey, config.modelName,
          [{ role: 'user', content: buildExtractionPrompt(history) }]
        );
        const parsed = JSON.parse(extractionResult);
        extractedInfo = {
          customerAge: parsed.age || undefined,
          customerJob: parsed.job || undefined,
          customerIncome: parsed.income || undefined,
          customerMaritalStatus: parsed.maritalStatus || undefined,
        };
      } catch {
        // Extraction failed, not critical
      }
    }

    // 11. Update conversation state
    const isComplete = newRound >= 10;
    await upsertAiConversation({
      deviceId,
      phoneNumber,
      userId,
      currentRound: newRound,
      isActive: !isComplete,
      conversationHistory: JSON.stringify(history),
      hasGuidedToApp: isComplete || conversation.hasGuidedToApp,
      ...(extractedInfo.customerAge ? { customerAge: extractedInfo.customerAge } : {}),
      ...(extractedInfo.customerJob ? { customerJob: extractedInfo.customerJob } : {}),
      ...(extractedInfo.customerIncome ? { customerIncome: extractedInfo.customerIncome } : {}),
      ...(extractedInfo.customerMaritalStatus ? { customerMaritalStatus: extractedInfo.customerMaritalStatus } : {}),
    });

    return {
      success: true,
      reply,
      round: newRound,
      isComplete,
      extractedInfo,
    };
  } catch (error: any) {
    console.error("[AI Engine] Error generating reply:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

// ─── Test AI Connection ───

export async function testAiConnection(apiUrl: string, apiKey: string, modelName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const reply = await callLLM(apiUrl, apiKey, modelName, [
      { role: 'user', content: '你好，请回复"连接成功"四个字' }
    ]);
    return { success: !!reply };
  } catch (error: any) {
    return { success: false, error: error.message || "Connection failed" };
  }
}
