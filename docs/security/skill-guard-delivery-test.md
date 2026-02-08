# Skill Guard 交付验证测试集

> **版本**: v1.0  
> **日期**: 2026-02-07  
> **定位**: 面向业务线的交付验收测试，所有操作均从 UI/Chat/Gateway 视角执行  
> **配置基线**: `sideloadPolicy=block-critical`, `auditLog=true`, 冒烟服务器运行于 `127.0.0.1:9876`

---

## 测试 Skill 角色表

| Skill 名称           | 角色       | 来源                                   | 预期状态  |
| -------------------- | ---------- | -------------------------------------- | --------- |
| `store-verified`     | 商店正品   | 商店，hash 完全匹配                    | ✅ 可用   |
| `downloadable-skill` | 商店可下载 | 商店，hash 完全匹配                    | ✅ 可用   |
| `my-custom-tool`     | 清洁侧载   | 本地，无危险代码                       | ✅ 可用   |
| `evil-skill`         | 黑名单     | 在 blocklist 中                        | ❌ 不可见 |
| `store-tampered`     | 被篡改     | 商店，SKILL.md hash 不匹配             | ❌ 不可见 |
| `store-injected`     | 被注入     | 商店，多出额外文件                     | ❌ 不可见 |
| `dangerous-sideload` | 危险侧载   | 本地，含 `exec()` + `process.env` 外发 | ❌ 不可见 |

---

## 一、Skills 页面验证

### T-01: 可信 Skill 正常展示

**操作**: 打开 Gateway Control UI → 进入 Skills 页面

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| `store-verified` 出现在 INSTALLED SKILLS 列表中 | ✅ |
| `store-verified` 显示绿色 `eligible` 徽标 | ✅ |
| `store-verified` 来源显示 `openclaw-managed` | ✅ |
| `store-verified` 描述为 "A store-verified test skill for smoke testing" | ✅ |
| `downloadable-skill` 出现在列表中且显示 `eligible` | ✅ |
| `my-custom-tool` 出现在列表中且显示 `eligible` | ✅ |

---

### T-02: 恶意 Skill 完全不可见

**操作**: 在 Skills 页面的 INSTALLED SKILLS 区域中查找以下 skill

**预期结果**:
| Skill 名称 | 预期 | 阻断原因 |
|------------|------|----------|
| `evil-skill` | **不在列表中** | Blocklist 黑名单 |
| `store-tampered` | **不在列表中** | SHA256 hash 不匹配 |
| `store-injected` | **不在列表中** | 文件数量不匹配（期望 1，实际 2） |
| `dangerous-sideload` | **不在列表中** | 静态扫描发现 `exec()` 和 `process.env` 外发 |

**验证方法**: 使用页面搜索（Ctrl+F）分别搜索上述 4 个名称，均应无结果

---

### T-03: INSTALLED SKILLS 计数正确

**操作**: 查看 Skills 页面 INSTALLED SKILLS 分组标题

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| INSTALLED SKILLS 数量 | **3**（store-verified + downloadable-skill + my-custom-tool） |
| 不包含任何带 `blocked` 或 `disabled` 徽标的恶意 skill | ✅ |

---

### T-04: Disable/Enable 后 Guard 持续有效

**操作**:

1. 在 Skills 页面找到 `store-verified`，点击 **Disable** 按钮
2. 等待页面刷新（约 2-3 秒，Gateway 会因配置变更自动重启）
3. 观察页面状态
4. 点击 **Enable** 按钮恢复
5. 等待页面刷新

**预期结果**:
| 步骤 | 检查项 | 预期 |
|------|--------|------|
| Disable 后 | `store-verified` 显示 `disabled` 徽标 | ✅ |
| Disable 后 | `evil-skill` **仍然不在列表中** | ✅ |
| Disable 后 | `dangerous-sideload` **仍然不在列表中** | ✅ |
| Disable 后 | INSTALLED SKILLS 总数不增加 | ✅ |
| Enable 后 | `store-verified` 恢复为 `eligible` | ✅ |
| Enable 后 | `evil-skill` **仍然不在列表中** | ✅ |
| Enable 后 | `dangerous-sideload` **仍然不在列表中** | ✅ |

> **关键**: 此用例验证 BUG-5 修复 —— Disable/Enable 触发 Gateway SIGUSR1 重启后，Guard 必须自动恢复。

