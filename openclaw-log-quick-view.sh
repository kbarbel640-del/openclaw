#!/bin/bash
# OpenClaw 日志快速查看脚本
# 快速提取和显示对话流程的关键信息

LOG_FILE="${1:-logs/openclaw-$(date +%Y-%m-%d).log}"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 错误: 找不到日志文件 $LOG_FILE"
    exit 1
fi

echo "📖 正在分析日志: $LOG_FILE"
echo "=" | awk '{printf "%100s\n", ""}' | tr ' ' '='

# 提取用户查询
echo -e "\n👤 用户查询:"
grep "user query:" "$LOG_FILE" | jq -r '[.time, .["1"].fullPrompt] | @tsv' | while IFS=$'\t' read -r time query; do
    timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${time:0:19}" "+%H:%M:%S" 2>/dev/null || echo "${time:11:8}")
    echo "  [$timestamp] $query"
done

# 提取大模型思考
echo -e "\n🧠 大模型思考:"
grep "assistant thinking:" "$LOG_FILE" | jq -r '[.time, .["1"].fullThinking] | @tsv' | while IFS=$'\t' read -r time thinking; do
    timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${time:0:19}" "+%H:%M:%S" 2>/dev/null || echo "${time:11:8}")
    echo "  [$timestamp]"
    echo "$thinking" | sed 's/^/    /'
done

# 提取工具调用
echo -e "\n🔧 工具调用:"
grep "tool call start:" "$LOG_FILE" | while read -r line; do
    time=$(echo "$line" | jq -r '.time')
    message=$(echo "$line" | jq -r '.["2"]')
    timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${time:0:19}" "+%H:%M:%S" 2>/dev/null || echo "${time:11:8}")
    
    # 解析工具名称和ID
    if [[ $message =~ tool\ call\ start:\ ([a-z_]+)\ runId=([^\ ]+)\ toolCallId=([^\ ]+) ]]; then
        tool_name="${BASH_REMATCH[1]}"
        tool_id="${BASH_REMATCH[3]}"
        echo "  [$timestamp] $tool_name (ID: $tool_id)"
    fi
done

# 提取工具调用参数（从 assistant tool calls）
echo -e "\n📋 工具调用详情:"
grep "assistant tool calls:" "$LOG_FILE" | jq -r '.["1"].toolCalls[]? | "  工具: \(.name)\n  参数: \(.input | tostring)"' 2>/dev/null

# 提取工具结果
echo -e "\n📦 工具执行结果:"
grep "tool call end:" "$LOG_FILE" | while read -r line; do
    time=$(echo "$line" | jq -r '.time')
    message=$(echo "$line" | jq -r '.["2"]')
    timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${time:0:19}" "+%H:%M:%S" 2>/dev/null || echo "${time:11:8}")
    
    # 解析工具名称、错误状态和预览
    if [[ $message =~ tool\ call\ end:\ ([a-z_]+).*isError=([a-z]+) ]]; then
        tool_name="${BASH_REMATCH[1]}"
        is_error="${BASH_REMATCH[2]}"
        
        status="✅"
        [ "$is_error" = "true" ] && status="❌"
        
        echo "  [$timestamp] $status $tool_name"
        
        # 提取预览
        if [[ $message =~ preview=(.+)$ ]]; then
            preview="${BASH_REMATCH[1]}"
            echo "    结果: ${preview:0:100}..."
        fi
    fi
done

# 提取大模型回复
echo -e "\n🤖 大模型回复:"
grep "assistant reply:" "$LOG_FILE" | jq -r '[.time, .["1"].fullReply] | @tsv' | while IFS=$'\t' read -r time reply; do
    timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${time:0:19}" "+%H:%M:%S" 2>/dev/null || echo "${time:11:8}")
    echo "  [$timestamp]"
    echo "$reply" | sed 's/^/    /'
done

echo -e "\n" | awk '{printf "%100s\n", ""}' | tr ' ' '='
echo "✅ 分析完成"
