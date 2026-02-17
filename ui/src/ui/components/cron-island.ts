import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type { CronFormState } from "../ui-types.ts";
import { renderCron, type CronProps } from "../views/cron.ts";

@customElement("cron-island")
export class CronIsland extends LitElement {
  @state() private loading = false;
  @state() private status: CronStatus | null = null;
  @state() private jobs: CronJob[] = [];
  @state() private error: string | null = null;
  @state() private busy = false;
  @state() private channels: string[] = [];
  @state() private runsJobId: string | null = null;
  @state() private runs: CronRunLogEntry[] = [];
  @state() private form: CronFormState = {
    name: "",
    description: "",
    agentId: "",
    enabled: true,
    scheduleKind: "every",
    everyAmount: "1",
    everyUnit: "hours",
    scheduleAt: "",
    cronExpr: "",
    cronTz: "",
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payloadKind: "systemEvent",
    payloadText: "",
    deliver: false,
    channel: "last",
    to: "",
    timeoutSeconds: "120",
    postToMainPrefix: "",
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = null;
    try {
      const [status, jobs] = await Promise.all([
        gateway.call<CronStatus>("cron.status"),
        gateway.call<{ jobs: CronJob[] }>("cron.list"),
      ]);
      this.status = status;
      this.jobs = jobs.jobs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private handleFormChange(patch: Partial<CronFormState>) {
    this.form = { ...this.form, ...patch };
  }

  private async handleAdd() {
    this.busy = true;
    try {
      await gateway.call("cron.add", { job: this.form });
      await this.loadData();
      this.form = {
        name: "",
        description: "",
        agentId: "",
        enabled: true,
        scheduleKind: "every",
        everyAmount: "1",
        everyUnit: "hours",
        scheduleAt: "",
        cronExpr: "",
        cronTz: "",
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payloadKind: "systemEvent",
        payloadText: "",
        deliver: false,
        channel: "last",
        to: "",
        timeoutSeconds: "120",
        postToMainPrefix: "",
      };
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }

  private async handleToggle(job: CronJob, enabled: boolean) {
    this.busy = true;
    try {
      await gateway.call("cron.toggle", { jobId: job.id, enabled });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }

  private async handleRun(job: CronJob) {
    this.busy = true;
    try {
      await gateway.call("cron.run", { jobId: job.id });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }

  private async handleRemove(job: CronJob) {
    if (!confirm(`Remove job "${job.name}"?`)) {
      return;
    }
    this.busy = true;
    try {
      await gateway.call("cron.remove", { jobId: job.id });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }

  private async handleLoadRuns(jobId: string) {
    this.runsJobId = jobId;
    try {
      const result = await gateway.call<{ runs: CronRunLogEntry[] }>("cron.runs", { jobId });
      this.runs = result.runs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  render() {
    const props: CronProps = {
      loading: this.loading,
      status: this.status,
      jobs: this.jobs,
      error: this.error,
      busy: this.busy,
      form: this.form,
      channels: this.channels,
      runsJobId: this.runsJobId,
      runs: this.runs,
      onFormChange: (patch) => this.handleFormChange(patch),
      onRefresh: () => void this.loadData(),
      onAdd: () => void this.handleAdd(),
      onToggle: (job, enabled) => void this.handleToggle(job, enabled),
      onRun: (job) => void this.handleRun(job),
      onRemove: (job) => void this.handleRemove(job),
      onLoadRuns: (jobId) => void this.handleLoadRuns(jobId),
    };

    return html`${renderCron(props)}`;
  }
}
