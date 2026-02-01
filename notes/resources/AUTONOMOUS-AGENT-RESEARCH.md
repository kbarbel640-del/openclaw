# Исследование: Автономный AI-агент который реально думает

> Дата: 2026-01-31
> Автор: Molt (для Влада)
> Цель: построить агент который проходит путь идея→реализация самостоятельно

---

## 1. Обзор индустрии автономных coding agents

### Devin (Cognition)
**Что это:** Первый коммерческий "AI software engineer". Полная среда: shell, editor, browser.

**Архитектура цикла:**
- Interactive Planning → пользователь и Devin совместно составляют план
- Execution → работает в изолированной среде с полным доступом
- Verification → запускает тесты, проверяет в браузере
- Devin Search / Wiki → запоминает контекст проекта

**Плюсы:**
- Полная изоляция (sandbox) — безопасно
- Interactive Planning (Devin 2.0) — план редактируемый человеком
- Длительные задачи (часы работы)

**Минусы:**
- Закрытый, дорогой ($500/мес)
- При плохом scoping — делает не то
- Нет открытого API для кастомизации

**Ключевой инсайт:** Devin показал что planning должен быть **явным артефактом**, который можно редактировать. Не внутренний chain-of-thought, а документ.

---

### OpenHands (ex-OpenDevin)
**Что это:** Open-source платформа для coding agents. ICLR 2025 paper.

**Архитектура (CodeAct 2.1):**
- CodeAct architecture — LLM reasoning встроен в единый coding control plane
- Session-level project context — сохраняет контекст между шагами
- Планирование явное и пошаговое: задача → декомпозиция → шаги

**Плюсы:**
- Open source, model-agnostic
- Лучшие результаты на SWE-bench среди open source
- Можно кастомизировать агентов

**Минусы:**
- Требует инфраструктуру (Docker)
- Без fine-tuning результаты хуже коммерческих

**Ключевой инсайт:** CodeAct показал что **код = действие**. Вместо отдельных tools, агент пишет и исполняет код как основной способ взаимодействия с миром.

---

### SWE-Agent (Princeton)
**Что это:** Агент для решения GitHub issues. NeurIPS 2024.

**Архитектура:**
- Agent-Computer Interface (ACI) — специально спроектированный интерфейс
- Простой цикл: read issue → explore codebase → edit files → test
- mini-SWE-agent: 100 строк кода, 74% на SWE-bench verified

**Плюсы:**
- Минимализм (100 строк = рабочий агент!)
- Хорошо спроектированный ACI
- Воспроизводимость

**Минусы:**
- Только GitHub issues (узкий scope)
- Нет долгосрочной памяти
- Нет планирования сложных задач

**Ключевой инсайт:** **Интерфейс между агентом и средой важнее модели.** Хороший ACI = лучше результаты при том же LLM. Mini-SWE-agent доказывает что простота побеждает.

---

### Aider
**Что это:** AI pair programming в терминале. Git-native.

**Архитектура:**
- Repo map — автоматическое понимание структуры проекта
- Git integration — каждое изменение = коммит с описанием
- Edit formats — structured diffs (не полные файлы)

**Плюсы:**
- Лучшая git интеграция в индустрии
- Автоматические коммиты = легко откатить
- Работает с любым LLM
- Repo map экономит контекст

**Минусы:**
- Не автономный — требует человека в loop
- Нет планирования сложных задач
- Нет рефлексии/самопроверки

**Ключевой инсайт:** **Git как checkpoint system.** Каждое изменение коммитится → можно откатить → агент может экспериментировать безопасно. Мы уже частично это делаем.

---

### Claude Code (Anthropic)
**Что это:** Официальный CLI Anthropic для agentic coding.

**Архитектура:**
- Subagents — специализированные агенты для подзадач (параллельная работа)
- Checkpoints — git snapshots для отката
- Compaction — сжатие контекста при переполнении
- Multi-context harness (новое, 2025):
  - **Initializer agent** — настраивает среду, пишет feature list, создаёт claude-progress.txt
  - **Coding agent** — инкрементальный прогресс, один feature за раз
  - **Progress file** — мост между контекстными окнами

**Плюсы:**
- Subagents для параллельной работы
- Checkpoints для безопасности
- Anthropic's best practices для long-running agents
- CLAUDE.md для project-specific инструкций

