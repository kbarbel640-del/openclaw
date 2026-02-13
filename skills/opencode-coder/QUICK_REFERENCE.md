# OpenCode Coder Quick Reference

## Command Summary

### Basic Usage
```bash
opencode run "Your coding prompt"
```

### With Options
```bash
opencode run "Prompt" --title "My Session" --model claude/sonnet
```

### Interactive Mode (TUI)
```bash
opencode ~/project
```

### Web Interface
```bash
opencode web
```

## Quick Examples

### Python Trading Strategy
```bash
opencode run "Create a Python script that implements a moving average crossover trading strategy using pandas. Include functions for calculate_MA, check_signals, and backtest."
```

### React Component
```bash
opencode run "Create a React component for a trading dashboard that displays a real-time chart using Chart.js"
```

### Bug Fix
```bash
opencode run "Fix the error in the following code: [paste code]"
```

### Code Explanation
```bash
opencode run "Explain what this function does and identify potential issues: [paste code]"
```

## For OpenClaw

Always use PTY mode when running through OpenClaw:

```bash
bash pty:true workdir:~/project command:"opencode run 'Your task'"
```