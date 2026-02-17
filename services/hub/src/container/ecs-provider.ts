import { randomBytes } from "node:crypto";
import type { ContainerProvider, SpawnResult, StartResult, RestartResult } from "./provider.js";
import { generateDeviceIdentity, buildPairedDevicesJson } from "../gateway/device-auth.js";

type ECSClient = import("@aws-sdk/client-ecs").ECSClient;
type CloudWatchLogsClient = import("@aws-sdk/client-cloudwatch-logs").CloudWatchLogsClient;

function requireEcsEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`ECS provider requires environment variable: ${key}`);
  }
  return val;
}

// Forward LLM provider keys from the hub's env to spawned containers
function getPassthroughEnv(): Array<{ name: string; value: string }> {
  const keys = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "CLAUDE_AI_SESSION_KEY",
    "CLAUDE_WEB_SESSION_KEY",
    "CLAUDE_WEB_COOKIE",
  ];
  const env: Array<{ name: string; value: string }> = [];
  for (const key of keys) {
    const val = process.env[key];
    if (val) {
      env.push({ name: key, value: val });
    }
  }
  return env;
}

/** Extract task ID from a full task ARN. */
function taskIdFromArn(arn: string): string {
  // arn:aws:ecs:region:account:task/cluster/taskId
  const parts = arn.split("/");
  return parts[parts.length - 1];
}

export class EcsProvider implements ContainerProvider {
  private ecs!: ECSClient;
  private logs!: CloudWatchLogsClient;
  private cluster: string;
  private taskDefinition: string;
  private subnets: string[];
  private securityGroups: string[];
  private logGroup: string;
  private efsFileSystemId: string;

  constructor() {
    this.cluster = requireEcsEnv("ECS_CLUSTER");
    this.taskDefinition = requireEcsEnv("ECS_TASK_DEFINITION");
    this.subnets = requireEcsEnv("ECS_SUBNETS").split(",");
    this.securityGroups = requireEcsEnv("ECS_SECURITY_GROUPS").split(",");
    this.logGroup = requireEcsEnv("ECS_LOG_GROUP");
    this.efsFileSystemId = requireEcsEnv("ECS_EFS_FILE_SYSTEM_ID");
  }

  private async getEcs(): Promise<ECSClient> {
    if (!this.ecs) {
      const { ECSClient } = await import("@aws-sdk/client-ecs");
      this.ecs = new ECSClient({});
    }
    return this.ecs;
  }

  private async getLogsClient(): Promise<CloudWatchLogsClient> {
    if (!this.logs) {
      const { CloudWatchLogsClient } = await import("@aws-sdk/client-cloudwatch-logs");
      this.logs = new CloudWatchLogsClient({});
    }
    return this.logs;
  }