**Минусы:**
- Привязан к Claude моделям
- Без harness склонен к one-shotting
- Compaction теряет контекст

**Ключевые инсайты из Anthropic (критически важно для нас):**

1. **Initializer + Coding agent pattern:**
   - Первая сессия: составить полный feature list (JSON, не markdown — меньше шансов что агент перепишет)
   - Каждая следующая: работать над ОДНИМ feature, коммитить, обновлять progress file

2. **claude-progress.txt:**
   - Файл-мост между контекстами
   - Что сделано, что в процессе, что следующее
   - Git history как дополнительный контекст

3. **Feature list в JSON:**
   - Каждый feature с полем `passes: false`
   - Агент может только менять `passes` на `true`
   - "It is unacceptable to remove or edit tests"

4. **Инкрементальность:**
   - Один feature за раз
   - Коммит после каждого feature
   - Чистое состояние кода после каждой сессии

5. **End-to-end тестирование:**
   - Без явного промпта агент отмечает feature как done без реальной проверки
   - Нужны browser automation tools для E2E
   - Unit тесты недостаточны

---

### Cursor (Agent Mode)
**Что это:** IDE со встроенным AI. Agent mode = автономное выполнение.

**Архитектура:**
- Понимание architectural patterns всего проекта
- Multi-file editing
- Agent mode: самостоятельная навигация и реализация

**Плюсы:**
- Лучшая IDE интеграция
- Понимает архитектурные паттерны
- Быстрый для повседневных задач

**Минусы:**
- Нет долгосрочной памяти между сессиями
- Слабее в complex interconnected codebases
- Закрытый

---

### Cline / Roo Code
**Что это:** VSCode extensions для autonomous coding.

**Архитектура:**
- Cline: "100% focused on building the best agent"
- Human-in-the-loop одобрение каждого действия (можно отключить)
- Proactive debugging — сам находит проблемы

**Плюсы:**
- Open source (Cline)
- Proactive debugging
- Глубокое понимание проекта

**Минусы:**
- VSCode-only
- Слабая память между сессиями

---

### Сводная таблица

| Агент | Планирование | Исполнение | Проверка | Рефлексия | Память |
|-------|-------------|-----------|---------|-----------|--------|
| Devin | ✅ Interactive plan | ✅ Sandbox | ✅ Tests + Browser | ⚠️ Частичная | ✅ Wiki/Search |
| OpenHands | ✅ Пошаговое | ✅ Docker | ✅ Tests | ❌ | ❌ |
| SWE-Agent | ⚠️ Implicit | ✅ ACI | ✅ Tests | ❌ | ❌ |
| Aider | ❌ | ✅ Git-native | ⚠️ Manual | ❌ | ❌ |
| Claude Code | ✅ Feature list | ✅ Subagents | ✅ E2E | ⚠️ Progress file | ⚠️ CLAUDE.md |
| Cursor | ⚠️ Implicit | ✅ IDE | ⚠️ Manual | ❌ | ❌ |
| Cline | ⚠️ Implicit | ✅ VSCode | ✅ Proactive | ❌ | ❌ |

**Вывод:** Ни один агент не имеет полного цикла plan→execute→verify→reflect→learn. Это наша возможность.

---

## 2. Механизм сомнения (Self-Doubt / Verification)

### Что говорит наука

**Reflexion (Shinn et al., 2023):**
- Агент получает feedback → генерирует verbal reflection → сохраняет в memory → использует в следующей попытке
- НЕ обновляет веса модели — только текстовые "записки самому себе"
- Результат: значительное улучшение на coding задачах
- **Применение для нас:** после каждого этапа агент пишет reflection: "Что я сделал, что пошло не так, что учесть в следующий раз"

**Chain-of-Verification (CoVe):**
1. Агент генерирует ответ
2. Составляет список verification questions
3. Отвечает на каждый вопрос независимо
4. Ревизит оригинальный ответ с учётом проверки
- **Применение:** после написания кода агент спрашивает себя: "Покрывает ли это edge cases? Соответствует ли требованиям? Нет ли регрессий?"

**Self-Verification prompting:**
- Backward verification: проверить вывод подставив результат обратно в условие
- **Применение:** написал feature → проверяет что feature requirements выполнены, проходя по каждому пункту

