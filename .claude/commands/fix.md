---
description: 修复跨模块兼容性问题
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## 任务：修复兼容性问题

用户描述的问题：$ARGUMENTS

### 步骤
1. 读取 INTERFACES.md，了解所有模块当前的接口
2. 读取 STATE.md 的"已知问题"部分
3. 定位问题涉及的所有文件
4. 分析根因（命名不一致？类型不匹配？接口变了？缺少字段？）
5. 修复代码，确保所有引用该接口的地方都同步更新
6. 如果修复改变了某个模块的公开接口，同步更新 INTERFACES.md
7. 运行 pytest 确认修复没有引入新问题
8. 如果 STATE.md 的"已知问题"中有相关条目，修复后删除它
9. git add 改动的文件，展示 git diff 让用户确认
10. 等用户确认后 git commit -m "fix: 修复简述"
