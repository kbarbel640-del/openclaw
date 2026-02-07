# Skill Guard 冒烟测试检查表（交付演示标准）

> **版本**: v2.0  
> **日期**: 2026-02-07  
> **分支**: `feature/skill-guard-enhancement`  
> **测试环境**: Linux (Ubuntu), Gateway 端口 19001, Mock Store 端口 9876  
> **配置**: `~/.openclaw-dev/openclaw.json` (dev 模式, `sideloadPolicy=block-critical`)

---

## 测试矩阵总览

| 分类          | TC 编号 | 场景                  | 验证方式       | 预期结果       |
| ------------- | ------- | --------------------- | -------------- | -------------- |
| **商店校验**  | TC-01   | 商店正品加载          | UI + 审计日志  | ✅ 加载        |
| **商店校验**  | TC-02   | 篡改 hash 阻断        | UI + 审计日志  | ❌ 阻断        |
| **商店校验**  | TC-03   | 注入文件阻断          | UI + 审计日志  | ❌ 阻断        |
| **Blocklist** | TC-04   | Blocklist 阻断        | UI + 审计日志  | ❌ 阻断        |
| **侧载**      | TC-05   | 清洁侧载放行          | UI + 审计日志  | ✅ 加载        |
| **侧载**      | TC-06   | 危险侧载阻断          | UI + 审计日志  | ❌ 阻断        |
| **策略切换**  | TC-07   | sideloadPolicy=warn   | UI + 审计日志  | ⚠ 警告放行     |
| **总开关**    | TC-08   | guard.enabled=false   | UI             | ✅ 全部加载    |
| **降级**      | TC-09   | 云端不可达+有缓存     | UI + 审计日志  | 缓存生效       |
| **降级**      | TC-10   | 云端不可达+无缓存     | UI + 审计日志  | 全部降级放行   |
| **Chat**      | TC-11   | Chat 使用已验证 Skill | Chat 界面      | Agent 识别可用 |
| **Chat**      | TC-12   | Chat 使用被阻断 Skill | Chat 界面      | Agent 无法看到 |
| **Chat**      | TC-13   | Chat 询问 Skill 状态  | Chat 界面      | 正确报告列表   |
| **UI 交互**   | TC-14   | Skills 页面计数       | Skills 页面    | 数量正确       |
| **UI 交互**   | TC-15   | Skills 页面过滤搜索   | Skills 页面    | 搜索结果正确   |
| **UI 交互**   | TC-16   | 禁用/启用 Skill       | Skills 页面    | 状态切换正确   |
| **下载**      | TC-17   | 从商店下载 Skill      | API + 文件校验 | tar.gz 可解压  |
| **ETag**      | TC-18   | ETag 304 缓存         | curl 验证      | 304 响应       |
| **审计**      | TC-19   | 审计日志完整性        | JSONL 文件     | 7 类事件覆盖   |
| **性能**      | TC-20   | 自动化测试全部通过    | vitest         | 全部 PASS      |

---

## 0. 前置条件

| #   | 检查项                    | 命令/操作                                                                           | 预期      | 实际 |
| --- | ------------------------- | ----------------------------------------------------------------------------------- | --------- | ---- |
| P1  | Python 3 已安装           | `python3 --version`                                                                 | ≥3.8      | [ ]  |
| P2  | Node.js ≥ 22 已安装       | `node --version`                                                                    | ≥22.12    | [ ]  |
| P3  | pnpm 已安装               | `pnpm --version`                                                                    | 有输出    | [ ]  |
| P4  | 依赖已安装                | `pnpm install --no-frozen-lockfile`                                                 | 无报错    | [ ]  |
| P5  | 冒烟服务器已启动          | `curl -s http://127.0.0.1:9876/api/v1/skill-guard/manifest \| python3 -m json.tool` | 返回 JSON | [ ]  |
| P6  | Gateway 已启动            | `ss -tlnp \| grep 19001`                                                            | 端口监听  | [ ]  |
| P7  | Gateway 日志含 guard 注册 | 启动日志含 `[skills/guard] skill load guard registered`                             | 有        | [ ]  |

### 测试 Skills 清单

