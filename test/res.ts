// server_8400.ts
import express from "express";
import type { Request, Response } from "express";

const app = express();

app.set("trust proxy", true);
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// 모든 메서드/모든 경로 수신
app.use((req: Request, res: Response) => {
  console.log("\n=== Incoming Request ===");
  console.log("Method:", req.method);
  console.log("Path:", req.originalUrl);
  console.log("Remote:", req.ip);
  console.log("Headers:", req.headers);

  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  console.log("Body (raw):");
  console.log(raw);

  // 카카오 스킬 테스트까지 겸하려면 아래처럼 2.0 응답이 무난
  res.status(200).json({
    version: "2.0",
    template: { outputs: [{ simpleText: { text: "ok" } }] },
  });
});

app.listen(8400, "0.0.0.0", () => {
  console.log("Listening on http://0.0.0.0:8400");
});