  private async waitForTaskRunning(
    taskArn: string,
    timeoutMs = 120_000,
  ): Promise<{ privateIp: string }> {
    const ecs = await this.getEcs();
    const { DescribeTasksCommand } = await import("@aws-sdk/client-ecs");
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const desc = await ecs.send(
        new DescribeTasksCommand({ cluster: this.cluster, tasks: [taskArn] }),
      );
      const task = desc.tasks?.[0];
      if (!task) {
        throw new Error(`Task ${taskArn} not found`);
      }

      if (task.lastStatus === "STOPPED") {
        const reason = task.stoppedReason ?? "unknown";
        throw new Error(`Task stopped unexpectedly: ${reason}`);
      }

      if (task.lastStatus === "RUNNING") {
        // Extract private IP from ENI attachment
        const eniDetail = task.attachments
          ?.find((a) => a.type === "ElasticNetworkInterface")
          ?.details?.find((d) => d.name === "privateIPv4Address");
        const privateIp = eniDetail?.value;
        if (!privateIp) {
          throw new Error("Task is RUNNING but has no private IP assigned");
        }
        return { privateIp };
      }

      await new Promise((r) => setTimeout(r, 3_000));
    }
    throw new Error("Task did not reach RUNNING within timeout");
  }

  async spawn(params: { name: string; image: string }): Promise<SpawnResult> {
    const ecs = await this.getEcs();
    const { RunTaskCommand } = await import("@aws-sdk/client-ecs");

    const gatewayToken = randomBytes(32).toString("hex");
    const device = generateDeviceIdentity();

    const instanceName = params.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const homeDir = `/instance-data/${instanceName}`;

    const configJson = JSON.stringify({
      gateway: {
        mode: "local",
        controlUi: {
          allowInsecureAuth: true,
          dangerouslyDisableDeviceAuth: true,
        },
      },
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.2" },
        },
      },
    });
    const pairedJson = buildPairedDevicesJson(device);

    const bootstrapCmd = [
      `mkdir -p ${homeDir}/.openclaw/devices`,
      `[ -f ${homeDir}/.openclaw/openclaw.json ] || printf '%s' '${configJson}' > ${homeDir}/.openclaw/openclaw.json`,
      `[ -f ${homeDir}/.openclaw/devices/paired.json ] || printf '%s' '${pairedJson}' > ${homeDir}/.openclaw/devices/paired.json`,
      `exec node dist/index.js gateway --bind lan --port 18789`,
    ].join(" && ");

    const result = await ecs.send(
      new RunTaskCommand({
        cluster: this.cluster,
        taskDefinition: this.taskDefinition,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: this.subnets,
            securityGroups: this.securityGroups,
            assignPublicIp: "DISABLED",
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "openclaw",
              command: ["sh", "-c", bootstrapCmd],
              environment: [
                { name: "HOME", value: homeDir },
                { name: "TERM", value: "xterm-256color" },
                { name: "OPENCLAW_GATEWAY_TOKEN", value: gatewayToken },
                ...getPassthroughEnv(),
              ],
            },
          ],
        },
        tags: [{ key: "openclaw:instance", value: instanceName }],
      }),
    );

    const taskArn = result.tasks?.[0]?.taskArn;
    if (!taskArn) {
      const reason = result.failures?.[0]?.reason ?? "unknown";
      throw new Error(`RunTask failed: ${reason}`);
    }

    const { privateIp } = await this.waitForTaskRunning(taskArn);

    return {
      containerId: taskArn,
      gatewayUrl: `ws://${privateIp}:18789`,
      gatewayToken,
      bridgeUrl: `http://${privateIp}:18790`,
      deviceCredentials: {
        deviceId: device.deviceId,
        publicKeyPem: device.publicKeyPem,
        privateKeyPem: device.privateKeyPem,
        publicKeyBase64Url: device.publicKeyBase64Url,
      },
    };
  }

  async start(containerId: string): Promise<StartResult> {
    // Fargate tasks can't be restarted — we must run a new one.
    // Describe the old task to get its overrides, then run a replacement.
    const ecs = await this.getEcs();
    const { DescribeTasksCommand, RunTaskCommand } = await import("@aws-sdk/client-ecs");

    const desc = await ecs.send(
      new DescribeTasksCommand({ cluster: this.cluster, tasks: [containerId] }),
    );
    const oldTask = desc.tasks?.[0];
    if (!oldTask) {
      throw new Error(`Task ${containerId} not found`);
    }

    const result = await ecs.send(
      new RunTaskCommand({
        cluster: this.cluster,
        taskDefinition: this.taskDefinition,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: this.subnets,
            securityGroups: this.securityGroups,
            assignPublicIp: "DISABLED",
          },
        },
        overrides: oldTask.overrides,
        tags: oldTask.tags,
      }),
    );

    const newArn = result.tasks?.[0]?.taskArn;
    if (!newArn) {
      const reason = result.failures?.[0]?.reason ?? "unknown";
      throw new Error(`RunTask failed: ${reason}`);
    }

    const { privateIp } = await this.waitForTaskRunning(newArn);

    return {
      gatewayUrl: `ws://${privateIp}:18789`,
      bridgeUrl: `http://${privateIp}:18790`,
      newContainerId: newArn,
    };
  }

  async stop(containerId: string): Promise<void> {
    const ecs = await this.getEcs();
    const { StopTaskCommand } = await import("@aws-sdk/client-ecs");
    await ecs.send(
      new StopTaskCommand({
        cluster: this.cluster,
        task: containerId,
        reason: "Stopped by hub",
      }),
    );
  }

  async remove(containerId: string): Promise<void> {
    // ECS tasks are ephemeral — stopping is equivalent to removing
    await this.stop(containerId);
  }

  async getLogs(containerId: string, tail = 200): Promise<string> {
    const logsClient = await this.getLogsClient();
    const { GetLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");

    const taskId = taskIdFromArn(containerId);
    // ECS awslogs log stream format: {prefix}/{container-name}/{task-id}
    const taskDef = this.taskDefinition.split("/").pop()?.split(":")[0] ?? this.taskDefinition;
    const logStream = `${taskDef}/openclaw/${taskId}`;

    const result = await logsClient.send(
      new GetLogEventsCommand({
        logGroupName: this.logGroup,
        logStreamName: logStream,
        limit: tail,
        startFromHead: false,
      }),
    );

    return (result.events ?? []).map((e) => e.message ?? "").join("\n");
  }

  async getStatus(containerId: string): Promise<string> {
    const ecs = await this.getEcs();
    const { DescribeTasksCommand } = await import("@aws-sdk/client-ecs");

    const desc = await ecs.send(
      new DescribeTasksCommand({ cluster: this.cluster, tasks: [containerId] }),
    );
    const task = desc.tasks?.[0];
    if (!task) {
      return "unknown";
    }

    // Map ECS statuses to docker-like statuses
    switch (task.lastStatus) {
      case "RUNNING":
        return "running";
      case "STOPPED":
        return "exited";
      case "PENDING":
      case "PROVISIONING":
      case "ACTIVATING":
        return "starting";
      case "DEACTIVATING":
      case "STOPPING":
        return "stopping";
      default:
        return task.lastStatus?.toLowerCase() ?? "unknown";
    }
  }

  async getRestartMarker(containerId: string): Promise<string> {
    // For ECS, the task ARN itself is the marker — if the task is replaced,
    // the ARN changes
    return containerId;
  }

  async waitForRestart(
    containerId: string,
    _marker: string,
    opts?: { timeoutMs?: number },
  ): Promise<RestartResult> {
    const ecs = await this.getEcs();
    const { DescribeTasksCommand, RunTaskCommand } = await import("@aws-sdk/client-ecs");
    const deadline = Date.now() + (opts?.timeoutMs ?? 120_000);

    // Wait for the current task to stop (config change triggers process exit)
    while (Date.now() < deadline) {
      const desc = await ecs.send(
        new DescribeTasksCommand({ cluster: this.cluster, tasks: [containerId] }),
      );
      const task = desc.tasks?.[0];
      if (task?.lastStatus === "STOPPED") {
        break;
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }

    // Describe old task to preserve overrides
    const desc = await ecs.send(
      new DescribeTasksCommand({ cluster: this.cluster, tasks: [containerId] }),
    );
    const oldTask = desc.tasks?.[0];
    if (!oldTask) {
      throw new Error(`Task ${containerId} not found`);
    }

    // Run a replacement task
    const result = await ecs.send(
      new RunTaskCommand({
        cluster: this.cluster,
        taskDefinition: this.taskDefinition,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: this.subnets,
            securityGroups: this.securityGroups,
            assignPublicIp: "DISABLED",
          },
        },
        overrides: oldTask.overrides,
        tags: oldTask.tags,
      }),
    );

    const newArn = result.tasks?.[0]?.taskArn;
    if (!newArn) {
      throw new Error(`RunTask failed: ${result.failures?.[0]?.reason ?? "unknown"}`);
    }

    const remaining = deadline - Date.now();
    const { privateIp } = await this.waitForTaskRunning(newArn, Math.max(remaining, 30_000));

    return {
      gatewayUrl: `ws://${privateIp}:18789`,
      bridgeUrl: `http://${privateIp}:18790`,
      newContainerId: newArn,
    };
  }
}
