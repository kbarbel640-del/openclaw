/**
 * Feishu 长连接测试脚本 (基于官方文档)
 * 运行: npx tsx src/feishu/test-ws.ts
 */

import * as Lark from "@larksuiteoapi/node-sdk";

const APP_ID = "cli_a9f608f133781bcc";
const APP_SECRET = "Dta7m0KJVrsXXFKW51OOTd6px1elOk7f";

async function main() {
    console.log("🔌 飞书长连接测试 (官方文档版)\n");

    // 1. 创建 WSClient
    console.log("1️⃣ 创建 WebSocket 客户端...");
    const wsClient = new Lark.WSClient({
        appId: APP_ID,
        appSecret: APP_SECRET,
        loggerLevel: Lark.LoggerLevel.debug,
    });

    // 2. 创建 EventDispatcher 并注册事件
    console.log("2️⃣ 创建事件处理器...");
    const eventDispatcher = new Lark.EventDispatcher({}).register({
        // 监听消息接收事件
        "im.message.receive_v1": async (data) => {
            console.log("\n📨 收到消息:");
            console.log(`   数据: ${JSON.stringify(data, null, 2)}`);

            // 返回处理结果
            return {};
        },
    });

    // 3. 启动长连接 - 关键：eventDispatcher 传给 start()
    console.log("3️⃣ 启动长连接...\n");

    wsClient.start({ eventDispatcher });

    console.log("✅ 客户端已启动！等待连接...");
    console.log("📋 如果连接成功，控制台会打印 [info]: [ '[ws]', 'ws client ready' ]");
    console.log("\n💡 提示：");
    console.log("   - 确保在飞书开放平台已选择「使用长连接接收事件」");
    console.log("   - 添加事件订阅 im.message.receive_v1");
    console.log("   - 开启相应权限\n");
}

main();