**Трёхслойная верификация (Galileo):**
1. Internal consistency checks во время генерации
2. RAG-based проверка против knowledge base
3. External validation (тесты, human review)

### Практическая реализация для нашего агента

```
VERIFICATION_PROTOCOL:
  after_planning:
    - "Покрывает ли план все требования из задачи?"
    - "Нет ли конфликтов между шагами?"
    - "Какие risks я вижу?"
    confidence_threshold: 0.8
    if_below: ask_user_for_clarification

  after_each_step:
    - "Что конкретно изменилось? (git diff)"
    - "Соответствует ли изменение плану?"
    - "Не сломал ли я что-то существующее?"
    - "Могу ли я доказать что это работает?"
    confidence_threshold: 0.7
    if_below: rollback_and_retry OR ask_user

  after_completion:
    - "Все ли requirements выполнены? (чеклист)"
    - "Прошли ли все тесты?"
    - "E2E проверка: работает ли как пользователь ожидает?"
    - "Что я мог пропустить?"
    confidence_threshold: 0.9
    if_below: additional_testing OR flag_for_review
```

### Как отличить "додумал" от "попросили"

Конкретные правила:
1. **Source tracking:** каждое решение помечается источником — `[USER]`, `[INFERRED]`, `[DEFAULT]`
2. **Explicit > Implicit:** если пользователь не указал стек — спросить, не выбирать за него
3. **Confidence tagging:** `[HIGH]` = пользователь явно сказал, `[MEDIUM]` = логически следует из контекста, `[LOW]` = моё предположение
4. **Low confidence = ask:** всё что `[LOW]` — уточнить у пользователя

---

## 3. Память ошибок (Learning from Mistakes)

### Что работает в индустрии

**Reflexion memory:**
- Текстовые записи: "В задаче X я сделал ошибку Y потому что Z. В будущем нужно W."
- Хранится в sliding window (последние N reflections)
- Вставляется в промпт перед каждой попыткой

**Voyager (NVIDIA) — skill library:**
- Каждый успешный навык сохраняется как code snippet + описание
- Перед новой задачей → semantic search по библиотеке навыков
- Переиспользование вместо изобретения заново

### Архитектура памяти для нашего агента

```
memory/
├── learnings/
│   ├── global.md          # Общие ошибки (уже есть!)
│   ├── {project}.md       # Проектные ошибки (уже есть!)
│   └── patterns.md        # NEW: паттерны решений
├── reflections/
│   ├── YYYY-MM-DD-{task}.md  # NEW: рефлексия по задаче
│   └── index.json            # NEW: индекс для поиска
└── skills/
    ├── {skill-name}.md    # NEW: успешные навыки/рецепты
    └── index.json         # NEW: индекс для поиска
```

### Формат записи ошибки (улучшенный)

```markdown
## [2026-01-31] Ошибка: не проверил edge case в парсере

**Контекст:** Писал парсер TOML конфига
**Что произошло:** Не обработал пустые строки → crash при запуске
**Почему:** Не написал тест на edge cases до кода
**Урок:** ВСЕГДА писать edge case тесты до/параллельно с кодом
**Применимость:** Любой парсинг/валидация ввода
**Триггеры:** [parsing, validation, input, config]
```

### Как использовать перед каждым действием

```
PRE-ACTION MEMORY CHECK:
1. Определить тип задачи (tags)
2. Semantic search по learnings с этими tags
3. Если найдены релевантные ошибки → вставить в контекст
4. Конкретно: "В прошлый раз при [подобной задаче] я допустил [ошибку]. Сейчас я учту это."
```

### RAG для памяти — простая реализация

Не нужен vector DB на старте. Достаточно:
1. **Tags/triggers** в каждой записи (уже в примере выше)
2. **Grep-based search** по тегам — O(n) но для сотен записей мгновенно
3. **Позже:** embeddings (Voyage API — уже есть ключ!) для semantic search
4. **Ещё позже:** автоматическая категоризация новых ошибок

---

## 4. Промпт-инжиниринг для sub-агентов

### Best practices от Anthropic (из их документации)