| Skill 名称           | 位置                                         | 角色                            |
| -------------------- | -------------------------------------------- | ------------------------------- |
| `store-verified`     | `~/.openclaw-dev/skills/store-verified/`     | 商店正品（2 文件，SHA256 匹配） |
| `store-tampered`     | `~/.openclaw-dev/skills/store-tampered/`     | 商店被篡改（hash 不匹配）       |
| `store-injected`     | `~/.openclaw-dev/skills/store-injected/`     | 商店被注入（多出 payload.js）   |
| `evil-skill`         | `~/.openclaw-dev/skills/evil-skill/`         | Blocklist 中的恶意 Skill        |
| `my-custom-tool`     | `~/.openclaw-dev/skills/my-custom-tool/`     | 清洁侧载 Skill                  |
| `dangerous-sideload` | `~/.openclaw-dev/skills/dangerous-sideload/` | 危险侧载 Skill（含 exploit.js） |
| `downloadable-skill` | `~/.openclaw-dev/skills/downloadable-skill/` | 可下载的商店 Skill              |

---

## TC-01: 商店正品 Skill 正常加载

**前置**: guard.enabled=true, sideloadPolicy=block-critical, 冒烟服务器运行

**操作步骤**:

1. 打开浏览器访问 `http://localhost:19001/__openclaw__/`
2. 输入密码 `dev` 登录
3. 导航到 Skills 页面
4. 在 "Installed Skills" 分组中查找 `store-verified`

**验证点**:

| #   | 检查项                                                    | 预期 | 实际 |
| --- | --------------------------------------------------------- | ---- | ---- |
| 1   | `store-verified` 出现在 Installed Skills 列表             | 是   | [ ]  |
| 2   | 状态标签显示 `eligible`                                   | 是   | [ ]  |
| 3   | 无 `blocked` 或 `disabled` 标签                           | 是   | [ ]  |
| 4   | 描述文字："A store-verified test skill for smoke testing" | 是   | [ ]  |

**审计日志验证**:

```bash
grep "store-verified" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

预期包含: `"event":"load_pass","skill":"store-verified","source":"store"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-02: 被篡改的商店 Skill 被阻断

**操作步骤**:

1. 在 Skills 页面搜索 `store-tampered`

**验证点**:

| #   | 检查项                                | 预期 | 实际 |
| --- | ------------------------------------- | ---- | ---- |
| 1   | `store-tampered` **不出现**在任何列表 | 是   | [ ]  |
| 2   | Installed Skills 计数不包含它         | 是   | [ ]  |

**审计日志验证**:

```bash
grep "store-tampered" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

预期包含: `"event":"blocked","reason":"hash mismatch: SKILL.md"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-03: 被注入文件的商店 Skill 被阻断

**操作步骤**:

1. 在 Skills 页面搜索 `store-injected`

**验证点**:

| #   | 检查项                                | 预期 | 实际 |
| --- | ------------------------------------- | ---- | ---- |
| 1   | `store-injected` **不出现**在任何列表 | 是   | [ ]  |
| 2   | Guard 检测到 fileCount 不匹配         | 是   | [ ]  |

**审计日志验证**:

```bash
grep "store-injected" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

预期包含: `"event":"blocked","reason":"file count: expected 1, found 2"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-04: Blocklist 中的 Skill 被阻断

**操作步骤**:

1. 在 Skills 页面搜索 `evil-skill`

**验证点**:

| #   | 检查项                            | 预期 | 实际 |
| --- | --------------------------------- | ---- | ---- |
| 1   | `evil-skill` **不出现**在任何列表 | 是   | [ ]  |
| 2   | Installed Skills 计数不包含它     | 是   | [ ]  |

**审计日志验证**:

```bash
grep "evil-skill" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

预期包含: `"event":"blocked","reason":"blocklisted"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-05: 清洁侧载 Skill 正常加载

**操作步骤**:

1. 在 Skills 页面查找 `my-custom-tool`

**验证点**:

| #   | 检查项                                        | 预期 | 实际 |
| --- | --------------------------------------------- | ---- | ---- |
| 1   | `my-custom-tool` 出现在 Installed Skills 列表 | 是   | [ ]  |
| 2   | 状态标签显示 `eligible`                       | 是   | [ ]  |
| 3   | 描述："A clean sideloaded custom skill"       | 是   | [ ]  |

**审计日志验证**:

```bash
grep "my-custom-tool" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

预期包含: `"event":"sideload_pass"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-06: 危险侧载 Skill 被阻断 (sideloadPolicy=block-critical)

