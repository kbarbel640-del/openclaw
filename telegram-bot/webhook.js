// OpenClaw Telegram Bot - Full Featured
import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.19.2/mod.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new Bot(BOT_TOKEN);

// Groq модели
const GROQ_MODELS = {
  "llama-3.3-70b": "🦙 Llama 3.3 70B (Самая умная)",
  "llama-3.1-70b": "🦙 Llama 3.1 70B (Быстрая)",
  "llama-3.1-8b": "⚡ Llama 3.1 8B (Очень быстрая)",
  "mixtral-8x7b": "🔀 Mixtral 8x7B",
  "gemma2-9b": "💎 Gemma 2 9B"
};

// Хранилище выбранной модели для каждого пользователя
const userModels = new Map();

// Установка команд в меню
await bot.api.setMyCommands([
  { command: "start", description: "🏠 Главное меню" },
  { command: "model", description: "🤖 Выбрать AI модель" },
  { command: "search", description: "🔍 Поиск через MCP" },
  { command: "help", description: "❓ Помощь" }
]);

// Главное меню
function getMainMenu() {
  return new InlineKeyboard()
    .text("🤖 Выбрать AI модель", "select_model")
    .text("🔍 Поиск", "action_search").row()
    .text("📰 Новости", "action_news")
    .text("💻 GitHub", "action_github").row()
    .text("🌐 Web Search", "action_web")
    .text("❓ Помощь", "action_help");
}

// Меню выбора модели
function getModelMenu() {
  const keyboard = new InlineKeyboard();

  for (const [model, name] of Object.entries(GROQ_MODELS)) {
    keyboard.text(name, `model_${model}`).row();
  }

  keyboard.text("« Назад в меню", "back_to_menu");
  return keyboard;
}

// /start
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  const currentModel = userModels.get(userId) || "llama-3.1-8b";

  await ctx.reply(
    `🦞 *Привет! Я OpenClaw AI-ассистент*\n\n` +
    `Текущая модель: ${GROQ_MODELS[currentModel]}\n\n` +
    `Выберите действие:`,
    { 
      reply_markup: getMainMenu(),
      parse_mode: "Markdown"
    }
  );
});

// /model
bot.command("model", async (ctx) => {
  await ctx.reply(
    "🤖 *Выберите AI модель:*\n\n" +
    "Разные модели имеют разные характеристики:\n" +
    "• 70B - самые умные, но медленнее\n" +
    "• 8B - очень быстрые\n" +
    "• Mixtral - хороший баланс",
    {
      reply_markup: getModelMenu(),
      parse_mode: "Markdown"
    }
  );
});

// /search
bot.command("search", async (ctx) => {
  await ctx.reply(
    "🔍 *Поиск через MCP*\n\n" +
    "Введите ваш поисковый запрос, и я найду информацию через Composio MCP.",
    { parse_mode: "Markdown" }
  );
});

// /help
bot.command("help", async (ctx) => {
  await ctx.reply(
    `📖 *Помощь по OpenClaw Bot*\n\n` +
    `*Доступные команды:*\n` +
    `/start - Главное меню\n` +
    `/model - Выбрать AI модель\n` +
    `/search - Поиск информации\n` +
    `/help - Эта справка\n\n` +
    `*Возможности:*\n` +
    `🤖 Выбор из 5 моделей Groq\n` +
    `🔍 Поиск через Composio MCP\n` +
    `📰 Получение новостей\n` +
    `💻 Работа с GitHub\n` +
    `🌐 Поиск в интернете\n\n` +
    `Просто напишите мне сообщение!`,
    { parse_mode: "Markdown" }
  );
});