1. **"Tell Claude to keep going until all tests pass"** — не останавливаться на первой попытке
2. **"Verify with independent subagents"** — отдельный агент проверяет что implementation не overfitting к тестам
3. **Structured prompts > free-form** для конкретных задач

### Шаблон промпта для Claude Code sub-агента

```markdown
## Task
[Одно предложение: что сделать]

## Context
- Project: [название, стек]
- Current state: [что уже есть]
- Related files: [конкретные пути]

## Requirements
1. [Конкретное требование]
2. [Конкретное требование]
...

## Constraints
- DO NOT: [что нельзя делать]
- Style: [код стиль, конвенции]
- Tests: [какие тесты нужны]

## Past Learnings (auto-injected)
- [Релевантная ошибка из памяти]

## Verification
After implementation:
1. Run [specific test command]
2. Check [specific behavior]
3. Ensure no regressions in [area]

## Output
- Commit changes with descriptive message
- Update progress in [file]
```

### Ключевые правила

1. **Конкретность > абстракция:** "Добавь эндпоинт GET /api/users который возвращает JSON с полями id, name, email" >> "Сделай API для пользователей"

2. **Контекст без потерь:**
   - Всегда указывать конкретные файлы (пути)
   - Включать relevant code snippets если короткие
   - Указывать используемые библиотеки и версии

3. **Negative constraints критичны:**
   - "НЕ меняй файл X"
   - "НЕ добавляй новых зависимостей"
   - "НЕ рефактори существующий код, только добавь новое"

4. **Verification в промпте:**
   - Конкретные команды для тестирования
   - Expected output
   - "Не отмечай как done пока не проверишь E2E"

---

## 5. Оптимальный алгоритм: от идеи до реализации

### THE LOOP — 12 шагов автономного агента

