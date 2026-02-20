---
title: Ted/OpenClaw User Story Bundle
created: 2026-02-19
---

This folder is structured for SDD ingestion:

- `epics/` contains epic framing.
- `user_stories/` contains one markdown file per user story with YAML front matter.

## Story index

| ID         | Title                                                                  | Epic    | Priority | Release target | File                                                                                               |
| ---------- | ---------------------------------------------------------------------- | ------- | -------- | -------------- | -------------------------------------------------------------------------------------------------- |
| TED-US-001 | Single-operator access controls                                        | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-001_single_operator_access_controls.md`                                       |
| TED-US-002 | Draft-only boundary for all outbound actions                           | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-002_draft_only_boundary_for_all_outbound_actions.md`                          |
| TED-US-003 | Least-privilege Graph permissions with quick revocation                | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-003_least_privilege_graph_permissions_with_quick_revocation.md`               |
| TED-US-004 | Secrets handled via keychain/vault references only                     | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-004_secrets_handled_via_keychain_vault_references_only.md`                    |
| TED-US-005 | Auditable actions with redaction before persistence                    | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-005_auditable_actions_with_redaction_before_persistence.md`                   |
| TED-US-006 | Evidence linkage rule with an Unfiled Work triage queue                | EPIC-01 | P0       | Phase-1        | `user_stories/ted-us-006_evidence_linkage_rule_with_an_unfiled_work_triage_queue.md`               |
| TED-US-007 | Two business profiles simultaneously (no personal mailbox/calendar)    | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-007_two_business_profiles_simultaneously_no_personal_mailbox_calendar.md`     |
| TED-US-008 | Source-tiered claims and citations for research outputs                | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-008_source_tiered_claims_and_citations_for_research_outputs.md`               |
| TED-US-009 | Mac installation package + step-by-step guide                          | EPIC-02 | P0       | Day-1          | `user_stories/ted-us-009_mac_installation_package_step_by_step_guide.md`                           |
| TED-US-010 | Auto-start on boot (LaunchAgent) and survive restarts                  | EPIC-02 | P0       | Day-1          | `user_stories/ted-us-010_auto_start_on_boot_launchagent_and_survive_restarts.md`                   |
| TED-US-011 | Setup wizard for guided configuration and validation                   | EPIC-02 | P0       | Day-1          | `user_stories/ted-us-011_setup_wizard_for_guided_configuration_and_validation.md`                  |
| TED-US-012 | Doctor health report that explains 'what broke' and 'what next'        | EPIC-02 | P0       | Day-1          | `user_stories/ted-us-012_doctor_health_report_that_explains_what_broke_and_what_next.md`           |
| TED-US-013 | Architecture overview + log locations + troubleshooting notes          | EPIC-02 | P1       | Day-1          | `user_stories/ted-us-013_architecture_overview_log_locations_troubleshooting_notes.md`             |
| TED-US-014 | Inbox scanning and priority summarization                              | EPIC-03 | P0       | Day-1          | `user_stories/ted-us-014_inbox_scanning_and_priority_summarization.md`                             |
| TED-US-015 | Draft replies in Outlook (never send)                                  | EPIC-03 | P0       | Day-1          | `user_stories/ted-us-015_draft_replies_in_outlook_never_send.md`                                   |
| TED-US-016 | Draft queue that mirrors what is ready for review                      | EPIC-03 | P0       | Day-1          | `user_stories/ted-us-016_draft_queue_that_mirrors_what_is_ready_for_review.md`                     |
| TED-US-017 | Suggest filing actions tied to deals (approval-first)                  | EPIC-03 | P0       | Phase-1        | `user_stories/ted-us-017_suggest_filing_actions_tied_to_deals_approval_first.md`                   |
| TED-US-018 | Apply approved filing (move/label) with audit trail                    | EPIC-03 | P0       | Phase-1        | `user_stories/ted-us-018_apply_approved_filing_move_label_with_audit_trail.md`                     |
| TED-US-019 | Deal-specific email folders/tags to organize threads                   | EPIC-03 | P1       | Phase-1        | `user_stories/ted-us-019_deal_specific_email_folders_tags_to_organize_threads.md`                  |
| TED-US-020 | Daily schedule digest (conflicts + priorities)                         | EPIC-04 | P0       | Day-1          | `user_stories/ted-us-020_daily_schedule_digest_conflicts_priorities.md`                            |
| TED-US-021 | Propose schedule optimization (move/reorder)                           | EPIC-04 | P0       | Phase-1        | `user_stories/ted-us-021_propose_schedule_optimization_move_reorder.md`                            |
| TED-US-022 | Extract deadlines and propose next actions                             | EPIC-04 | P0       | Phase-1        | `user_stories/ted-us-022_extract_deadlines_and_propose_next_actions.md`                            |
| TED-US-023 | Apply tentative holds only after certification (no invites)            | EPIC-04 | P0       | Phase-1        | `user_stories/ted-us-023_apply_tentative_holds_only_after_certification_no_invites.md`             |
| TED-US-024 | Deal ledger to track phase and key metadata                            | EPIC-05 | P0       | Phase-1        | `user_stories/ted-us-024_deal_ledger_to_track_phase_and_key_metadata.md`                           |
| TED-US-025 | Dataroom ingest and auto-filing into a predetermined structure         | EPIC-05 | P0       | Phase-1        | `user_stories/ted-us-025_dataroom_ingest_and_auto_filing_into_a_predetermined_structure.md`        |
| TED-US-026 | Daily DealOps surface (single operator digest)                         | EPIC-05 | P0       | Day-1          | `user_stories/ted-us-026_daily_dealops_surface_single_operator_digest.md`                          |
| TED-US-027 | Generate deal status reports and meeting agendas/follow-ups            | EPIC-05 | P0       | Phase-1        | `user_stories/ted-us-027_generate_deal_status_reports_and_meeting_agendas_follow_ups.md`           |
| TED-US-028 | Canonical task list and daily to-do list                               | EPIC-05 | P0       | Day-1          | `user_stories/ted-us-028_canonical_task_list_and_daily_to_do_list.md`                              |
| TED-US-029 | Optional sync with Microsoft To Do/Planner (read + gated writes)       | EPIC-05 | P1       | Phase-1        | `user_stories/ted-us-029_optional_sync_with_microsoft_to_do_planner_read_gated_writes.md`          |
| TED-US-030 | Template library management for legal documents                        | EPIC-06 | P0       | Day-1          | `user_stories/ted-us-030_template_library_management_for_legal_documents.md`                       |
| TED-US-031 | Render templates into draft documents with deal data                   | EPIC-06 | P0       | Day-1          | `user_stories/ted-us-031_render_templates_into_draft_documents_with_deal_data.md`                  |
| TED-US-032 | Clause library extraction, tagging, and reuse                          | EPIC-06 | P1       | Phase-1        | `user_stories/ted-us-032_clause_library_extraction_tagging_and_reuse.md`                           |
| TED-US-033 | Track outside counsel work and clause preferences                      | EPIC-06 | P1       | Phase-1        | `user_stories/ted-us-033_track_outside_counsel_work_and_clause_preferences.md`                     |
| TED-US-034 | Connector onboarding with legal approval and allowed operations        | EPIC-07 | P0       | Day-1          | `user_stories/ted-us-034_connector_onboarding_with_legal_approval_and_allowed_operations.md`       |
| TED-US-035 | PACER bankruptcy discovery and monitoring (budget-aware)               | EPIC-07 | P1       | Phase-1        | `user_stories/ted-us-035_pacer_bankruptcy_discovery_and_monitoring_budget_aware.md`                |
| TED-US-036 | SEC EDGAR connector for filings and summaries                          | EPIC-07 | P1       | Phase-1        | `user_stories/ted-us-036_sec_edgar_connector_for_filings_and_summaries.md`                         |
| TED-US-037 | Research from licensed sources (Bloomberg, 9fin, etc.) with governance | EPIC-07 | P2       | Phase-2        | `user_stories/ted-us-037_research_from_licensed_sources_bloomberg_9fin_etc_with_governance.md`     |
| TED-US-038 | Phone-like chat interface (web/Telegram/iMessage)                      | EPIC-08 | P0       | Day-1          | `user_stories/ted-us-038_phone_like_chat_interface_web_telegram_imessage.md`                       |
| TED-US-039 | Approve/reject proposals via mobile commands                           | EPIC-08 | P0       | Phase-1        | `user_stories/ted-us-039_approve_reject_proposals_via_mobile_commands.md`                          |
| TED-US-040 | Notification routing tiers (urgent, batched, daily)                    | EPIC-08 | P1       | Phase-1        | `user_stories/ted-us-040_notification_routing_tiers_urgent_batched_daily.md`                       |
| TED-US-041 | Skill Studio for controlled self-serve extensions                      | EPIC-09 | P0       | Day-1          | `user_stories/ted-us-041_skill_studio_for_controlled_self_serve_extensions.md`                     |
| TED-US-042 | Builder console shows self-serve vs glass-break boundaries             | EPIC-09 | P1       | Phase-1        | `user_stories/ted-us-042_builder_console_shows_self_serve_vs_glass_break_boundaries.md`            |
| TED-US-043 | Self-improvement scorecard and weekly review loop                      | EPIC-09 | P2       | Phase-2        | `user_stories/ted-us-043_self_improvement_scorecard_and_weekly_review_loop.md`                     |
| TED-US-044 | Daily holdings digest with explicit no-trading execution               | EPIC-10 | P1       | Day-1          | `user_stories/ted-us-044_daily_holdings_digest_with_explicit_no_trading_execution.md`              |
| TED-US-045 | Track investment theses/rules as notes and tasks                       | EPIC-10 | P2       | Phase-2        | `user_stories/ted-us-045_track_investment_theses_rules_as_notes_and_tasks.md`                      |
| TED-US-046 | Loopback sidecar contract with authenticated non-health routes         | EPIC-01 | P0       | Day-1          | `user_stories/ted-us-046_loopback_sidecar_contract_with_authenticated_non_health_routes.md`        |
| TED-US-047 | Retention and purge controls with auditable lifecycle                  | EPIC-01 | P1       | Phase-1        | `user_stories/ted-us-047_retention_purge_controls_with_auditable_lifecycle.md`                     |
| TED-US-048 | Role cards with governed domain IO done bans and escalation            | EPIC-09 | P0       | Day-1          | `user_stories/ted-us-048_role_cards_with_governed_domain_io_done_bans_and_escalation.md`           |
| TED-US-049 | Hard-bans policy enforcement with fail-closed execution                | EPIC-09 | P0       | Day-1          | `user_stories/ted-us-049_hard_bans_policy_enforcement_with_fail_closed_execution.md`               |
| TED-US-050 | Role escalation protocol to approval surface                           | EPIC-09 | P0       | Phase-1        | `user_stories/ted-us-050_role_escalation_protocol_to_approval_surface.md`                          |
| TED-US-051 | Deterministic skill growth modifiers from verified outcomes            | EPIC-09 | P1       | Phase-1        | `user_stories/ted-us-051_deterministic_skill_growth_modifiers_from_verified_outcomes.md`           |
| TED-US-052 | Relationship affinity routing as a bounded internal signal             | EPIC-09 | P2       | Phase-2        | `user_stories/ted-us-052_relationship_affinity_routing_as_a_bounded_internal_signal.md`            |
| TED-US-053 | Entity tagging and provenance required for all objects                 | EPIC-01 | P1       | Phase-1        | `user_stories/ted-us-053_entity_tagging_and_provenance_required_for_all_objects.md`                |
| TED-US-054 | Cross-entity output guardrails block by default                        | EPIC-01 | P1       | Phase-1        | `user_stories/ted-us-054_cross_entity_output_guardrails_block_by_default.md`                       |
| TED-US-055 | Global pause and resume control with catch-up summary                  | EPIC-02 | P1       | Phase-1        | `user_stories/ted-us-055_global_pause_resume_control_with_catch_up_summary.md`                     |
| TED-US-056 | Draft contradiction detection against prior commitments                | EPIC-03 | P1       | Phase-1        | `user_stories/ted-us-056_draft_contradiction_detection_against_prior_commitments.md`               |
| TED-US-057 | Rate limit budgeting and priority-aware backoff                        | EPIC-02 | P1       | Phase-1        | `user_stories/ted-us-057_rate_limit_budgeting_and_priority_aware_backoff.md`                       |
| TED-US-058 | Meeting summary and action capture with explicit exclusions            | EPIC-05 | P1       | Phase-2        | `user_stories/ted-us-058_meeting_summary_and_action_capture_with_explicit_exclusions.md`           |
| TED-US-059 | Standard bot output contract with citations entity scope and audience  | EPIC-01 | P1       | Phase-1        | `user_stories/ted-us-059_standard_bot_output_contract_with_citations_entity_scope_and_audience.md` |
| TED-US-060 | Confidence policy and escalation thresholds for extracted actions      | EPIC-04 | P1       | Phase-1        | `user_stories/ted-us-060_confidence_policy_and_escalation_thresholds_for_extracted_actions.md`     |
| TED-US-061 | Audience clearance redaction and privileged routing enforcement        | EPIC-01 | P1       | Phase-1        | `user_stories/ted-us-061_audience_clearance_redaction_and_privileged_routing_enforcement.md`       |