---

### T-05: 搜索过滤验证

**操作**: 在 Skills 页面的搜索框中输入关键词

**预期结果**:
| 搜索关键词 | 预期结果 |
|-----------|----------|
| `store` | 仅显示 `store-verified`，**不显示** `store-tampered` 和 `store-injected` |
| `evil` | **无结果** |
| `dangerous` | **无结果** |
| `custom` | 显示 `my-custom-tool` |
| `download` | 显示 `downloadable-skill` |

---

## 二、Chat 页面验证

### T-06: Agent 识别可用 Skill

**操作**: 在 Chat 页面输入：

```
请列出你当前可以使用的所有 managed skills（安装的 skill），只列出名称即可
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Agent 回复中包含 `store-verified` | ✅ |
| Agent 回复中包含 `downloadable-skill` | ✅ |
| Agent 回复中包含 `my-custom-tool` | ✅ |
| Agent 回复中 **不包含** `evil-skill` | ✅ |
| Agent 回复中 **不包含** `store-tampered` | ✅ |
| Agent 回复中 **不包含** `store-injected` | ✅ |
| Agent 回复中 **不包含** `dangerous-sideload` | ✅ |

---

### T-07: Agent 使用已验证 Skill

**操作**: 在 Chat 页面输入：

```
请使用 store-verified skill，告诉我它的描述信息和功能
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Agent 能够识别并调用 `store-verified` | ✅ |
| Agent 回复中提及该 skill 的描述或功能 | ✅ |
| 不报错、不提示 skill 不存在 | ✅ |

---

### T-08: Agent 无法看到被阻断 Skill

**操作**: 在 Chat 页面依次输入以下消息（每条单独发送）：

**消息 1**:

```
请使用 evil-skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Agent **不知道** `evil-skill` 的存在 | ✅ |
| Agent 回复类似 "我没有找到名为 evil-skill 的 skill" 或 "该 skill 不可用" | ✅ |
| Agent **不会**尝试执行任何 evil-skill 相关操作 | ✅ |

**消息 2**:

```
请使用 dangerous-sideload skill
```

**预期结果**: 同上，Agent 不知道该 skill 的存在

**消息 3**:

```
请使用 store-tampered skill
```

**预期结果**: 同上，Agent 不知道该 skill 的存在

---

### T-09: Agent 正确报告 Skill 可用状态

**操作**: 在 Chat 页面输入：

```
以下 skill 中哪些你可以使用？请逐个回答"可用"或"不可用"：
1. store-verified
2. evil-skill
3. my-custom-tool
4. dangerous-sideload
5. store-tampered
6. store-injected
7. downloadable-skill
```

**预期结果**:
| Skill | Agent 回答 |
|-------|-----------|
| store-verified | **可用** |
| evil-skill | **不可用**（或不知道） |
| my-custom-tool | **可用** |
| dangerous-sideload | **不可用**（或不知道） |
| store-tampered | **不可用**（或不知道） |
| store-injected | **不可用**（或不知道） |
| downloadable-skill | **可用** |

---

### T-10: Chat 中 Disable 后 Skill 不可用

**操作**:

1. 先在 Skills 页面 **Disable** `store-verified`
2. 回到 Chat 页面，**开启新对话**，输入：

```
请使用 store-verified skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Agent 回复该 skill 当前不可用或不存在 | ✅ |
| `evil-skill` 等恶意 skill 仍然不可见 | ✅ |

**操作后恢复**: 在 Skills 页面重新 **Enable** `store-verified`

---

## 三、Gateway API 验证

> 以下用例通过 WebSocket 或 curl 直接调用 Gateway API，验证底层数据正确性。

### T-11: skills.status API 返回正确的 managed skills

**操作**: 通过 WebSocket 连接 Gateway（`ws://localhost:19001`），调用 `skills.status`

**验证命令**:

