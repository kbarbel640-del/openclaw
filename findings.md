# Findings

## Onboarding Implementation
- Onboarding logic is spread across `src/commands/onboard-*` and `src/wizard/onboarding*.ts`.
- `onboard-auth.ts` exports functions to apply configurations for various providers.
- `onboard-auth.config-core.ts` and `onboard-auth.credentials.ts` handle core provider setup.
- `onboard-auth.models.ts` defines model defaults.
- **DeepSeek is currently missing** from the onboarding flow.

## DeepSeek Integration Plan
1.  **Define Defaults**: Add DeepSeek model constants in `src/commands/onboard-auth.models.ts` (reuse constants from `models-config.providers.ts` if possible, but they are private there, so likely redefine or export).
2.  **Config Applicator**: Create `applyDeepSeekProviderConfig` and `applyDeepSeekConfig` in `src/commands/onboard-auth.config-core.ts` (or a new file if needed, but core seems fine).
3.  **Credential Setter**: Add `setDeepSeekApiKey` in `src/commands/onboard-auth.credentials.ts`.
4.  **Interactive Flow**: Update `src/commands/onboard-interactive.ts` or `src/commands/auth-choice.ts` to include DeepSeek as an option.
5.  **Export**: Update `src/commands/onboard-auth.ts` to export the new functions.

## Implementation Details
- `DEEPSEEK_DEFAULT_MODEL_ID` = `deepseek-chat`
- `DEEPSEEK_DEFAULT_MODEL_REF` = `deepseek/deepseek-chat`
