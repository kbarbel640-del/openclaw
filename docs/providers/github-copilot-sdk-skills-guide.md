---
summary: "Complete guide to extending OpenClaw with custom skills when using GitHub Copilot SDK"
read_when:
  - You want to add custom capabilities to your Copilot-powered agent
  - You need to create custom tools and integrations
  - You want to extend OpenClaw functionality
---
# Extending OpenClaw with Skills: Complete Guide

This comprehensive guide shows you how to extend your GitHub Copilot SDK-powered OpenClaw agent with custom skills, tools, and integrations.

## Table of Contents

1. [Understanding Skills](#understanding-skills)
2. [Quick Start: Your First Skill](#quick-start-your-first-skill)
3. [Skill Structure and Format](#skill-structure-and-format)
4. [Advanced Skills](#advanced-skills)
5. [Integrating External APIs](#integrating-external-apis)
6. [Tool Definitions](#tool-definitions)
7. [Best Practices](#best-practices)
8. [Publishing and Sharing](#publishing-and-sharing)

## Understanding Skills

### What Are Skills?

Skills are modular extensions that teach your agent how to perform specific tasks. Think of them as "plugins" that add new capabilities.

**Key components**:
- **SKILL.md**: Instructions and tool definitions for the LLM
- **Scripts**: Optional executables (bash, Python, Node.js)
- **Resources**: Config files, data, or assets
- **Metadata**: Configuration for skill behavior

### How Skills Work with Copilot SDK

When you use Copilot models (GPT-4o, o1, Claude, etc.):

1. OpenClaw loads all enabled skills
2. Skills are injected into the model's context
3. The model can invoke tools defined in skills
4. Tool results are passed back to the model
5. The model generates responses using tool outputs

**Important**: Skills work with **any** model in your Copilot subscription. The skill instructions adapt to different model capabilities.

### Skill Locations

Skills are loaded from (in precedence order):

1. **Workspace skills**: `~/.openclaw/workspace/skills/` (per-agent)
2. **Managed skills**: `~/.openclaw/skills/` (shared across agents)
3. **Bundled skills**: Shipped with OpenClaw
4. **Plugin skills**: From installed plugins

To create a skill for your Copilot-powered agent:
```bash
mkdir -p ~/.openclaw/workspace/skills/my-skill
```

## Quick Start: Your First Skill

### Example 1: Simple Greeting Skill

Create `~/.openclaw/workspace/skills/custom-greeting/SKILL.md`:

```markdown
---
name: custom_greeting
description: Greet users with custom messages based on time of day
---

# Custom Greeting Skill

You can greet users with time-appropriate messages.

## Instructions

When a user asks for a greeting or says hello:
1. Check the current time using the bash tool: `date +%H`
2. Based on the hour:
   - 5-11: "Good morning!"
   - 12-16: "Good afternoon!"
   - 17-21: "Good evening!"
   - 22-4: "Hello, night owl!"

Example:
User: "greet me"
You: Use bash to get the hour, then respond with the appropriate greeting.
```

**Test it**:
```bash
openclaw agent --message "greet me"
```

The model will use the bash tool to get the time and respond appropriately.

### Example 2: Calculator Skill

Create `~/.openclaw/workspace/skills/calculator/SKILL.md`:

```markdown
---
name: advanced_calculator
description: Perform complex mathematical calculations
---

# Advanced Calculator

You can help users with mathematical calculations of any complexity.

## Instructions

For math problems:
1. Simple arithmetic: Calculate directly
2. Complex expressions: Use the bash tool with `bc` or `python3 -c`
3. Scientific calculations: Use Python's math module

Examples:

**Simple**: "What's 15 * 23?"
→ 345

**Complex**: "Calculate sqrt(144) + log(100)"
→ Use: `python3 -c "import math; print(math.sqrt(144) + math.log10(100))"`

**Matrix operations**: Use Python with numpy if needed

Always show your work and explain the steps.
```

**Test it**:
```bash
openclaw agent --message "Calculate the square root of 12345"
```

### Example 3: Web Search Skill

Create `~/.openclaw/workspace/skills/web-search/SKILL.md`:

```markdown
---
name: web_search
description: Search the web for current information
---

# Web Search Skill

You can search the web to find current information.

## Instructions

When users ask about current events, recent data, or need up-to-date information:

Use the `web_search` tool with a clear query.

Example:
User: "What's the weather in Seattle?"
You: `web_search("current weather Seattle Washington")`

The tool returns relevant search results which you should summarize for the user.

## Best Practices

- Be specific in search queries
- Use quotes for exact phrases: `web_search("\"Anthropic Claude 3\"")`
- Combine results from multiple searches for comprehensive answers
- Always cite sources when presenting information
```

**Note**: The `web_search` tool is a bundled tool in OpenClaw. This skill just teaches the model when and how to use it effectively.

## Skill Structure and Format

### Complete SKILL.md Template

```markdown
---
name: skill_identifier
description: Brief description of what this skill does
homepage: https://example.com/skill-docs
user-invocable: true
disable-model-invocation: false
metadata: {"openclaw": {"requires": {"config": ["api.key"], "env": ["API_KEY"]}, "version": "1.0.0"}}
---

# Skill Display Name

Brief overview of what this skill enables.

## Purpose

Detailed explanation of the skill's purpose and use cases.

## Instructions

Step-by-step instructions for the model on how to use this skill.

### When to Use

Describe scenarios when this skill should be activated.

### How to Use

Detailed usage instructions with examples.

## Tools

If you define custom tools, describe them here:

### tool_name

**Parameters**:
- `param1` (string): Description
- `param2` (number, optional): Description

**Returns**: What the tool returns

**Example**:
\`\`\`
tool_name(param1="value", param2=123)
\`\`\`

## Examples

Provide multiple examples showing the skill in action.

## Limitations

Document any limitations or edge cases.

## Configuration

Explain any required configuration or environment variables.
```

### Metadata Fields

**Frontmatter options**:

```yaml
---
name: unique_skill_id  # Required: lowercase, hyphens/underscores only
description: One-line description  # Required
homepage: https://example.com  # Optional: link to docs
user-invocable: true  # Optional: allow /slash commands
disable-model-invocation: false  # Optional: hide from model
command-dispatch: tool  # Optional: direct slash command to tool
command-tool: tool_name  # Optional: tool to invoke
command-arg-mode: raw  # Optional: arg parsing mode
metadata: {"key": "value"}  # Optional: JSON metadata
---
```

**Metadata JSON structure**:

```json
{
  "openclaw": {
    "requires": {
      "config": ["path.to.config"],  // Required config keys
      "env": ["ENV_VAR"],  // Required environment variables
      "bins": ["command"]  // Required executables
    },
    "version": "1.0.0",
    "author": "Your Name",
    "license": "MIT",
    "homepage": "https://example.com"
  }
}
```

## Advanced Skills

### Using External Scripts

Create `~/.openclaw/workspace/skills/github-api/SKILL.md`:

```markdown
---
name: github_api
description: Interact with GitHub repositories
metadata: {"openclaw": {"requires": {"env": ["GITHUB_TOKEN"]}}}
---

# GitHub API Skill

You can query GitHub repositories and get information about issues, PRs, and code.

## Instructions

Use the bash tool to execute `gh` (GitHub CLI) commands.

### Common Operations

**List repository issues**:
\`\`\`bash
gh issue list --repo owner/repo --limit 10
\`\`\`

**Get issue details**:
\`\`\`bash
gh issue view 123 --repo owner/repo
\`\`\`

**Search code**:
\`\`\`bash
gh search code "function query" --repo owner/repo
\`\`\`

**Get repository info**:
\`\`\`bash
gh repo view owner/repo
\`\`\`

## Authentication

Requires `GITHUB_TOKEN` environment variable or `gh auth login`.

## Examples

User: "List open issues in openclaw/openclaw"
You: Execute `gh issue list --repo openclaw/openclaw --state open --limit 10`
```

**Setup**:
```bash
# Install gh CLI
brew install gh  # or: apt install gh

# Authenticate
gh auth login

# Test the skill
openclaw agent --message "List issues in openclaw/openclaw"
```

### Skills with Python Scripts

Create `~/.openclaw/workspace/skills/data-analysis/SKILL.md`:

```markdown
---
name: data_analysis
description: Analyze CSV data and generate visualizations
---

# Data Analysis Skill

You can analyze CSV files and create visualizations.

## Instructions

Use the provided Python script for data analysis:

\`\`\`bash
python3 {baseDir}/analyze.py --input <file> --output <output>
\`\`\`

The `{baseDir}` placeholder is automatically replaced with the skill directory path.

## Capabilities

- Load CSV/Excel files
- Generate statistics (mean, median, mode, std)
- Create plots (line, bar, scatter)
- Export results to JSON/CSV

## Example

User: "Analyze sales_data.csv"
You:
1. Check file exists
2. Run: `python3 {baseDir}/analyze.py --input sales_data.csv --output analysis.json`
3. Read analysis.json
4. Summarize findings
```

Create `~/.openclaw/workspace/skills/data-analysis/analyze.py`:

```python
#!/usr/bin/env python3
import sys
import json
import pandas as pd
import argparse

def analyze_data(input_file, output_file):
    # Load data
    df = pd.read_csv(input_file)
    
    # Generate statistics
    stats = {
        "rows": len(df),
        "columns": list(df.columns),
        "summary": df.describe().to_dict(),
        "missing": df.isnull().sum().to_dict()
    }
    
    # Save results
    with open(output_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"Analysis complete: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    analyze_data(args.input, args.output)
```

**Make it executable**:
```bash
chmod +x ~/.openclaw/workspace/skills/data-analysis/analyze.py
```

### Skills with API Integration

Create `~/.openclaw/workspace/skills/weather-api/SKILL.md`:

```markdown
---
name: weather_api
description: Get current weather and forecasts
metadata: {"openclaw": {"requires": {"env": ["WEATHER_API_KEY"]}}}
---

# Weather API Skill

Get current weather and forecasts for any location.

## Instructions

Use curl to query the weather API:

\`\`\`bash
curl -s "https://api.weatherapi.com/v1/current.json?key=$WEATHER_API_KEY&q=<location>"
\`\`\`

Parse the JSON response and present the information clearly.

## Response Format

Present weather data as:
- Location: City, Country
- Temperature: X°C (Y°F)
- Condition: Description
- Humidity: X%
- Wind: X km/h direction

## Examples

User: "What's the weather in London?"
You:
1. Execute curl command with location="London"
2. Parse JSON response
3. Format and present weather information

## API Setup

1. Get free API key from https://weatherapi.com
2. Set environment variable: `export WEATHER_API_KEY="your-key"`
```

**Setup**:
```bash
# Get API key from weatherapi.com
export WEATHER_API_KEY="your-key-here"

# Add to ~/.profile or ~/.bashrc
echo 'export WEATHER_API_KEY="your-key"' >> ~/.profile
```

## Integrating External APIs

### General Pattern for API Skills

1. **Document authentication** in metadata and instructions
2. **Use curl or language-specific HTTP clients**
3. **Parse responses** and format for readability
4. **Handle errors gracefully**
5. **Respect rate limits**

### Example: REST API Integration

```markdown
---
name: api_service
description: Interact with custom REST API
metadata: {"openclaw": {"requires": {"env": ["API_URL", "API_KEY"]}}}
---

# API Service Skill

## Instructions

Make API requests using curl:

### GET Request
\`\`\`bash
curl -s -H "Authorization: Bearer $API_KEY" "$API_URL/endpoint"
\`\`\`

### POST Request
\`\`\`bash
curl -s -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' \
  "$API_URL/endpoint"
\`\`\`

### Error Handling

Check curl exit code:
\`\`\`bash
response=$(curl -s -w "\\n%{http_code}" "$API_URL/endpoint")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" != "200" ]; then
  echo "API error: HTTP $http_code"
fi
\`\`\`
```

## Tool Definitions

### Custom Tool Format

Skills can define custom tools in the metadata:

```markdown
---
name: custom_tools_skill
description: Skill with custom tool definitions
metadata: {
  "openclaw": {
    "tools": [
      {
        "name": "custom_tool",
        "description": "Does something custom",
        "parameters": {
          "type": "object",
          "properties": {
            "input": {"type": "string", "description": "Input data"},
            "mode": {"type": "string", "enum": ["fast", "accurate"]}
          },
          "required": ["input"]
        }
      }
    ]
  }
}
---

# Custom Tool Skill

Instructions for using the custom_tool...
```

### Tool Execution

When the model invokes `custom_tool`:
1. OpenClaw looks for `~/.openclaw/workspace/skills/custom_tools_skill/tool-handler.js`
2. Executes the handler with tool parameters
3. Returns the result to the model

Example `tool-handler.js`:

```javascript
#!/usr/bin/env node

const params = JSON.parse(process.argv[2]);

function customTool(params) {
  const { input, mode = 'fast' } = params;
  
  // Your tool logic here
  const result = processInput(input, mode);
  
  return {
    success: true,
    result: result,
    metadata: { mode, timestamp: Date.now() }
  };
}

console.log(JSON.stringify(customTool(params)));
```

**Make executable**:
```bash
chmod +x ~/.openclaw/workspace/skills/custom_tools_skill/tool-handler.js
```

## Best Practices

### 1. Clear Instructions

**Good**:
```markdown
When the user asks about weather:
1. Use curl to fetch data from the API
2. Parse the JSON response
3. Present temperature, conditions, and humidity
```

**Bad**:
```markdown
You are a helpful weather assistant. Be friendly and provide weather information when asked.
```

### 2. Provide Examples

Always include example interactions:

```markdown
## Examples

**Example 1**:
User: "What's the temperature in Paris?"
You: Execute curl command → Parse response → "It's 18°C in Paris with clear skies"

**Example 2**:
User: "Will it rain tomorrow in Tokyo?"
You: Execute forecast curl → Parse → "40% chance of rain tomorrow in Tokyo"
```

### 3. Handle Edge Cases

Document error handling:

```markdown
## Error Handling

If API returns an error:
- Check the error message in the response
- Inform the user clearly
- Suggest alternatives if available

If location is not found:
- Ask user to be more specific
- Suggest similar location names if available
```

### 4. Security

```markdown
## Security Notes

- Never log or display API keys
- Validate all user inputs before passing to commands
- Use parameterized queries for database access
- Sanitize file paths to prevent directory traversal
```

### 5. Model Compatibility

Skills work best when they:
- Are clear and concise
- Provide step-by-step instructions
- Include examples for different scenarios
- Specify which tools to use and when

**Copilot models** (GPT-4o, o1, Claude) handle complex instructions well, so you can provide detailed guidance.

## Publishing and Sharing

### Using ClawHub

ClawHub is the public skills registry for OpenClaw.

**Publish your skill**:

1. **Create account**: Visit https://clawhub.com

2. **Prepare skill**:
   ```bash
   cd ~/.openclaw/workspace/skills/my-skill
   ```

3. **Create manifest**:
   ```bash
   clawhub init
   ```

4. **Test locally**:
   ```bash
   openclaw agent --message "test my skill"
   ```

5. **Publish**:
   ```bash
   clawhub publish
   ```

### Skill README

Include a `README.md` in your skill directory:

```markdown
# My Custom Skill

Brief description of what the skill does.

## Installation

\`\`\`bash
clawhub install username/my-skill
\`\`\`

## Configuration

Set required environment variables:
\`\`\`bash
export API_KEY="your-key"
\`\`\`

## Usage

Examples of how to use the skill:
\`\`\`
openclaw agent --message "example usage"
\`\`\`

## License

MIT
```

### Version Control

Keep your skills in git:

```bash
cd ~/.openclaw/workspace/skills/my-skill
git init
git add .
git commit -m "Initial skill"
git remote add origin https://github.com/username/my-skill
git push -u origin main
```

## Advanced Topics

### Skill Dependencies

Skills can depend on other skills:

```markdown
---
name: composite_skill
description: Skill that uses other skills
metadata: {
  "openclaw": {
    "requires": {
      "skills": ["weather_api", "github_api"]
    }
  }
}
---

# Composite Skill

This skill combines weather and GitHub data.

## Instructions

Use the weather_api skill to get weather, then use github_api to check for weather-related issues.
```

### Conditional Skills

Enable skills based on config:

```json5
{
  "skills": {
    "entries": {
      "production_only": {
        "enabled": false  // Disable in development
      }
    }
  }
}
```

### Skill Gating

Control which models can use which skills:

```json5
{
  "skills": {
    "entries": {
      "advanced_coding": {
        "enabledModels": ["github-copilot/o1", "github-copilot/gpt-4o"]
      }
    }
  }
}
```

## Examples Repository

Find more examples at:
- https://github.com/openclaw/skills-examples
- https://clawhub.com/browse
- `~/.openclaw/bundled-skills/` (shipped with OpenClaw)

## Troubleshooting

**Skill not loading**:
```bash
# List loaded skills
openclaw skills list

# Refresh skills
openclaw agent --message "refresh skills"
```

**Tool not working**:
```bash
# Test tool directly
~/.openclaw/workspace/skills/my-skill/tool-handler.js '{"param": "value"}'

# Check permissions
chmod +x ~/.openclaw/workspace/skills/my-skill/*.js
```

**Debugging**:
```bash
# Verbose mode shows skill loading
openclaw gateway run --dev

# Check logs
tail -f ~/.openclaw/logs/gateway.log
```

## Next Steps

1. **Start simple**: Create a basic skill with bash commands
2. **Iterate**: Add more capabilities as needed
3. **Test thoroughly**: Try edge cases and error scenarios
4. **Share**: Publish to ClawHub for others to use
5. **Learn from others**: Browse existing skills for patterns

## Quick Reference

| Task | Command |
|------|---------|
| Create skill directory | `mkdir -p ~/.openclaw/workspace/skills/name` |
| List skills | `openclaw skills list` |
| Install from ClawHub | `clawhub install skill-name` |
| Publish to ClawHub | `clawhub publish` |
| Test skill | `openclaw agent --message "test"` |
| Reload skills | `openclaw gateway restart` |

---

You now have everything you need to extend your Copilot SDK-powered OpenClaw agent with custom skills! Start with simple skills and gradually build more complex integrations as you become comfortable with the patterns.