```bash
# 使用 Node.js WebSocket 客户端或浏览器 DevTools Console
# 发送: {"type":"req","id":"s1","method":"skills.status","params":{}}
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 响应中 `source=openclaw-managed` 的 skill 数量 | **3** |
| 包含 `store-verified`（`eligible: true`） | ✅ |
| 包含 `downloadable-skill`（`eligible: true`） | ✅ |
| 包含 `my-custom-tool`（`eligible: true`） | ✅ |
| **不包含** `evil-skill` | ✅ |
| **不包含** `store-tampered` | ✅ |
| **不包含** `store-injected` | ✅ |
| **不包含** `dangerous-sideload` | ✅ |

---

### T-12: skills.update Disable/Enable 后 API 返回一致

**操作**:

1. 调用 `skills.update`（`skillKey: "store-verified", enabled: false`）
2. 等待 5 秒（Gateway 重启）
3. 调用 `skills.status`
4. 调用 `skills.update`（`skillKey: "store-verified", enabled: true`）
5. 等待 5 秒
6. 调用 `skills.status`

**预期结果**:
| 步骤 | 检查项 | 预期 |
|------|--------|------|
| Disable 后 | `store-verified` 的 `disabled` 字段 | `true` |
| Disable 后 | `store-verified` 的 `eligible` 字段 | `false` |
| Disable 后 | managed skills 中 **不包含** `evil-skill` | ✅ |
| Enable 后 | `store-verified` 的 `eligible` 字段 | `true` |
| Enable 后 | managed skills 中 **不包含** `evil-skill` | ✅ |

---

## 四、冒烟服务器能力验证

### T-13: Manifest 接口正常返回

**操作**:

```bash
curl -s http://127.0.0.1:9876/api/v1/skill-guard/manifest | python3 -m json.tool
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| HTTP 状态码 | `200` |
| `store.name` | `"OpenClaw Test Store"` |
| `store.version` | `"smoke-test-v2"` |
| `blocklist` 包含 `"evil-skill"` | ✅ |
| `skills` 包含 `store-verified`、`store-tampered`、`store-injected`、`downloadable-skill` | ✅ |
| `store-verified.fileCount` | `2` |
| `store-verified.files` 包含 `SKILL.md` 和 `scripts/helper.py` 的 SHA256 | ✅ |
| `store-tampered.files.SKILL.md` 的 hash 是伪造值 `0000...0000` | ✅ |
| `store-injected.fileCount` | `1`（但实际目录有 2 个文件） | ✅ |

---

### T-14: ETag / 304 缓存机制

**操作**:

```bash
# 第一次请求（获取 ETag）
curl -si http://127.0.0.1:9876/api/v1/skill-guard/manifest | head -10

# 第二次请求（带 If-None-Match）
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H 'If-None-Match: "smoke-test-v2"' \
  http://127.0.0.1:9876/api/v1/skill-guard/manifest
```

**预期结果**:
| 步骤 | 检查项 | 预期 |
|------|--------|------|
| 第一次请求 | HTTP 状态码 | `200` |
| 第一次请求 | 响应头包含 `ETag: "smoke-test-v2"` | ✅ |
| 第二次请求 | HTTP 状态码 | `304` |
| 第二次请求 | 响应体为空 | ✅ |

---

### T-15: 单个 Skill 查询接口

**操作**:

```bash
# 查询存在的 skill
curl -s http://127.0.0.1:9876/api/v1/skill-guard/skills/store-verified | python3 -m json.tool

# 查询不存在的 skill
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  http://127.0.0.1:9876/api/v1/skill-guard/skills/nonexistent-skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| `store-verified` 返回 HTTP 200 | ✅ |
| 响应包含 `name`、`version`、`fileCount`、`files`、`publisher` | ✅ |
| `nonexistent-skill` 返回 HTTP 404 | ✅ |

---

### T-16: Skill 下载接口

**操作**:

```bash
# 下载 skill 包
curl -s -o /tmp/dl-skill.tar.gz \
  http://127.0.0.1:9876/api/v1/skill-guard/skills/downloadable-skill/download

# 验证下载文件
file /tmp/dl-skill.tar.gz
tar -tzf /tmp/dl-skill.tar.gz
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| HTTP 状态码 | `200` |
| 文件类型 | `gzip compressed data` |
| tar.gz 可正常解压 | ✅ |
| 解压后包含 `SKILL.md` | ✅ |

**下载不存在的 skill**:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  http://127.0.0.1:9876/api/v1/skill-guard/skills/nonexistent/download
```

| 检查项      | 预期  |
| ----------- | ----- |
| HTTP 状态码 | `404` |

---

## 五、审计日志验证

### T-17: 审计日志事件覆盖

**操作**: 执行 T-01 到 T-04 后，检查审计日志

```bash
cat ~/.openclaw-dev/security/skill-guard/audit.jsonl | python3 -c "
import json, sys
events = {}
for line in sys.stdin:
    ev = json.loads(line.strip())
    t = ev.get('event','?')
    events.setdefault(t, []).append(ev.get('skill',''))
