#!/bin/bash

# 千问 API Key 支持测试脚本
# 使用方法: ./test-qwen-apikey.sh

set -e

echo "🚀 千问 API Key 支持测试脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在 OpenClaw 项目根目录运行此脚本${NC}"
    exit 1
fi

echo "📝 步骤 1: 检查修改的文件..."
echo ""

# 检查文件是否被修改
files=(
    "src/agents/model-auth.ts"
    "extensions/qwen-portal-auth/index.ts"
    "src/commands/auth-choice.apply.qwen-portal.ts"
    "src/commands/onboard-types.ts"
    "src/commands/auth-choice-options.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file 存在"
    else
        echo -e "${RED}✗${NC} $file 不存在"
        exit 1
    fi
done

echo ""
echo "🔍 步骤 2: 验证代码修改..."
echo ""

# 检查 model-auth.ts 是否包含 QWEN_API_KEY
if grep -q "QWEN_API_KEY" "src/agents/model-auth.ts"; then
    echo -e "${GREEN}✓${NC} model-auth.ts 已添加 QWEN_API_KEY 支持"
else
    echo -e "${RED}✗${NC} model-auth.ts 缺少 QWEN_API_KEY"
    exit 1
fi

# 检查 index.ts 是否包含 api-key 方法
if grep -q "id: \"api-key\"" "extensions/qwen-portal-auth/index.ts"; then
    echo -e "${GREEN}✓${NC} qwen-portal-auth 已添加 API Key 认证方法"
else
    echo -e "${RED}✗${NC} qwen-portal-auth 缺少 API Key 方法"
    exit 1
fi

# 检查是否包含国际版端点
if grep -q "dashscope-intl.aliyuncs.com" "extensions/qwen-portal-auth/index.ts"; then
    echo -e "${GREEN}✓${NC} 已配置国际版端点"
else
    echo -e "${RED}✗${NC} 缺少国际版端点配置"
    exit 1
fi

# 检查 onboard-types.ts 是否包含 qwen-api-key
if grep -q '"qwen-api-key"' "src/commands/onboard-types.ts"; then
    echo -e "${GREEN}✓${NC} onboard-types.ts 已添加 qwen-api-key 类型"
else
    echo -e "${RED}✗${NC} onboard-types.ts 缺少 qwen-api-key 类型"
    exit 1
fi

# 检查 auth-choice-options.ts 是否包含 qwen-api-key 选项
if grep -q 'value: "qwen-api-key"' "src/commands/auth-choice-options.ts"; then
    echo -e "${GREEN}✓${NC} auth-choice-options.ts 已添加 qwen-api-key 选项"
else
    echo -e "${RED}✗${NC} auth-choice-options.ts 缺少 qwen-api-key 选项"
    exit 1
fi

echo ""
echo "🔨 步骤 3: 编译项目..."
echo ""

# 编译项目
if npm run build; then
    echo -e "${GREEN}✓${NC} 编译成功"
else
    echo -e "${RED}✗${NC} 编译失败"
    exit 1
fi

echo ""
echo "✅ 所有检查通过！"
echo ""
echo "================================"
echo "📚 下一步操作："
echo ""
echo "1. 设置环境变量（可选）："
echo "   ${YELLOW}export QWEN_API_KEY=\"sk-你的密钥\"${NC}"
echo ""
echo "2. 配置认证："
echo "   ${YELLOW}openclaw models auth login --provider qwen-portal${NC}"
echo "   - 选择 'Qwen API Key'"
echo "   - 选择 'International (Singapore)'"
echo "   - 输入你的 API Key"
echo ""
echo "3. 测试调用："
echo "   ${YELLOW}openclaw chat \"你好\"${NC}"
echo ""
echo "4. 查看可用模型："
echo "   ${YELLOW}openclaw models list${NC}"
echo ""
echo "详细文档请查看: QWEN_API_KEY_GUIDE.md"
echo "================================"
