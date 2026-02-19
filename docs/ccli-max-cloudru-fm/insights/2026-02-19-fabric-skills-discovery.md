# AI Fabric skills не обнаруживаются Claude CLI

**Дата:** 2026-02-19
**Компонент:** `src/ai-fabric/generate-fabric-skills.ts`, `src/ai-fabric/sync-fabric-resources.ts`

## Симптомы

- `openclaw fabric sync` генерирует SKILL.md файлы, но `openclaw skills list` не показывает их
- `.claude/commands/fabric-*.md` не создаются
- При этом файлы физически присутствуют на диске в `~/.openclaw/workspace/skills/`

## Суть проблемы

Три отдельные ошибки, каждая из которых блокировала обнаружение skills:

### 1. Двойная вложенность директорий

`loadSkillsFromDir()` из `@mariozechner/pi-coding-agent` ожидает структуру `skills/<skill-name>/SKILL.md`. Sync orchestrator генерировал skills в `skills/ai-fabric/<skill-name>/SKILL.md` — лишний уровень вложенности `ai-fabric/` делал skills невидимыми для загрузчика.

### 2. Sync marker перед frontmatter

Генератор ставил `<!-- openclaw-synced -->` **перед** YAML frontmatter (`---`). Парсер frontmatter требует `---` на первой строке файла. Из-за маркера перед ним frontmatter не парсился, и skill не получал `name`, `description`, `metadata` — загрузчик его игнорировал.

### 3. A2A timeout 30 секунд для agent systems

Agent systems координируют несколько агентов и при cold start могут не уложиться в дефолтный timeout 30 секунд (`CLOUDRU_DEFAULT_TIMEOUT_MS`). Пользователь получал "did not respond within the timeout", хотя система была RUNNING и endpoint был корректный.

## Решение

1. **Убрали `ai-fabric/`** из пути генерации: `path.join(workspaceDir, "skills")` вместо `path.join(workspaceDir, "skills", "ai-fabric")`

2. **Переместили sync marker после frontmatter:**

   ```markdown
   ---
   name: fabric-weather-agent
   description: Cloud.ru AI Fabric Agent
   ---

   <!-- openclaw-synced -->
   ```

   Также заменили `content.startsWith(SYNC_MARKER)` на `content.includes(SYNC_MARKER)` в логике очистки stale skills.

3. **Увеличили A2A timeout до 120 секунд** в `CloudruA2AClient` при вызове из ask-agent и fabric-ask.

## Ключевые файлы

- `src/ai-fabric/generate-fabric-skills.ts` — порядок marker/frontmatter, `includes()` вместо `startsWith()`
- `src/ai-fabric/sync-fabric-resources.ts` — убрана вложенность `ai-fabric/` в пути skills
- `extensions/ask-agent/index.ts` — timeout 120s
- `src/commands/fabric-ask.ts` — timeout 120s
- `src/agents/skills/workspace.ts` — референс: как `loadSkillsFromDir` обнаруживает skills (строка 126: `workspaceSkillsDir = path.resolve(workspaceDir, "skills")`)
