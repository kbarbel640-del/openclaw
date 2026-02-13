---
description: 完成当前批次（强制更新所有状态文件并 git commit）
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## 任务：完成当前批次

你必须严格按以下顺序执行所有步骤，不能跳过。

### 第 1 步：运行测试
执行 poetry run pytest 或 python -m pytest。
如果有测试失败，先修复，直到全部通过。

### 第 2 步：更新 INTERFACES.md
扫描本批次新增/修改的所有 .py 文件，提取公开接口：
- class 名称和字段
- 关键 public 方法的签名（方法名、参数、返回类型）
- import 路径

追加到 INTERFACES.md 末尾，格式：

```
## openclaw_py.模块名.文件名
路径: openclaw_py/模块名/文件名.py

from openclaw_py.模块名.文件名 import 类名A, 类名B

class 类名A(BaseModel):
    字段1: 类型
    字段2: 类型

class 类名B:
    async def 方法名(参数: 类型) -> 返回类型: ...
```

### 第 3 步：更新 STATE.md
1. 把当前批次的状态从 ⬜ 改成 ✅
2. 填写完成日期（今天的日期）
3. 填写 commit hash（用 git log --oneline -1 获取，如果还没提交写 pending）
4. 更新"当前批次"为下一个批次号和 status: not_started
5. 更新"已生成的 Python 文件"列表
   （用 find openclaw_py -name "*.py" -not -name "__init__.py" 获取）
6. 如果有任何已知问题或 TODO，写到"已知问题"里

### 第 4 步：更新 CHANGELOG.md
在文件中"---"分隔线之后追加一条记录：

## 批次 N：批次名称（YYYY-MM-DD）
**新增文件**：
- 列出新增的 .py 文件

**核心变更**：
- 简述做了什么

**依赖的已有模块**：
- 列出 import 了哪些已有模块

**已知问题**：
- 无 / 列出问题

**测试结果**：X passed, Y failed

### 第 5 步：更新 CLAUDE.md
更新 CLAUDE.md 中的批次列表，把完成的批次标记为 ✅。
更新"已完成的 Python 文件"部分。

### 第 6 步：Git 提交
执行：
```bash
git add openclaw_py/ tests/ STATE.md INTERFACES.md CHANGELOG.md CLAUDE.md pyproject.toml
git status
```
展示给用户看，等用户确认后执行：
```bash
git commit -m "batch-N: 批次简述"
```

### 第 7 步：如果是里程碑批次（4/9/13/15），额外执行
- 运行全量 pytest
- 检查所有模块间的 import 是否有循环依赖
- 打 git tag：
  - 批次 4：git tag v0.1-foundation
  - 批次 9：git tag v0.2-engine
  - 批次 13：git tag v0.3-connected
  - 批次 15：git tag v1.0-python
- 回填 STATE.md 中本批次的 commit hash

### 第 8 步：输出下次开始提示
告诉用户：
"批次 N 完成 ✅。下次启动 Claude Code 后，输入 /start N+1 继续。"