```
┌─────────────────────────────────────────────────────┐
│                    THE LOOP v1                        │
│     Autonomous Agent Workflow for Moltbot             │
└─────────────────────────────────────────────────────┘

PHASE 1: UNDERSTAND (Понимание)
═══════════════════════════════

Step 1: RECEIVE — Приём задачи
  Input: сообщение от Влада (текст/голос)
  Actions:
    - Парсить intent: что хочет? (feature/fix/refactor/research)
    - Определить project scope
  Output: raw_task

Step 2: CLARIFY — Уточнение (max 3 вопроса)
  Input: raw_task
  Actions:
    - Определить что неясно: стек? дизайн? приоритеты?
    - Сформулировать КОНКРЕТНЫЕ вопросы (не общие)
    - Source tracking: пометить [USER] vs [INFERRED]
  Rules:
    - Мелкие задачи (< 30 мин) — 0-1 вопрос
    - Средние (1-4 часа) — 1-2 вопроса
    - Большие (> 4 часов) — 2-3 вопроса
    - НИКОГДА не спрашивать то, что можно узнать из кода
  Output: clarified_task

Step 3: RESEARCH — Исследование контекста
  Input: clarified_task
  Actions:
    - Прочитать memory/learnings/{project}.md
    - Прочитать memory/learnings/global.md
    - Прочитать project ROADMAP/progress если есть
    - Semantic search по reflections (если есть)
    - Изучить текущий код и архитектуру
    - Web search если нужна внешняя информация
  Output: context_bundle {task, learnings, current_state, constraints}


PHASE 2: PLAN (Планирование)
═════════════════════════════

Step 4: DECOMPOSE — Разбивка на features
  Input: context_bundle
  Actions:
    - Разбить задачу на atomic features
    - Каждый feature: описание + acceptance criteria + test plan
    - Оценить сложность каждого (S/M/L)
    - Определить порядок (dependencies)
  Output: feature_list.json

Step 5: PLAN — Составление плана
  Input: feature_list.json
  Actions:
    - Для каждого feature: конкретные шаги реализации
    - Определить какие файлы создать/изменить
    - Определить архитектурные решения
    - Risk assessment: что может пойти не так?
  Verification (self-doubt checkpoint #1):
    - "Покрывает ли план ВСЕ requirements?"
    - "Нет ли конфликтов между шагами?"
    - "Учёл ли я learnings из памяти?"
    - Confidence < 0.8 → пересмотреть или спросить Влада
  Output: execution_plan

Step 6: APPROVE — Одобрение (для средних/больших задач)
  Input: execution_plan
  Actions:
    - Показать план Владу (кратко, не портянка)
    - Мелкие задачи — скипнуть этот шаг
    - Ждать одобрения или корректировки
  Output: approved_plan


PHASE 3: EXECUTE (Исполнение)
═════════════════════════════

Step 7: IMPLEMENT — Исполнение по одному feature
  Input: approved_plan, current_feature
  Actions:
    FOR EACH feature in feature_list:
      a) Сформировать промпт для Claude Code (шаблон из секции 4)
      b) Inject relevant learnings в промпт
      c) Запустить Claude Code (exec pty+background)
      d) Мониторить прогресс (process:log каждые 30-60 сек)
      e) Корректировать если пошёл не туда
      f) После завершения → Step 8
  Rules:
    - ОДИН feature за раз (не пытаться всё сразу)
    - Git commit после каждого feature
    - Стрим прогресса Владу ("Делаю шаг 3/7: API endpoints")
  Output: implemented_feature

Step 8: VERIFY — Проверка каждого feature
  Input: implemented_feature
  Actions:
    a) git diff — что изменилось?
    b) Grep на заглушки: TODO, pass, placeholder, NotImplemented
    c) Запустить тесты (unit + integration)
    d) E2E проверка (если applicable)
    e) Проверить acceptance criteria из feature_list
  Verification (self-doubt checkpoint #2):
    - "Соответствует ли результат плану?"
    - "Прошли ли ВСЕ тесты?"
    - "Нет ли регрессий?"
    - "Работает ли E2E?"
    - Confidence < 0.7 → rollback + retry (max 3 attempts)
    - После 3 failed attempts → flag for user
  Output: verified_feature {status: pass|fail, notes}


PHASE 4: REFLECT (Рефлексия)
═════════════════════════════

Step 9: REFLECT — Рефлексия по feature
  Input: verified_feature
  Actions:
    - Что пошло хорошо?
    - Что пошло не так? (если были retries)
    - Что я бы сделал иначе?
    - Есть ли learning для будущего?
  Output: feature_reflection (сохранить если значимая)

Step 10: UPDATE PROGRESS — Обновление состояния
  Input: feature_reflection
  Actions:
    - Обновить feature_list.json (passes: true)
    - Обновить progress file
    - Git commit с описательным сообщением
    - Если есть learning → записать в memory/learnings/
  Output: updated_state
  GOTO: Step 7 (следующий feature) OR Step 11 (если все features done)


PHASE 5: DELIVER (Доставка)
═══════════════════════════

Step 11: FINAL VERIFICATION — Финальная проверка
  Input: all features implemented
  Actions:
    - Полный test suite
    - E2E smoke test
    - Проверка всех acceptance criteria
    - Code review (grep для code smells)
    - Lint/format
  Verification (self-doubt checkpoint #3):
    - "Всё ли из задачи реализовано?"
    - "Нет ли забытых TODO?"
    - "Готово ли к production?"
    - Confidence < 0.9 → дополнительная проверка
  Output: final_report

Step 12: DELIVER + LEARN — Доставка и обучение
  Input: final_report
  Actions:
    - Отчёт Владу: что сделано, что решили, что учесть
    - Записать значимые learnings в memory/
    - Записать reflection по всей задаче
    - Обновить project roadmap/progress
  Output: delivered_task + updated_memory
```

### Визуализация потока

```
USER → [Receive] → [Clarify] → [Research] → [Decompose] → [Plan] → [Approve]
                                                                        │
         ┌──────────────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────┐    ┌────────┐    ┌─────────┐    ┌────────┐
    │Implement├───►│ Verify ├───►│ Reflect ├───►│Progress│
    │Feature N│    │        │    │         │    │Update  │
    └─────────┘    └───┬────┘    └─────────┘    └───┬────┘
         ▲             │                             │
         │             │ FAIL (max 3)                │ MORE FEATURES
         │             ▼                             │
         │        [Rollback]                         │
         │        [Retry]                            │
         └───────────────────────────────────────────┘
                                                     │ ALL DONE
                                                     ▼
                                              [Final Verify]
                                                     │
                                                     ▼
                                             [Deliver + Learn]
```

---

## 6. Что можно реализовать ПРЯМО СЕЙЧАС

