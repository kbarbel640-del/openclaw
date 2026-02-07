const { Bot, InlineKeyboard, webhookCallback } = require("grammy");

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

const MODELS = {
  "llama-3.3-70b-versatile": "🦙 Llama 3.3 70B",
  "llama-3.1-8b-instant": "⚡ Llama 3.1 8B",
  "mixtral-8x7b-32768": "🔀 Mixtral 8x7B"
};

const userModels = new Map();

const mainMenu = () => new InlineKeyboard()
  .text("🤖 Модель", "models")
  .text("🔍 Поиск", "search").row()
  .text("📰 Новости", "news")
  .text("❓ Помощь", "help");

const modelsMenu = () => {
  const kb = new InlineKeyboard();
  for (const [id, name] of Object.entries(MODELS)) {
    kb.text(name, `set_${id}`).row();
  }
  kb.text("« Назад", "menu");
  return kb;
};

bot.api.setMyCommands([
  { command: "start", description: "🏠 Главное меню" },
  { command: "help", description: "❓ Помощь" }
]).catch(() => {});

bot.command("start", async (ctx) => {
  await ctx.reply("🦞 *OpenClaw AI Bot*\n\nВыберите действие:", 
    { reply_markup: mainMenu(), parse_mode: "Markdown" });
});

bot.command("help", async (ctx) => {
  await ctx.reply("📖 *Помощь*\n\n• /start - Главное меню\n• Выберите модель AI\n• Пишите вопросы - я отвечу!", 
    { parse_mode: "Markdown" });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  await ctx.answerCallbackQuery();
  
  if (data.startsWith("set_")) {
    const model = data.replace("set_", "");
    userModels.set(userId, model);
    await ctx.editMessageText(`✅ Выбрана: ${MODELS[model]}`, 
      { reply_markup: new InlineKeyboard().text("« Меню", "menu"), parse_mode: "Markdown" });
    return;
  }
  
  switch (data) {
    case "menu":
      await ctx.editMessageText("🦞 *OpenClaw AI Bot*\n\nВыберите действие:", 
        { reply_markup: mainMenu(), parse_mode: "Markdown" });
      break;
    case "models":
      await ctx.editMessageText("🤖 *Выберите модель:*", 
        { reply_markup: modelsMenu(), parse_mode: "Markdown" });
      break;
    case "search":
      await ctx.editMessageText("🔍 Введите ваш запрос:");
      break;
    case "news":
      await ctx.editMessageText("📰 Загружаю новости...");
      try {
        const model = userModels.get(userId) || "llama-3.1-8b-instant";
        const response = await askGroq(model, "Кратко расскажи главные новости в мире технологий сегодня на русском");
        await ctx.editMessageText(`📰 *Новости:*\n\n${response}`, 
          { reply_markup: new InlineKeyboard().text("« Меню", "menu"), parse_mode: "Markdown" });
      } catch (e) {
        await ctx.editMessageText(`❌ Ошибка: ${e.message}`);
      }
      break;
    case "help":
      await ctx.editMessageText("📖 *Помощь*\n\n1. Выберите модель AI\n2. Пишите вопросы\n3. Получайте ответы!", 
        { reply_markup: new InlineKeyboard().text("« Меню", "menu"), parse_mode: "Markdown" });
      break;
  }
});

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;
  const userId = ctx.from.id;
  const model = userModels.get(userId) || "llama-3.1-8b-instant";
  const thinking = await ctx.reply("🤔 Думаю...");
  try {
    const answer = await askGroq(model, ctx.message.text);
    await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    await ctx.reply(answer, { reply_markup: new InlineKeyboard().text("🏠 Меню", "menu") });
  } catch (e) {
    await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    await ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

async function askGroq(model, prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY не установлен");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "Ты helpful AI assistant. Отвечай кратко на русском." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!res.ok) throw new Error(`Groq API: ${res.status}`);
  const data = await res.json();
  return data.choices[0]?.message?.content || "Нет ответа";
}

bot.catch((err) => { console.error("Bot error:", err); });

module.exports = webhookCallback(bot, "std/http");