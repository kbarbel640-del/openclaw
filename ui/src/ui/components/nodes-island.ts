/**
 * Nodes Island - Interactive node management for Astro.
 * Wraps the existing renderNodes view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import type { DevicePairingList } from "../controllers/devices.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "../controllers/exec-approvals.ts";
import { renderNodes, type NodesProps } from "../views/nodes.ts";

@customElement("nodes-island")
export class NodesIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private loading = false;
  @state() private nodes: Array<Record<string, unknown>> = [];
  @state() private devicesLoading = false;
  @state() private devicesError: string | null = null;
  @state() private devicesList: DevicePairingList | null = null;
  @state() private configForm: Record<string, unknown> | null = null;
  @state() private configLoading = false;
  @state() private configSaving = false;
  @state() private configDirty = false;
  @state() private configFormMode: "form" | "raw" = "form";
  @state() private execApprovalsLoading = false;
  @state() private execApprovalsSaving = false;
  @state() private execApprovalsDirty = false;
  @state() private execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() private execApprovalsForm: ExecApprovalsFile | null = null;
  @state() private execApprovalsSelectedAgent: string | null = null;
  @state() private execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() private execApprovalsTargetNodeId: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadNodes();
    void this.loadDevices();
  }

  private async loadNodes() {
    this.loading = true;
    try {
      const res = await gateway.call<{ nodes?: Array<Record<string, unknown>> }>("node.list");
      this.nodes = Array.isArray(res.nodes) ? res.nodes : [];
    } catch {
      // Nodes may not be available
    } finally {
      this.loading = false;
    }
  }

  private async loadDevices() {
    this.devicesLoading = true;
    this.devicesError = null;
    try {
      const res = await gateway.call<{
        pending?: Array<Record<string, unknown>>;
        paired?: Array<Record<string, unknown>>;
      }>("device.pair.list");
      this.devicesList = {
        pending: Array.isArray(res.pending) ? (res.pending as DevicePairingList["pending"]) : [],
        paired: Array.isArray(res.paired) ? (res.paired as DevicePairingList["paired"]) : [],
      };
    } catch (err) {
      this.devicesError = err instanceof Error ? err.message : String(err);
    } finally {
      this.devicesLoading = false;
    }
  }

  private async approveDevice(requestId: string) {
    try {
      await gateway.call("device.pair.approve", { requestId });
      await this.loadDevices();
    } catch (err) {
      this.devicesError = err instanceof Error ? err.message : String(err);
    }
  }

  private async rejectDevice(requestId: string) {
    try {
      await gateway.call("device.pair.reject", { requestId });
      await this.loadDevices();
    } catch (err) {
      this.devicesError = err instanceof Error ? err.message : String(err);
    }
  }

  private async rotateDevice(deviceId: string, role: string, scopes?: string[]) {
    try {
      await gateway.call("device.pair.rotate", { deviceId, role, scopes });
      await this.loadDevices();
    } catch (err) {
      this.devicesError = err instanceof Error ? err.message : String(err);
    }
  }

  private async revokeDevice(deviceId: string, role: string) {
    try {
      await gateway.call("device.pair.revoke", { deviceId, role });
      await this.loadDevices();
    } catch (err) {
      this.devicesError = err instanceof Error ? err.message : String(err);
    }
  }

  private async loadConfig() {
    this.configLoading = true;
    try {
      const res = await gateway.call<{ config?: Record<string, unknown> }>("config.get");
      this.configForm = res.config ?? null;
      this.configDirty = false;
    } catch (err) {
      // Config may not be available
      console.warn("Failed to load config:", err);
    } finally {
      this.configLoading = false;
    }
  }

  private async loadExecApprovals() {
    this.execApprovalsLoading = true;
    try {
      const res = await gateway.call<ExecApprovalsSnapshot>("exec-approvals.snapshot", {
        target: this.execApprovalsTarget,
        nodeId: this.execApprovalsTargetNodeId,
      });
      this.execApprovalsSnapshot = res;
      this.execApprovalsForm = res.file ?? null;
      this.execApprovalsDirty = false;
    } catch {
      // Exec approvals may not be available
    } finally {
      this.execApprovalsLoading = false;
    }
  }

  private handleExecApprovalsPatch(path: Array<string | number>, value: unknown) {
    if (!this.execApprovalsForm) {
      return;
    }
    const updated = structuredClone(this.execApprovalsForm);
    let current: Record<string, unknown> = updated as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = String(path[i]);
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    const lastKey = path[path.length - 1];
    if (lastKey !== undefined) {
      current[String(lastKey)] = value;
    }
    this.execApprovalsForm = updated;
    this.execApprovalsDirty = true;
  }

  private handleExecApprovalsRemove(path: Array<string | number>) {
    if (!this.execApprovalsForm) {
      return;
    }
    const updated = structuredClone(this.execApprovalsForm);
    let current: Record<string, unknown> = updated as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = String(path[i]);
      current = current[key] as Record<string, unknown>;
    }
    const lastKey = path[path.length - 1];
    if (lastKey !== undefined) {
      delete current[String(lastKey)];
    }
    this.execApprovalsForm = updated;
    this.execApprovalsDirty = true;
  }

  private async saveExecApprovals() {
    if (!this.execApprovalsForm) {
      return;
    }
    this.execApprovalsSaving = true;
    try {
      await gateway.call("exec-approvals.save", {
        target: this.execApprovalsTarget,
        nodeId: this.execApprovalsTargetNodeId,
        file: this.execApprovalsForm,
      });
      this.execApprovalsDirty = false;
    } catch (err) {
      console.warn("Failed to save exec approvals:", err);
    } finally {
      this.execApprovalsSaving = false;
    }
  }

  private async handleBindDefault(nodeId: string | null) {
    try {
      await gateway.call("node.bind.default", { nodeId });
      await this.loadNodes();
    } catch (err) {
      console.warn("Failed to bind default:", err);
    }
  }

  private async handleBindAgent(agentIndex: number, nodeId: string | null) {
    try {
      await gateway.call("node.bind.agent", { agentIndex, nodeId });
      await this.loadNodes();
    } catch (err) {
      console.warn("Failed to bind agent:", err);
    }
  }

  private async handleSaveBindings() {
    this.configSaving = true;
    try {
      await gateway.call("node.bindings.save", {});
    } catch (err) {
      console.warn("Failed to save bindings:", err);
    } finally {
      this.configSaving = false;
    }
  }

  render(): TemplateResult {
    const props: NodesProps = {
      loading: this.loading,
      nodes: this.nodes,
      devicesLoading: this.devicesLoading,
      devicesError: this.devicesError,
      devicesList: this.devicesList,
      configForm: this.configForm,
      configLoading: this.configLoading,
      configSaving: this.configSaving,
      configDirty: this.configDirty,
      configFormMode: this.configFormMode,
      execApprovalsLoading: this.execApprovalsLoading,
      execApprovalsSaving: this.execApprovalsSaving,
      execApprovalsDirty: this.execApprovalsDirty,
      execApprovalsSnapshot: this.execApprovalsSnapshot,
      execApprovalsForm: this.execApprovalsForm,
      execApprovalsSelectedAgent: this.execApprovalsSelectedAgent,
      execApprovalsTarget: this.execApprovalsTarget,
      execApprovalsTargetNodeId: this.execApprovalsTargetNodeId,
      onRefresh: () => void this.loadNodes(),
      onDevicesRefresh: () => void this.loadDevices(),
      onDeviceApprove: (requestId) => void this.approveDevice(requestId),
      onDeviceReject: (requestId) => void this.rejectDevice(requestId),
      onDeviceRotate: (deviceId, role, scopes) => void this.rotateDevice(deviceId, role, scopes),
      onDeviceRevoke: (deviceId, role) => void this.revokeDevice(deviceId, role),
      onLoadConfig: () => void this.loadConfig(),
      onLoadExecApprovals: () => void this.loadExecApprovals(),
      onBindDefault: (nodeId) => void this.handleBindDefault(nodeId),
      onBindAgent: (agentIndex, nodeId) => void this.handleBindAgent(agentIndex, nodeId),
      onSaveBindings: () => void this.handleSaveBindings(),
      onExecApprovalsTargetChange: (kind, nodeId) => {
        this.execApprovalsTarget = kind;
        this.execApprovalsTargetNodeId = nodeId;
        void this.loadExecApprovals();
      },
      onExecApprovalsSelectAgent: (agentId) => {
        this.execApprovalsSelectedAgent = agentId;
      },
      onExecApprovalsPatch: (path, value) => this.handleExecApprovalsPatch(path, value),
      onExecApprovalsRemove: (path) => this.handleExecApprovalsRemove(path),
      onSaveExecApprovals: () => void this.saveExecApprovals(),
    };

    return html`${renderNodes(props)}`;
  }
}