### Уже есть (наши активы)
| Компонент | Где | Статус |
|-----------|-----|--------|
| PREFLIGHT.md | корень | ✅ Работает |
| DEV_WORKFLOW.md | notes/resources/ | ✅ 9 шагов |
| memory/learnings/ | memory/ | ✅ Используется |
| Claude Code exec | moltbot | ✅ pty+background |
| Git integration | moltbot | ✅ Коммиты, диффы |

### Что добавить за 1 день

1. **feature_list.json template** — шаблон для декомпозиции задач
   - JSON формат (не markdown) — Anthropic рекомендует
   - Поля: category, description, steps, passes, confidence

2. **progress.txt convention** — файл-мост между сессиями
   - Создавать в начале каждой большой задачи
   - Обновлять после каждого feature

3. **Улучшенный формат learnings** — добавить триггеры/теги
   - К существующим файлам добавить `**Триггеры:** [tag1, tag2]`
   - Grep-based поиск по тегам перед каждой задачей

4. **Verification checklist в DEV_WORKFLOW** — конкретные вопросы self-doubt
   - Добавить 3 checkpoint-а из алгоритма выше

### Что добавить за 1 неделю

5. **Structured prompt template** для Claude Code sub-агентов
   - Файл `notes/resources/SUBAGENT_PROMPT_TEMPLATE.md`
   - Автоматическая инъекция learnings

6. **Reflection format** — файл рефлексии после каждой значимой задачи
   - `memory/reflections/YYYY-MM-DD-{task}.md`
   - Автоматически предлагать запись после completion

7. **Source tracking** в планах — `[USER]` / `[INFERRED]` / `[DEFAULT]`

---

## 7. Roadmap реализации

### Phase 1: Foundation (неделя 1-2)
**Цель: внедрить THE LOOP в текущий workflow**

- [ ] Обновить DEV_WORKFLOW.md на THE LOOP v1
- [ ] Создать `notes/resources/SUBAGENT_PROMPT_TEMPLATE.md`
- [ ] Добавить теги к существующим learnings
- [ ] Добавить 3 self-doubt checkpoint-а
- [ ] Начать вести progress.txt для больших задач
- [ ] Feature list в JSON для проектов

### Phase 2: Memory (неделя 3-4)
**Цель: агент учится на ошибках**

- [ ] Структура `memory/reflections/`
- [ ] Автоматический pre-action memory check (grep по тегам)
- [ ] Reflection template после каждой задачи
- [ ] `memory/learnings/patterns.md` — паттерны решений

### Phase 3: Verification (неделя 5-6)
**Цель: агент реально проверяет свою работу**

- [ ] Confidence scoring для каждого этапа
- [ ] Автоматический rollback при низком confidence
- [ ] E2E verification prompts
- [ ] Independent verification subagent (отдельный агент проверяет)

### Phase 4: Semantic Memory (месяц 2)
**Цель: умный поиск по памяти**

- [ ] Embeddings через Voyage API для learnings
- [ ] Semantic search вместо grep
- [ ] Автоматическая категоризация новых записей
- [ ] Skills library (успешные рецепты)

### Phase 5: Full Autonomy (месяц 3+)
**Цель: агент работает часами без вмешательства**

- [ ] Multi-context harness (initializer + coding agent pattern)
- [ ] Parallel subagents для независимых features
- [ ] Automatic retry with reflection
- [ ] Self-improving prompts (агент улучшает свои промпты на основе результатов)

---

## 8. Ключевые принципы (TL;DR)

1. **Инкрементальность:** один feature за раз, коммит после каждого
2. **Явное планирование:** план = артефакт (JSON), не мысли в голове
3. **Self-doubt встроен:** 3 checkpoint-а с конкретными вопросами
4. **Память работает:** теги → поиск → инъекция в контекст
5. **Git = safety net:** каждое изменение коммитится, можно откатить
6. **Простота сначала:** grep > vector DB, JSON > database, файлы > сервисы
7. **Progress file:** мост между контекстами и сессиями
8. **Source tracking:** знать что сказал пользователь, а что додумал агент
9. **E2E verification:** unit тесты ≠ "работает", нужна реальная проверка
10. **Reflections:** записывать и переиспользовать, не повторять ошибки
