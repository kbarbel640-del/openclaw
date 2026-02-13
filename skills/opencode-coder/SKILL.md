---
name: opencode-coder
description: Use when you need to generate, analyze, or refactor code via the OpenCode CLI for writing new code, fixing bugs, explaining code, or implementing features across languages.
metadata:
  openclaw:
    emoji: 🧑‍💻
    requires:
      bins: ["opencode"]
    install:
      - id: npm
        kind: node
        package: opencode
        bins: ["opencode"]
        label: "Install OpenCode (npm)"
---

# OpenCode Coder

Use OpenCode CLI (version 1.1.50) as a **sub-agent** for code generation.

## 🎯 Role Division

| Role | Responsibility |
|------|----------------|
| **Eden (Main Agent)** | Planning, task breakdown, assign tasks, review code, verify functionality, integrate results |
| **OpenCode (Sub-agent)** | Execute code generation tasks based on Eden's specifications |

## 📋 Workflow

```
1. User Request
   ↓
2. Eden: Plan & Break Down Tasks
   ↓
3. Eden → OpenCode: "Generate X feature"
   ↓
4. OpenCode: Returns Code
   ↓
5. Eden: Review (Quality/Security/Standards)
   ↓
6. Eden: Verify & Test
   ↓
7. Eden: Confirm to User
```

## Quick Start

### One-Shot Generation

Generate code for a simple task:

```bash
bash pty:true workdir:~/project command:"opencode run 'Create a simple REST API with Flask'"
```

### Interactive Session

Start an interactive coding session:

```bash
bash pty:true workdir:~/project command:"opencode run 'Help me build a trading bot' --interactive"
```

## Essential Flags

| Flag | Description |
|------|-------------|
| `run` | Execute a one-time coding task |
| `--interactive` | Start interactive mode for back-and-forth discussion |
| `--context <dir>` | Set working directory for context |

## Workflow Examples

### Example 1: Build a Trading Bot

**User Request**: "帮我做一个MT5自动交易机器人"

**Step 1: Eden规划任务**
```
需求分析：
- 连接MT5 API
- 获取市场数据
- 实现交易策略（均线交叉）
- 风险管理（止损止盈）
- 日志记录
```

**Step 2: Eden分解任务，分配给OpenCode**
```bash
bash pty:true workdir:~/mt5-bot command:"opencode run '创建Python模块mt5_connection.py，包含初始化MT5连接、获取账户信息、检查连接状态的函数。使用MetaTrader5库，添加异常处理。'"
```

**Step 3: Eden审查代码**
- ✅ 检查代码结构
- ✅ 验证异常处理
- ✅ 确保最佳实践

**Step 4: Eden分配下一个任务**
```bash
bash pty:true workdir:~/mt5-bot command:"opencode run '创建strategy.py模块，实现双均线交叉策略。包含calculate_ma()、check_signals()、generate_order()函数。'"
```

**Step 5: Eden整合并验证**
- ✅ 测试完整功能
- ✅ 验证数据流
- ✅ 确认输出正确

---

### Example 2: Web API Development

**User Request**: "做个任务管理API"

**Step 1: Eden规划**
```
- FastAPI框架
- PostgreSQL数据库
- SQLAlchemy ORM
- JWT认证
- CRUD操作
```

**Step 2: 分配任务给OpenCode**
```bash
bash pty:true workdir:~/task-api command:"opencode run '创建FastAPI应用程序框架，设置基础配置、依赖注入和错误处理中间件。'"
```

**Step 3: 审查 → 分配下一个任务**
...（重复流程）

---

## Eden's Responsibilities as Main Agent

### 1. Planning & Decomposition
- Understand user requirements
- Break down into subtasks
- Define dependencies between tasks
- Estimate complexity

### 2. Task Assignment
- Clear, specific prompts to OpenCode
- Provide necessary context
- Set expectations

### 3. Code Review Checklist
```python
# Quality检查
- [ ] 代码结构清晰
- [ ] 命名规范
- [ ] 注释充分
- [ ] 类型提示

# 安全检查
- [ ] 输入验证
- [ ] SQL注入防护
- [ ] XSS防护
- [ ] 敏感数据加密

# 性能检查
- [ ] 无明显性能问题
- [ ] 资源管理正确
- [ ] 数据库优化

# 测试检查
- [ ] 单元测试覆盖
- [ ] 边界情况处理
- [ ] 错误处理完整
```

### 4. Verification
- Test generated code
- Verify it meets requirements
- Check integration points
- Document results

### 5. Final Approval
- Ensure all requirements met
- Document the solution
- Provide summary to user

---

## Workflow Examples

### 1. Create a New Feature

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Add user authentication with JWT'"
```

### 2. Fix a Bug

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Fix the memory leak in the data processor'"
```