// Обработка callback queries
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from?.id;

  await ctx.answerCallbackQuery();

  // Выбор модели
  if (data.startsWith("model_")) {
    const model = data.replace("model_", "");
    userModels.set(userId, model);

    await ctx.editMessageText(
      `✅ *Модель выбрана:*\n${GROQ_MODELS[model]}\n\n` +
      `Теперь все запросы будут обрабатываться этой моделью.`,
      {
        reply_markup: new InlineKeyboard().text("« Назад в меню", "back_to_menu"),
        parse_mode: "Markdown"
      }
    );
    return;
  }

  // Действия
  switch (data) {
    case "select_model":
      await ctx.editMessageText(
        "🤖 *Выберите AI модель:*\n\n" +
        "Разные модели имеют разные характеристики:\n" +
        "• 70B - самые умные, но медленнее\n" +
        "• 8B - очень быстрые\n" +
        "• Mixtral - хороший баланс",
        {
          reply_markup: getModelMenu(),
          parse_mode: "Markdown"
        }
      );
      break;

    case "action_search":
      await ctx.editMessageText(
        "🔍 *Поиск через MCP*\n\n" +
        "Введите ваш поисковый запрос:",
        { parse_mode: "Markdown" }
      );
      break;

    case "action_news":
      await ctx.editMessageText("📰 Получаю последние новости...", {});

      try {
        const news = await searchWithMCP("latest technology news");
        const model = userModels.get(userId) || "llama-3.1-8b";
        const summary = await askGroq(model, `Summarize these news in Russian:\n${news}`);

        await ctx.editMessageText(
          `📰 *Последние новости:*\n\n${summary}`,
          {
            reply_markup: new InlineKeyboard().text("« Назад", "back_to_menu"),
            parse_mode: "Markdown"
          }
        );
      } catch (error) {
        await ctx.editMessageText(
          `❌ Ошибка: ${error.message}`,
          {
            reply_markup: new InlineKeyboard().text("« Назад", "back_to_menu")
          }
        );
      }
      break;

    case "action_github":
      const githubMenu = new InlineKeyboard()
        .text("🔍 Поиск репозиториев", "github_search")
        .text("⭐ Trending", "github_trending").row()
        .text("« Назад", "back_to_menu");

      await ctx.editMessageText(
        "💻 *GitHub*\n\nВыберите действие:",
        {
          reply_markup: githubMenu,
          parse_mode: "Markdown"
        }
      );
      break;

    case "github_search":
      await ctx.editMessageText(
        "💻 *Поиск GitHub репозиториев*\n\n" +
        "Введите название репозитория или технологию:",
        { parse_mode: "Markdown" }
      );
      break;

    case "github_trending":
      await ctx.editMessageText("⭐ Получаю trending репозитории...", {});

      try {
        const trending = await searchWithMCP("github trending repositories");
        const model = userModels.get(userId) || "llama-3.1-8b";
        const summary = await askGroq(model, `List top 5 trending GitHub repos from this data in Russian:\n${trending}`);

        await ctx.editMessageText(
          `⭐ *Trending на GitHub:*\n\n${summary}`,
          {
            reply_markup: new InlineKeyboard().text("« Назад", "back_to_menu"),
            parse_mode: "Markdown"
          }
        );
      } catch (error) {
        await ctx.editMessageText(
          `❌ Ошибка: ${error.message}`,
          {
            reply_markup: new InlineKeyboard().text("« Назад", "back_to_menu")
          }
        );
      }
      break;

    case "action_web":
      await ctx.editMessageText(
        "🌐 *Web Search*\n\n" +
        "Введите поисковый запрос для поиска в интернете:",
        { parse_mode: "Markdown" }
      );
      break;

    case "action_help":
      await ctx.editMessageText(
        `📖 *Помощь*\n\n` +
        `*Возможности бота:*\n` +
        `🤖 5 моделей Groq AI\n` +
        `🔍 Поиск через MCP\n` +
        `📰 Новости\n` +
        `💻 GitHub интеграция\n` +
        `🌐 Web поиск\n\n` +
        `Просто пишите - я отвечу!`,
        {
          reply_markup: new InlineKeyboard().text("« Назад", "back_to_menu"),
          parse_mode: "Markdown"
        }
      );
      break;

    case "back_to_menu":
      const currentModel = userModels.get(userId) || "llama-3.1-8b";
      await ctx.editMessageText(
        `🦞 *OpenClaw AI-ассистент*\n\n` +
        `Модель: ${GROQ_MODELS[currentModel]}\n\n` +
        `Выберите действие:`,
        {
          reply_markup: getMainMenu(),
          parse_mode: "Markdown"
        }
      );
      break;
  }
});

// Обработка текстовых сообщений
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from?.id;

  if (text.startsWith("/")) return;

  const thinkingMsg = await ctx.reply("🤔 Думаю...");

  try {
    const model = userModels.get(userId) || "llama-3.1-8b";

    // Сначала пробуем поиск через MCP
    let context = "";
    try {
      context = await searchWithMCP(text);
    } catch (e) {
      console.log("MCP search failed:", e);
    }

    // Генерируем ответ через Groq
    const prompt = context 
      ? `Context from search:\n${context}\n\nUser question: ${text}\n\nAnswer in Russian based on the context:`
      : `Answer this question in Russian: ${text}`;

    const response = await askGroq(model, prompt);

    // Удаляем "думаю" сообщение
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);

    // Отправляем ответ с кнопкой меню
    await ctx.reply(response, {
      reply_markup: new InlineKeyboard().text("🏠 Главное меню", "back_to_menu"),
      parse_mode: "Markdown"
    });

  } catch (error) {
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
    await ctx.reply(
      `❌ *Ошибка:* ${error.message}`,
      {
        reply_markup: new InlineKeyboard().text("🏠 Главное меню", "back_to_menu"),
        parse_mode: "Markdown"
      }
    );
  }
});

// Функция для запроса к Groq
async function askGroq(model, prompt) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant. Always respond in Russian unless asked otherwise."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "Нет ответа";
}

// Функция для поиска через MCP (Composio)
async function searchWithMCP(query) {
  if (!COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY not configured");
  }

  try {
    const response = await fetch("https://backend.composio.dev/api/v1/actions/SEARCHTOOL_SEARCH_CONTENT/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": COMPOSIO_API_KEY
      },
      body: JSON.stringify({
        input: {
          query: query,
          num_results: 5
        },
        appName: "searchtool"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Извлекаем результаты поиска
    const results = data.results || data.data?.results || [];

    if (results.length === 0) {
      return "No results found";
    }

    // Форматируем результаты
    return results.map((r, i) => 
      `${i+1}. ${r.title || r.name || "Result"}\n${r.description || r.snippet || ""}`
    ).join("\n\n");

  } catch (error) {
    console.error("MCP search error:", error);
    throw error;
  }
}

// Error handler
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Webhook handler
export default webhookCallback(bot, "std/http");