**前置**: `sideloadPolicy` 为 `"block-critical"` (默认)

**操作步骤**:

1. 在 Skills 页面搜索 `dangerous-sideload`

**验证点**:

| #   | 检查项                                    | 预期 | 实际 |
| --- | ----------------------------------------- | ---- | ---- |
| 1   | `dangerous-sideload` **不出现**在任何列表 | 是   | [ ]  |
| 2   | exploit.js 中的 dangerous-exec 被检测到   | 是   | [ ]  |
| 3   | exploit.js 中的 env-harvesting 被检测到   | 是   | [ ]  |

**审计日志验证**:

```bash
grep "dangerous-sideload" ~/.openclaw-dev/security/skill-guard/audit.jsonl | grep "blocked" | tail -1
```

预期包含: `"reason":"sideload scan: dangerous-exec in exploit.js, env-harvesting in exploit.js"`

**结果**: [ ] 通过 / [ ] 失败

---

## TC-07: sideloadPolicy=warn 时危险侧载 Skill 警告放行

**操作步骤**:

1. 修改 `~/.openclaw-dev/openclaw.json` 中 `skills.guard.sideloadPolicy` 为 `"warn"`
2. 重启 Gateway
3. 在 Skills 页面查找 `dangerous-sideload`

**验证点**:

| #   | 检查项                                                         | 预期 | 实际 |
| --- | -------------------------------------------------------------- | ---- | ---- |
| 1   | `dangerous-sideload` **出现**在 Installed Skills 列表          | 是   | [ ]  |
| 2   | 状态标签显示 `eligible`                                        | 是   | [ ]  |
| 3   | `store-tampered` 仍被阻断（hash 校验不受 sideloadPolicy 影响） | 是   | [ ]  |
| 4   | `evil-skill` 仍被阻断（blocklist 不受 sideloadPolicy 影响）    | 是   | [ ]  |

**审计日志验证**:

```bash
grep "dangerous-sideload" ~/.openclaw-dev/security/skill-guard/audit.jsonl | grep "sideload_warn" | tail -1
```

预期包含: `"event":"sideload_warn"`

**操作后恢复**: 将 `sideloadPolicy` 改回 `"block-critical"`，重启 Gateway

**结果**: [ ] 通过 / [ ] 失败

---

## TC-08: Guard 总开关关闭 (enabled=false)

**操作步骤**:

1. 修改 `~/.openclaw-dev/openclaw.json` 中 `skills.guard.enabled` 为 `false`
2. 重启 Gateway
3. 打开 Skills 页面

**验证点**:

| #   | 检查项                                             | 预期 | 实际 |
| --- | -------------------------------------------------- | ---- | ---- |
| 1   | 所有 7 个 managed skills 全部出现                  | 是   | [ ]  |
| 2   | `evil-skill` 出现（blocklist 不生效）              | 是   | [ ]  |
| 3   | `dangerous-sideload` 出现（侧载扫描不生效）        | 是   | [ ]  |
| 4   | `store-tampered` 出现（hash 校验不生效）           | 是   | [ ]  |
| 5   | Gateway 启动日志不含 `skill load guard registered` | 是   | [ ]  |

**操作后恢复**: 将 `enabled` 改回 `true`，重启 Gateway

**结果**: [ ] 通过 / [ ] 失败

---

## TC-09: 云端不可达 + 有缓存 → 缓存降级

**操作步骤**:

1. 确保当前 Guard 已同步 manifest（审计日志含 `config_sync`）
2. 停止冒烟服务器: `kill $(pgrep -f skill-guard-server)`
3. 重启 Gateway
4. 打开 Skills 页面

**验证点**:

| #   | 检查项                                           | 预期 | 实际 |
| --- | ------------------------------------------------ | ---- | ---- |
| 1   | Gateway 日志含 `config_sync_failed`              | 是   | [ ]  |
| 2   | Gateway 日志含 `cache_fallback`                  | 是   | [ ]  |
| 3   | `store-verified` 仍正常加载（使用缓存 manifest） | 是   | [ ]  |
| 4   | `evil-skill` 仍被阻断（缓存的 blocklist 生效）   | 是   | [ ]  |
| 5   | `store-tampered` 仍被阻断（缓存的 hash 生效）    | 是   | [ ]  |

**审计日志验证**:

```bash
grep -E "config_sync_failed|cache_fallback" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -2
```