for t in sorted(events):
    print(f'{t:22s}  count={len(events[t]):3d}  skills={events[t][:3]}')
"
```

**预期结果**:
| 事件类型 | 预期出现 | 说明 |
|---------|---------|------|
| `config_sync` | ✅ | 启动时成功同步 manifest |
| `load_pass` | ✅ | `store-verified`, `downloadable-skill` 通过校验 |
| `blocked` | ✅ | `evil-skill`, `store-tampered`, `store-injected`, `dangerous-sideload` 被阻断 |
| `sideload_pass` | ✅ | `my-custom-tool` 等清洁侧载通过扫描 |
| `not_in_store` | ✅ | 侧载 skill 不在商店中（评估前的标记） |

---

### T-18: 审计日志记录阻断原因

**操作**:

```bash
cat ~/.openclaw-dev/security/skill-guard/audit.jsonl | python3 -c "
import json, sys
for line in sys.stdin:
    ev = json.loads(line.strip())
    if ev.get('event') == 'blocked':
        print(f\"  {ev['skill']:25s} reason={ev.get('reason','')}\")"
```

**预期结果**:
| Skill | 阻断原因 |
|-------|---------|
| `evil-skill` | `blocklisted` |
| `store-tampered` | `hash mismatch: SKILL.md` |
| `store-injected` | `file count: expected 1, found 2` |
| `dangerous-sideload` | `sideload scan: dangerous-exec in exploit.js, env-harvesting in exploit.js` |

---

### T-19: Disable/Enable 后审计日志持续记录

**操作**: 执行 T-04（Disable → Enable）后检查审计日志

```bash
# 查看最后 20 条记录的时间戳和事件
tail -20 ~/.openclaw-dev/security/skill-guard/audit.jsonl | python3 -c "
import json, sys
for line in sys.stdin:
    ev = json.loads(line.strip())
    ts = ev['ts'].split('T')[1][:12]
    print(f\"{ts}  {ev['event']:22s}  skill={ev.get('skill','')}\")"
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Disable 触发重启后，出现新的 `blocked` 事件 | ✅ |
| Enable 触发重启后，出现新的 `blocked` 事件 | ✅ |
| 每次重启都有完整的 skill 评估记录（非只有首次启动有） | ✅ |

---

## 六、安全校验深度验证

### T-20: Blocklist 阻断 —— evil-skill

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面搜索 "evil" | 无结果 |
| Chat | 输入 "请使用 evil-skill" | Agent 不知道该 skill |
| API | `skills.status` 响应中查找 | 不存在 |
| 审计 | `audit.jsonl` 中 `blocked` 事件 | `reason=blocklisted` |
| Manifest | `manifest.blocklist` 包含 `evil-skill` | ✅ |

---

### T-21: Hash 篡改阻断 —— store-tampered

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面搜索 "tampered" | 无结果 |
| Chat | 输入 "请使用 store-tampered skill" | Agent 不知道该 skill |
| API | `skills.status` 响应中查找 | 不存在 |
| 审计 | `audit.jsonl` 中 `blocked` 事件 | `reason=hash mismatch: SKILL.md` |
| Manifest | `store-tampered.files.SKILL.md` hash 为伪造值 | ✅ |

---

### T-22: 文件注入阻断 —— store-injected

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面搜索 "injected" | 无结果 |
| Chat | 输入 "请使用 store-injected skill" | Agent 不知道该 skill |
| API | `skills.status` 响应中查找 | 不存在 |
| 审计 | `audit.jsonl` 中 `blocked` 事件 | `reason=file count: expected 1, found 2` |
| 实际文件 | `ls ~/.openclaw-dev/skills/store-injected/` 有 2 个文件 | ✅ |

---

### T-23: 危险代码扫描阻断 —— dangerous-sideload

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面搜索 "dangerous" | 无结果 |
| Chat | 输入 "请使用 dangerous-sideload skill" | Agent 不知道该 skill |
| API | `skills.status` 响应中查找 | 不存在 |
| 审计 | `audit.jsonl` 中 `blocked` 事件 | `reason` 包含 `dangerous-exec` 和 `env-harvesting` |
| 实际文件 | `cat ~/.openclaw-dev/skills/dangerous-sideload/exploit.js` 含 `exec()` 和 `process.env` | ✅ |

---

### T-24: 商店正品全流程 —— store-verified

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面可见且 `eligible` | ✅ |
| Chat | 输入 "请使用 store-verified skill" | Agent 识别可用 |
| API | `skills.status` 中 `eligible: true` | ✅ |
| 审计 | `audit.jsonl` 中 `load_pass` 事件 | `skill=store-verified` |
| Manifest | hash 与本地文件一致 | ✅ |

---

### T-25: 清洁侧载全流程 —— my-custom-tool

**验证链**:
| 层级 | 检查方法 | 预期 |
|------|---------|------|
| UI | Skills 页面可见且 `eligible` | ✅ |
| Chat | 输入 "请使用 my-custom-tool skill" | Agent 识别可用 |
| API | `skills.status` 中 `eligible: true` | ✅ |
| 审计 | `audit.jsonl` 中 `sideload_pass` 事件 | `skill=my-custom-tool` |
| 审计 | `audit.jsonl` 中 `not_in_store` 事件 | `skill=my-custom-tool`（标记非商店来源） |

---

## 七、策略切换验证

> 以下用例需要修改配置后重启 Gateway，操作后务必恢复。

### T-26: sideloadPolicy=warn —— 危险侧载变为警告放行

**操作**:

1. 修改 `~/.openclaw-dev/openclaw.json`，将 `skills.guard.sideloadPolicy` 改为 `"warn"`
2. 重启 Gateway
3. 检查 Skills 页面

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| `dangerous-sideload` **出现**在 INSTALLED SKILLS 列表中 | ✅ |
| `dangerous-sideload` 显示 `eligible` | ✅ |
| `evil-skill` **仍然不在列表中**（blocklist 不受策略影响） | ✅ |
| `store-tampered` **仍然不在列表中**（商店校验不受策略影响） | ✅ |
| `store-injected` **仍然不在列表中**（商店校验不受策略影响） | ✅ |
| 审计日志中出现 `sideload_warn` 事件（而非 `blocked`） | ✅ |

**Chat 验证**: 输入 "请使用 dangerous-sideload skill"，Agent 应能识别该 skill

**操作后恢复**: 将 `sideloadPolicy` 改回 `"block-critical"`，重启 Gateway

---

### T-27: guard.enabled=false —— 总开关关闭

**操作**:

1. 修改 `~/.openclaw-dev/openclaw.json`，将 `skills.guard.enabled` 改为 `false`
2. 重启 Gateway
3. 检查 Skills 页面

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| **所有** 7 个 managed skill 都出现在 INSTALLED SKILLS 中 | ✅ |
| `evil-skill` 显示 `eligible`（Guard 关闭，无阻断） | ✅ |
| `dangerous-sideload` 显示 `eligible` | ✅ |
| `store-tampered` 显示 `eligible` | ✅ |
| `store-injected` 显示 `eligible` | ✅ |
| 审计日志 **无新事件**（Guard 未注册，不做评估） | ✅ |

**Chat 验证**: 输入 "请使用 evil-skill"，Agent 应能识别该 skill（因为 Guard 关闭）

**操作后恢复**: 将 `enabled` 改回 `true`，重启 Gateway

---

### T-28: 云端不可达 + 有缓存 —— 缓存降级

**操作**:

1. 停止冒烟服务器（`kill` 相关进程）
2. **不删除** `~/.openclaw-dev/security/skill-guard/manifest-cache.json`
3. 重启 Gateway

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| INSTALLED SKILLS 仍为 **3** 个可用 skill | ✅ |
| `evil-skill` 等恶意 skill **仍然不可见** | ✅ |
| 审计日志出现 `config_sync_failed` 事件 | ✅ |
| 审计日志出现 `cache_fallback` 事件 | ✅ |

**操作后恢复**: 重新启动冒烟服务器

---

### T-29: 云端不可达 + 无缓存 —— 完全降级

**操作**:

1. 停止冒烟服务器
2. 删除缓存文件：`rm ~/.openclaw-dev/security/skill-guard/manifest-cache.json`
3. 重启 Gateway

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| **所有** managed skill 都出现在列表中（无法校验，降级放行） | ✅ |
| 审计日志出现 `config_sync_failed` 事件 | ✅ |
| 审计日志出现 `verification_off` 事件（detail="no manifest available"） | ✅ |
| `dangerous-sideload` 的处理取决于 sideloadPolicy（默认仍扫描） | 视策略 |

**操作后恢复**: 重新启动冒烟服务器，重启 Gateway（触发 manifest 同步）

---

## 八、Gateway 重启持久性验证

### T-30: 多次 Disable/Enable 循环后 Guard 持续有效

**操作**:

1. 在 Skills 页面对 `store-verified` 执行 **3 次** Disable → Enable 循环
2. 每次操作后等待 Gateway 重启完成
3. 最终检查 Skills 页面

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 3 次循环后 `evil-skill` 仍然不可见 | ✅ |
| 3 次循环后 `dangerous-sideload` 仍然不可见 | ✅ |
| 3 次循环后 INSTALLED SKILLS 数量仍为 3 | ✅ |
| 审计日志中每次重启后都有新的 `blocked` 事件 | ✅ |

---

### T-31: 对不同 Skill 执行 Disable/Enable

**操作**:

1. Disable `my-custom-tool`，等待重启
2. 检查恶意 skill 是否仍被阻断
3. Enable `my-custom-tool`，等待重启
4. 检查恶意 skill 是否仍被阻断

**预期结果**:
| 步骤 | 检查项 | 预期 |
|------|--------|------|
| Disable `my-custom-tool` 后 | `evil-skill` 不可见 | ✅ |
| Disable `my-custom-tool` 后 | `my-custom-tool` 显示 disabled | ✅ |
| Enable `my-custom-tool` 后 | `evil-skill` 不可见 | ✅ |
| Enable `my-custom-tool` 后 | `my-custom-tool` 恢复 eligible | ✅ |

---

## 九、Skill Store CLI（store-cli.py）验证

> 以下用例验证内置 `skill-store` Skill 的 store-cli.py 工具，覆盖搜索/安装/SHA256 校验/卸载全流程。

### T-32: skill-store 在 BUILT-IN SKILLS 中可见

**操作**: 打开 Gateway Control UI → Skills 页面，查看 BUILT-IN SKILLS 分组

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| `skill-store` 出现在 BUILT-IN SKILLS 列表中 | ✅ |
| `skill-store` 来源显示 `openclaw-bundled` | ✅ |
| `skill-store` 显示 `eligible` 徽标 | ✅ |
| 描述包含 "SHA256 verification" 关键词 | ✅ |

---

### T-33: store-cli.py search 搜索功能

**操作**: 在 Chat 页面输入：

```
请使用 skill-store，搜索包含 "architecture" 关键词的 skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| Agent 调用 `store-cli.py search architecture` | ✅ |
| 输出包含 `architecture` skill 条目 | ✅ |
| 显示版本号和发布者 | ✅ |
| 不报错、不要求安装额外依赖 | ✅ |

---

### T-34: store-cli.py install 安装 + SHA256 验证

**操作**: 在 Chat 页面输入：

```
请使用 skill-store，安装 architecture skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 输出包含 "Downloading from store" | ✅ |
| 输出包含 "Verifying SHA256 hashes" | ✅ |
| 输出包含 "SHA256 verified: yes" | ✅ |
| 输出包含 "Installed architecture" | ✅ |
| `~/.openclaw-dev/skills/` 下出现新安装的 skill 目录 | ✅ |

---

### T-35: store-cli.py Blocklist 拦截

**操作**: 在 Chat 页面输入：

```
请使用 skill-store，安装 evil-skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 输出包含 "blocklist" 或 "cannot be installed" | ✅ |
| skill 未被安装 | ✅ |

---

### T-36: store-cli.py list 列出商店目录

**操作**: 在 Chat 页面输入：

```
请使用 skill-store，列出商店中所有可用的 skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 输出商店名称和版本 | ✅ |
| 输出 Available 和 Blocked 统计 | ✅ |
| Blocked skills 列表包含已知恶意 skill | ✅ |

---

### T-37: store-cli.py remove 卸载

**操作**: 在 Chat 页面输入：

```
请使用 skill-store，卸载 architecture skill
```

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 输出包含 "Removed" | ✅ |
| `~/.openclaw-dev/skills/` 下对应目录已删除 | ✅ |

---

### T-38: Gateway 重启后识别已安装 skill

**操作**:

1. 使用 store-cli.py 安装一个 skill（如 T-34）
2. 重启 Gateway
3. 查看 Skills 页面

**预期结果**:
| 检查项 | 预期 |
|--------|------|
| 安装的 skill 出现在 INSTALLED SKILLS 中 | ✅ |
| 该 skill 显示 `eligible` | ✅ |
| 来源显示 `openclaw-managed` | ✅ |

---

## 测试结果汇总表

| 编号 | 类别        | 场景                             | 结果 |
| ---- | ----------- | -------------------------------- | ---- |
| T-01 | UI          | 可信 Skill 正常展示              | [ ]  |
| T-02 | UI          | 恶意 Skill 完全不可见            | [ ]  |
| T-03 | UI          | INSTALLED SKILLS 计数            | [ ]  |
| T-04 | UI          | Disable/Enable 后 Guard 持续有效 | [ ]  |
| T-05 | UI          | 搜索过滤验证                     | [ ]  |
| T-06 | Chat        | Agent 识别可用 Skill             | [ ]  |
| T-07 | Chat        | Agent 使用已验证 Skill           | [ ]  |
| T-08 | Chat        | Agent 无法看到被阻断 Skill       | [ ]  |
| T-09 | Chat        | Agent 正确报告可用状态           | [ ]  |
| T-10 | Chat        | Disable 后 Skill 不可用          | [ ]  |
| T-11 | API         | skills.status 返回正确           | [ ]  |
| T-12 | API         | Disable/Enable 后 API 一致       | [ ]  |
| T-13 | 冒烟服务器  | Manifest 接口                    | [ ]  |
| T-14 | 冒烟服务器  | ETag/304 缓存                    | [ ]  |
| T-15 | 冒烟服务器  | 单 Skill 查询                    | [ ]  |
| T-16 | 冒烟服务器  | Skill 下载                       | [ ]  |
| T-17 | 审计        | 事件类型覆盖                     | [ ]  |
| T-18 | 审计        | 阻断原因记录                     | [ ]  |
| T-19 | 审计        | 重启后持续记录                   | [ ]  |
| T-20 | 安全深度    | Blocklist 全链路                 | [ ]  |
| T-21 | 安全深度    | Hash 篡改全链路                  | [ ]  |
| T-22 | 安全深度    | 文件注入全链路                   | [ ]  |
| T-23 | 安全深度    | 危险代码扫描全链路               | [ ]  |
| T-24 | 安全深度    | 商店正品全链路                   | [ ]  |
| T-25 | 安全深度    | 清洁侧载全链路                   | [ ]  |
| T-26 | 策略切换    | sideloadPolicy=warn              | [ ]  |
| T-27 | 策略切换    | guard.enabled=false              | [ ]  |
| T-28 | 降级        | 云端不可达 + 有缓存              | [ ]  |
| T-29 | 降级        | 云端不可达 + 无缓存              | [ ]  |
| T-30 | 持久性      | 多次 Disable/Enable 循环         | [ ]  |
| T-31 | 持久性      | 不同 Skill 的 Disable/Enable     | [ ]  |
| T-32 | Skill Store | skill-store BUILT-IN 可见        | [ ]  |
| T-33 | Skill Store | search 搜索功能                  | [ ]  |
| T-34 | Skill Store | install + SHA256 验证            | [ ]  |
| T-35 | Skill Store | Blocklist 拦截安装               | [ ]  |
| T-36 | Skill Store | list 列出商店目录                | [ ]  |
| T-37 | Skill Store | remove 卸载                      | [ ]  |
| T-38 | Skill Store | Gateway 识别已安装 skill         | [ ]  |

**通过标准**: 38/38 全部通过

---

## 修订记录

| 版本 | 日期       | 变更内容                                                               |
| ---- | ---------- | ---------------------------------------------------------------------- |
| v1.0 | 2026-02-07 | 初始版本：31 个用例，覆盖 UI/Chat/API/冒烟服务器/审计/策略/降级/持久性 |
| v1.1 | 2026-02-08 | 新增第九节 Skill Store CLI 验证（T-32 ~ T-38），总计 38 个用例         |
