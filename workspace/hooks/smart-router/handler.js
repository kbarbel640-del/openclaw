// Smart Router Hook - 智能模型路由
//
// 监听事件：model:select
// 动作：根据 context 长度/任务类型选择最适合的模型

// 模型能力定义
const MODEL_PROFILES = {
  'anthropic/claude-opus-4-5': {
    contextWindow: 200000,
    strengths: ['code', 'reasoning', 'complex'],
    cost: 'high'
  },
  'deepseek/deepseek-chat': {
    contextWindow: 128000,
    strengths: ['chat', 'translation', 'simple'],
    cost: 'low'
  },
  'deepseek/deepseek-reasoner': {
    contextWindow: 128000,
    strengths: ['reasoning', 'math', 'complex'],
    cost: 'medium'
  },
  'zai/glm-4.7': {
    contextWindow: 128000,
    strengths: ['chat', 'chinese', 'simple'],
    cost: 'low'
  }
};

// 任务类型 -> 推荐模型
const TASK_MODEL_MAP = {
  'code': 'anthropic/claude-opus-4-5',
  'reasoning': 'anthropic/claude-opus-4-5',
  'complex': 'anthropic/claude-opus-4-5',
  'chat': 'deepseek/deepseek-chat',
  'translation': 'deepseek/deepseek-chat',
  'simple': 'deepseek/deepseek-chat',
  'chinese': 'zai/glm-4.7',
  'math': 'deepseek/deepseek-reasoner'
};

// Context 长度阈值
const CONTEXT_THRESHOLDS = {
  SHORT: 4000,      // 短 context，用便宜模型
  MEDIUM: 32000,    // 中等 context，按任务选
  LONG: 64000       // 长 context，用大模型
};

/**
 * 根据 context 长度选择模型
 */
function selectByContextLength(contextLength, candidates) {
  if (!contextLength || contextLength <= 0) {
    return null;
  }

  // 长 context 优先大模型
  if (contextLength > CONTEXT_THRESHOLDS.LONG) {
    const claude = candidates.find(c =>
      c.provider === 'anthropic' && c.model.includes('claude')
    );
    if (claude) {
      return `${claude.provider}/${claude.model}`;
    }
  }

  // 短 context 用便宜模型
  if (contextLength < CONTEXT_THRESHOLDS.SHORT) {
    const cheap = candidates.find(c =>
      MODEL_PROFILES[`${c.provider}/${c.model}`]?.cost === 'low'
    );
    if (cheap) {
      return `${cheap.provider}/${cheap.model}`;
    }
  }

  return null;
}

/**
 * 根据任务类型选择模型
 */
function selectByTaskHint(taskHint, candidates) {
  if (!taskHint) {
    return null;
  }

  const hint = taskHint.toLowerCase();
  const recommendedModel = TASK_MODEL_MAP[hint];

  if (recommendedModel) {
    const [provider, model] = recommendedModel.split('/');
    const found = candidates.find(c =>
      c.provider === provider && c.model === model
    );
    if (found) {
      return recommendedModel;
    }
  }

  return null;
}

/**
 * Internal Hook Handler for model:select events
 *
 * @param {Object} event - Internal hook event
 * @param {string} event.type - "model"
 * @param {string} event.action - "select"
 * @param {Object} event.context - Selection context
 * @returns {Object|undefined} - Optional result with overrideModel/prependCandidates
 */
async function handler(event) {
  // 只处理 model:select 事件
  if (event.type !== 'model' || event.action !== 'select') {
    return;
  }

  const {
    requestedProvider,
    requestedModel,
    candidates,
    strategy,
    sessionKey,
    agentId,
    contextLength,
    taskHint
  } = event.context;

  // 如果已经指定了特定模型（非默认），不干预
  if (requestedModel && !requestedModel.includes('claude-opus-4-5')) {
    // 用户明确指定了非默认模型，尊重用户选择
    return;
  }

  // 优先按任务类型选择
  let selectedModel = selectByTaskHint(taskHint, candidates);

  // 其次按 context 长度选择
  if (!selectedModel) {
    selectedModel = selectByContextLength(contextLength, candidates);
  }

  // 如果选择的模型和当前首选不同，返回覆盖
  if (selectedModel) {
    const currentFirst = candidates[0];
    const currentKey = `${currentFirst?.provider}/${currentFirst?.model}`;

    if (selectedModel !== currentKey) {
      console.log(`[smart-router] Routing: ${currentKey} -> ${selectedModel} (task: ${taskHint || 'none'}, context: ${contextLength || 'unknown'})`);
      return {
        overrideModel: selectedModel
      };
    }
  }

  // 不干预
  return;
}

export default handler;