**操作后恢复**: 重新启动冒烟服务器

**结果**: [ ] 通过 / [ ] 失败

---

## TC-10: 云端不可达 + 无缓存 → 完全降级

**操作步骤**:

1. 停止冒烟服务器
2. 删除缓存: `rm -rf ~/.openclaw-dev/security/skill-guard/`
3. 重启 Gateway
4. 打开 Skills 页面

**验证点**:

| #   | 检查项                                  | 预期 | 实际 |
| --- | --------------------------------------- | ---- | ---- |
| 1   | Gateway 正常启动（不崩溃）              | 是   | [ ]  |
| 2   | 审计日志含 `verification_off`           | 是   | [ ]  |
| 3   | **所有** 7 个 managed skills 全部出现   | 是   | [ ]  |
| 4   | 包括 `evil-skill`（降级模式无校验）     | 是   | [ ]  |
| 5   | 包括 `store-tampered`（降级模式无校验） | 是   | [ ]  |

**审计日志验证**:

```bash
grep "verification_off" ~/.openclaw-dev/security/skill-guard/audit.jsonl | tail -1
```

**操作后恢复**: 重新启动冒烟服务器，重启 Gateway

**结果**: [ ] 通过 / [ ] 失败

---

## TC-11: Chat 页面使用已验证 Skill

**前置**: guard.enabled=true, 冒烟服务器运行, sideloadPolicy=block-critical

**操作步骤**:

1. 打开 Gateway UI Chat 页面
2. 发送消息:
   ```
   请列出你当前可用的所有 skills，特别是其中是否有 store-verified 这个 skill
   ```
3. 观察 Agent 回复

**验证点**:

| #   | 检查项                                      | 预期 | 实际 |
| --- | ------------------------------------------- | ---- | ---- |
| 1   | Agent 回复中提到了 `store-verified`         | 是   | [ ]  |
| 2   | Agent 回复中**不包含** `evil-skill`         | 是   | [ ]  |
| 3   | Agent 回复中**不包含** `dangerous-sideload` | 是   | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## TC-12: Chat 页面尝试使用被阻断 Skill

**操作步骤**:

1. 在 Chat 页面发送:
   ```
   请使用 evil-skill 帮我执行一个任务
   ```
2. 观察 Agent 回复

**验证点**:

| #   | 检查项                                       | 预期 | 实际 |
| --- | -------------------------------------------- | ---- | ---- |
| 1   | Agent 回复表示找不到 `evil-skill` 或无法使用 | 是   | [ ]  |
| 2   | Agent 不会尝试执行 `evil-skill` 的代码       | 是   | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## TC-13: Chat 页面询问 Skill 安全状态

**操作步骤**:

1. 在 Chat 页面发送:
   ```
   请使用 store-verified skill，读取它的 SKILL.md 内容并告诉我它的描述信息
   ```
2. 观察 Agent 回复

**验证点**:

| #   | 检查项                                              | 预期 | 实际 |
| --- | --------------------------------------------------- | ---- | ---- |
| 1   | Agent 能读取 store-verified 的 SKILL.md             | 是   | [ ]  |
| 2   | 回复包含 "Store verified skill loaded successfully" | 是   | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## TC-14: Skills 页面计数验证

**操作步骤**:

1. 进入 Skills 页面
2. 检查各分组的数量

**验证点**:

| #   | 检查项                                                                          | 预期 | 实际 |
| --- | ------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Built-in Skills 数量 ≈ 50                                                       | 是   | [ ]  |
| 2   | Installed Skills 数量 = 3（store-verified, my-custom-tool, downloadable-skill） | 是   | [ ]  |
| 3   | 总数 shown = 约 53（不含被阻断的 4 个）                                         | 是   | [ ]  |
| 4   | 被阻断的 4 个 skill 完全不出现                                                  | 是   | [ ]  |

**WS API 验证**:

```bash
# 通过 WebSocket 查询确认
node -e "..." # (使用 gateway-client 模式查询 skills.status)
```

预期: Total=53, Managed=3

**结果**: [ ] 通过 / [ ] 失败

---

## TC-15: Skills 页面过滤搜索验证

**操作步骤**:

1. 在 Skills 页面的 Filter 搜索框中分别输入以下关键词

**验证点**:

