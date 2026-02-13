@echo off
REM OpenCode Coder - Windows Quick Launcher
REM Use OpenCode CLI to generate and analyze code

set OPENCODE_CMD=opencode run

if "%1"=="" goto :menu
if "%1"=="--help" goto :help
goto :run

:menu
echo ======================================
echo   OpenCode Coder - 代码生成助手
echo ======================================
echo.
echo 用法: opencode-coder "你的提示词" [工作目录]
echo.
echo 示例:
echo   opencode-coder "创建Flask REST API"
echo   opencode-coder "修复bug" C:\Users\User\myproject
echo.
echo 常见任务:
echo   opencode-coder "写Python脚本实现均线策略"
echo   opencode-coder "创建React组件"
echo   opencode-coder "分析代码结构和问题"
echo.
goto :end

:help
echo ======================================
echo   OpenCode Coder 帮助
echo ======================================
echo.
echo 提示词技巧:
echo   1. 要具体 - 描述清楚要做什么
echo   2. 包含技术栈 - 指定语言/框架
echo   3. 上下文 - 在项目目录中使用
echo.
echo 示例提示词:
echo   - "用FastAPI创建用户管理系统，包含CRUD接口"
echo   - "写Python脚本从MT5获取市场数据"
echo   - "创建React仪表盘显示交易图表"
echo   - "修复auth.py中的认证漏洞"
echo.

:run
set PROMPT=%~1
set WORKDIR=%~2

if "%PROMPT%"=="" (
    echo 错误: 请提供提示词
    echo 用法: opencode-coder "提示词" [工作目录]
    goto :end
)

echo.
echo ======================================
echo   OpenCode Coder
echo ======================================
echo 任务: %PROMPT%
echo.

if "%WORKDIR%"=="" (
    echo 工作目录: 当前目录
    echo.
    %OPENCODE_CMD% "%PROMPT%"
) else (
    echo 工作目录: %WORKDIR%
    echo.
    %OPENCODE_CMD% --context "%WORKDIR%" "%PROMPT%"
)

:end