### 3. Explain Code

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Explain what the main.py file does'"
```

### 4. Refactor Code

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Refactor the user module to follow SOLID principles'"
```

### 5. Write Tests

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Write unit tests for the payment module with pytest'"
```

### 6. Review Code

```bash
bash pty:true workdir:~/my-app command:"opencode run 'Review the PR changes and suggest improvements'"
```

## Using with MT5 Projects

### Create a Trading Strategy Script

```bash
bash pty:true workdir:~/mt5-strategies command:"opencode run 'Create a Python script that implements a moving average crossover strategy for MT5 using MetaTrader5 library. Include entry/exit logic and position management.'"
```

### Generate Technical Indicators

```bash
bash pty:true workdir:~/mt5-strategies command:"opencode run 'Write Python functions for RSI, MACD, and Bollinger Bands indicators using pandas'"
```

## Important Notes

### ⚠️ When to Call OpenCode (Sub-agent)

Eden should call OpenCode for:
- ✅ Writing implementation code
- ✅ Creating new files/functions
- ✅ Refactoring existing code
- ✅ Writing unit tests
- ✅ Generating boilerplate code

**Eden handles independently:**
- ✅ Planning and architecture
- ✅ Task decomposition
- ✅ Code review
- ✅ Testing and verification
- ✅ Documentation
- ✅ Integration

### 📌 Example Good Prompts from Eden

```bash
# ❌ Too vague - OpenCode may return generic code
opencode run "写个交易策略"

# ✅ Specific - Clear requirements
opencode run "创建Python文件strategy.py，包含以下函数：
1. calculate_sma(data, period) - 计算简单移动平均
2. check_crossover(short_ma, long_ma) - 检测交叉信号
3. generate_signal(tick) - 生成交易信号
使用pandas和numpy，添加文档字符串和类型提示"
```

### PTY Mode Required ⚠️

Always use `pty:true` when running OpenCode - it's an interactive CLI:

```bash
# ✅ Correct - with PTY
bash pty:true workdir:~/project command:"opencode run 'Your prompt'"

# ❌ Wrong - no PTY, output may break
bash command:"opencode run 'Your prompt'"
```

### Workdir Context

Set `workdir` to give OpenCode access to your code:

```bash
# OpenCode sees only this folder
bash pty:true workdir:~/my-project command:"opencode run 'Analyze the code structure'"
```

## Common Programming Tasks

### Python
- Web apps (Flask, FastAPI, Django)
- Data analysis (pandas, numpy)
- Trading algorithms

### JavaScript/TypeScript
- React/Vue/Angular apps
- Node.js APIs
- Web automation

### Other Languages
- Go, Rust, Java, C#, etc.

## Example Prompts

| Task | Example Prompt |
|------|----------------|
| API | "Create a REST API with FastAPI that has user CRUD endpoints" |
| Database | "Add SQLAlchemy models for User, Order, and Product tables" |
| Frontend | "Build a React dashboard component that displays trading charts" |
| Algorithm | "Implement a binary search tree with insert, delete, and search methods" |
| Testing | "Write comprehensive unit tests for the calculator module using pytest" |
| Documentation | "Generate docstrings and type hints for all functions in utils.py" |

## Limitations

- OpenCode generates code - it doesn't execute/compile it
- Always review generated code before using in production
- Test thoroughly, especially for trading/financial code
- May need follow-up prompts to refine output

## Tips

### For Eden (Main Agent)
1. **Be specific**: Clear, detailed prompts for OpenCode
2. **Review thoroughly**: Don't blindly accept generated code
3. **Iterate**: Break complex tasks into smaller chunks
4. **Verify**: Always test before final approval
5. **Document**: Keep track of what was built

### When OpenCode Returns Code
```python
# Eden's review process:
1. Read and understand the code
2. Check for:
   - Functionality (does it do what was asked?)
   - Quality (clean, readable, maintainable?)
   - Security (vulnerabilities, injection risks?)
   - Performance (any obvious issues?)
3. Test if possible
4. Request changes if needed
5. Approve and integrate if good
```

## Summary

| Aspect | Eden | OpenCode |
|--------|------|----------|
| **Role** | Main Agent | Sub-agent |
| **Responsibility** | Plan → Assign → Review → Verify | Generate code |
| **Decision Making** | ✅ Yes | ❌ No |
| **Code Review** | ✅ Yes | ❌ No |
| **Final Approval** | ✅ Yes | ❌ No |
| **Code Generation** | ❌ | ✅ Yes |

---

## Tips

1. **Be specific**: Describe what you want in detail
2. **Provide context**: Set workdir to your project folder
3. **Iterate**: Use interactive mode for complex tasks
4. **Review**: Always check generated code
5. **Test**: Run and test the code before deploying