| #   | 搜索关键词       | 预期匹配                | 预期不匹配                | 实际 |
| --- | ---------------- | ----------------------- | ------------------------- | ---- |
| 1   | `store-verified` | 找到 store-verified     | -                         | [ ]  |
| 2   | `evil`           | **无结果**              | evil-skill 不出现         | [ ]  |
| 3   | `dangerous`      | **无结果**              | dangerous-sideload 不出现 | [ ]  |
| 4   | `tampered`       | **无结果**              | store-tampered 不出现     | [ ]  |
| 5   | `custom`         | 找到 my-custom-tool     | -                         | [ ]  |
| 6   | `sideload`       | **无结果**              | -                         | [ ]  |
| 7   | `downloadable`   | 找到 downloadable-skill | -                         | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## TC-16: Skills 页面禁用/启用交互（含 BUG-5 回归验证）

> **重要**: 此用例同时验证 BUG-5 修复——skills.update 触发的 SIGUSR1 Gateway 重启
> 不能导致 Guard 失效。

**操作步骤**:

1. 在 Skills 页面找到 `store-verified`
2. 点击 "Disable" 按钮
3. 等待 Gateway 重启完成（约 2-3 秒，页面自动重连）
4. 观察状态变化
5. **关键检查**: 确认 `evil-skill`, `dangerous-sideload`, `store-tampered`, `store-injected` 仍然不在列表中
6. 再次点击 "Enable" 按钮恢复
7. 等待 Gateway 重启完成
8. **关键检查**: 再次确认恶意 skill 仍然被阻断

**验证点**:

| #   | 检查项                                                               | 预期 | 实际 |
| --- | -------------------------------------------------------------------- | ---- | ---- |
| 1   | 点击 Disable 后显示 "Skill disabled" 成功消息                        | 是   | [ ]  |
| 2   | `store-verified` 状态变为 disabled                                   | 是   | [ ]  |
| 3   | **Disable 后 Guard 持久**: `evil-skill` 不在 INSTALLED SKILLS 列表中 | 是   | [ ]  |
| 4   | **Disable 后 Guard 持久**: `dangerous-sideload` 不在列表中           | 是   | [ ]  |
| 5   | 点击 Enable 后恢复为 eligible                                        | 是   | [ ]  |
| 6   | **Enable 后 Guard 持久**: `evil-skill` 不在列表中                    | 是   | [ ]  |
| 7   | **Enable 后 Guard 持久**: `dangerous-sideload` 不在列表中            | 是   | [ ]  |
| 8   | 配置文件中 `skills.entries.store-verified.enabled` 被正确更新        | 是   | [ ]  |
| 9   | Gateway 日志显示: `unregistered` 后紧跟 `registered`                 | 是   | [ ]  |
| 10  | 审计日志在重启后仍有新的 `blocked` 事件记录                          | 是   | [ ]  |

**Gateway 日志验证命令**:

```bash
# 确认每次 unregister 后都有 register
grep "skill load guard" /tmp/gateway-debug.log
# 预期输出模式（每对表示一次重启）:
#   [skills/guard] skill load guard unregistered
#   [skills/guard] skill load guard registered
```

**结果**: [ ] 通过 / [ ] 失败

---

## TC-17: 从商店下载 Skill

**操作步骤**:

1. 通过 curl 测试下载端点:
   ```bash
   curl -s -o /tmp/downloadable-skill.tar.gz \
     http://127.0.0.1:9876/api/v1/skill-guard/skills/downloadable-skill/download
   ```
2. 验证下载文件

**验证点**:

| #   | 检查项                           | 预期 | 实际 |
| --- | -------------------------------- | ---- | ---- |
| 1   | HTTP 200 响应                    | 是   | [ ]  |
| 2   | Content-Type 为 application/gzip | 是   | [ ]  |
| 3   | tar.gz 可正常解压                | 是   | [ ]  |
| 4   | 解压后包含 SKILL.md              | 是   | [ ]  |
| 5   | SKILL.md 内容与本地文件一致      | 是   | [ ]  |

**命令验证**:

```bash
tar -tzf /tmp/downloadable-skill.tar.gz       # 列出文件
tar -xzf /tmp/downloadable-skill.tar.gz -C /tmp/dl-test/  # 解压
sha256sum /tmp/dl-test/SKILL.md                # 校验 hash
```

**对不存在的 Skill 的下载**:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://127.0.0.1:9876/api/v1/skill-guard/skills/nonexistent/download
```

预期: HTTP 404

**结果**: [ ] 通过 / [ ] 失败

---

## TC-18: ETag/304 缓存机制验证

**操作步骤**:

```bash
# 1. 首次请求
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  http://127.0.0.1:9876/api/v1/skill-guard/manifest

# 2. 带 ETag 的条件请求
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H 'If-None-Match: "smoke-test-v2"' \
  http://127.0.0.1:9876/api/v1/skill-guard/manifest

# 3. 错误 ETag 的请求
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H 'If-None-Match: "wrong-version"' \
  http://127.0.0.1:9876/api/v1/skill-guard/manifest
```

**验证点**:

| #   | 请求类型            | 预期状态码 | 实际 |
| --- | ------------------- | ---------- | ---- |
| 1   | 首次请求（无 ETag） | 200        | [ ]  |
| 2   | 正确 ETag 条件请求  | 304        | [ ]  |
| 3   | 错误 ETag 条件请求  | 200        | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## TC-19: 审计日志完整性验证

**操作步骤**:

```bash
cat ~/.openclaw-dev/security/skill-guard/audit.jsonl | python3 -c "
import json, sys, collections
events = collections.Counter()
for line in sys.stdin:
    try:
        ev = json.loads(line.strip())
        events[ev['event']] += 1
    except: pass
for event, count in sorted(events.items()):
    print(f'  {event}: {count}')
"
```

**验证点**:

| #   | 审计事件类型                                  | 最少出现次数 | 实际 |
| --- | --------------------------------------------- | ------------ | ---- |
| 1   | `config_sync`                                 | ≥ 1          | [ ]  |
| 2   | `load_pass` (store-verified)                  | ≥ 1          | [ ]  |
| 3   | `blocked` (evil-skill, blocklisted)           | ≥ 1          | [ ]  |
| 4   | `blocked` (store-tampered, hash mismatch)     | ≥ 1          | [ ]  |
| 5   | `blocked` (store-injected, file count)        | ≥ 1          | [ ]  |
| 6   | `blocked` (dangerous-sideload, sideload scan) | ≥ 1          | [ ]  |
| 7   | `sideload_pass` (my-custom-tool)              | ≥ 1          | [ ]  |
| 8   | `not_in_store` (侧载 skill 标记)              | ≥ 1          | [ ]  |

**JSONL 格式验证**: 每行均为合法 JSON

**结果**: [ ] 通过 / [ ] 失败

---

## TC-20: 自动化测试通过

**操作步骤**:

```bash
cd <worktree>/atd && pnpm vitest run extensions/skill-guard/src/smoke.test.ts
```

**验证点**:

| #   | 测试用例                                                  | 预期 | 实际 |
| --- | --------------------------------------------------------- | ---- | ---- |
| 1   | E2E: fetches manifest and verifies good skill             | PASS | [ ]  |
| 2   | E2E: 304 Not Modified when version matches                | PASS | [ ]  |
| 3   | E2E: blocklisted skill is blocked                         | PASS | [ ]  |
| 4   | E2E: tampered store skill is blocked                      | PASS | [ ]  |
| 5   | E2E: injected file in store skill is blocked              | PASS | [ ]  |
| 6   | E2E: sideloaded skill passes when clean                   | PASS | [ ]  |
| 7   | E2E: sideloaded with critical + block-critical → blocked  | PASS | [ ]  |
| 8   | E2E: sideloaded with critical + warn → warning only       | PASS | [ ]  |
| 9   | E2E: cloud unreachable + cached manifest → uses cache     | PASS | [ ]  |
| 10  | E2E: cloud unreachable + no cache → degrades to allow all | PASS | [ ]  |
| 11  | E2E: performance — 100 skills < 500ms                     | PASS | [ ]  |
| 12  | E2E: audit log captures correct events                    | PASS | [ ]  |

**结果**: [ ] 通过 / [ ] 失败

---

## 附录 A: 快速命令

```bash
# 启动冒烟服务器
SKILL_GUARD_MANIFEST_JSON=~/sg-test-manifest.json \
SKILL_GUARD_SKILLS_DIR=~/.openclaw-dev/skills \
python3 <worktree>/atd/test/smoke/skill-guard-server.py --port 9876

# 启动 Gateway (dev 模式)
cd <worktree>/atd && NODE_TLS_REJECT_UNAUTHORIZED=0 \
OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json \
node scripts/run-node.mjs --dev gateway

# 查看审计日志（格式化）
cat ~/.openclaw-dev/security/skill-guard/audit.jsonl | python3 -m json.tool --json-lines

# 查看缓存
cat ~/.openclaw-dev/security/skill-guard/manifest-cache.json | python3 -m json.tool

# 清除测试状态
rm -rf ~/.openclaw-dev/security/skill-guard/

# 运行自动化测试
cd <worktree>/atd && pnpm vitest run extensions/skill-guard/src/smoke.test.ts
```

## 附录 B: 测试数据校验矩阵

```
Skill × 状态组合 → 预期行为

                  Guard ON            Guard OFF     降级(无缓存无商店)
                  policy=block-crit   policy=warn
store-verified    ✅ load_pass        ✅ load_pass   ✅ 加载
store-tampered    ❌ blocked(hash)    ❌ blocked     ✅ 加载
store-injected    ❌ blocked(count)   ❌ blocked     ✅ 加载
evil-skill        ❌ blocked(list)    ❌ blocked     ✅ 加载
my-custom-tool    ✅ sideload_pass   ✅ pass         ✅ 加载
dangerous-sideload ❌ blocked(scan)   ⚠ warn         ✅ 加载
downloadable-skill ✅ load_pass       ✅ load_pass    ✅ 加载
```

---

## TC-21: SIGUSR1 重启后 Guard 恢复（BUG-5 回归测试）

> **背景**: BUG-5 发现 `skills.update` 触发 SIGUSR1 重启后，Guard 因插件缓存命中
> 而不再被 `register()` 调用，导致 `globalThis.__openclaw_skill_load_guard__` 永远为 null。

**前置条件**:

- Gateway 已启动且 Guard 初始注册成功
- 审计日志初始化正常

**操作步骤**:

1. 通过 WebSocket 调用 `skills.status`，确认初始状态正确（managed skills = 3）
2. 调用 `skills.update` 禁用 `store-verified`（触发 SIGUSR1 重启）
3. 等待 5 秒（Gateway 重启完成）
4. 通过新的 WebSocket 连接调用 `skills.status`
5. 调用 `skills.update` 启用 `store-verified`（触发第二次 SIGUSR1 重启）
6. 等待 5 秒
7. 通过新的 WebSocket 连接调用 `skills.status`

**验证点**:

| #   | 检查项                                              | 预期                                                   | 实际 |
| --- | --------------------------------------------------- | ------------------------------------------------------ | ---- |
| 1   | 初始 managed skills 数量                            | 3 (downloadable-skill, my-custom-tool, store-verified) | [ ]  |
| 2   | 初始状态 `evil-skill` 不在列表中                    | 是                                                     | [ ]  |
| 3   | 第一次重启后 `evil-skill` 不在列表中                | 是                                                     | [ ]  |
| 4   | 第一次重启后 `dangerous-sideload` 不在列表中        | 是                                                     | [ ]  |
| 5   | 第二次重启后 `evil-skill` 不在列表中                | 是                                                     | [ ]  |
| 6   | 第二次重启后 `dangerous-sideload` 不在列表中        | 是                                                     | [ ]  |
| 7   | Gateway 日志每次 `unregistered` 后紧跟 `registered` | 是                                                     | [ ]  |
| 8   | 审计日志在重启后有新的 `blocked` 事件               | 是                                                     | [ ]  |

**自动化验证命令**:

```bash
# 检查 guard 注册/注销对称性
grep "skill load guard" /tmp/gateway-debug.log | awk '
  /unregistered/ { unreg++ }
  /registered/   { reg++ }
  END { printf "registered=%d unregistered=%d balanced=%s\n", reg, unreg, (reg>=unreg?"YES":"NO") }
'

# 检查审计日志中重启后的 blocked 事件
python3 -c "
import json
events = []
with open('$HOME/.openclaw-dev/security/skill-guard/audit.jsonl') as f:
    for line in f:
        ev = json.loads(line.strip())
        if ev.get('event') == 'blocked':
            events.append(ev['ts'] + ' ' + ev.get('skill',''))
print(f'Blocked events: {len(events)}')
for e in events[-5:]: print(f'  {e}')
"
```

**结果**: [ ] 通过 / [ ] 失败
