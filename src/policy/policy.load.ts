import fs from "node:fs/promises";
import { verifyEd25519Signature } from "./policy.crypto.js";
import { SignedPolicySchema, type SignedPolicy } from "./policy.schema.js";

export type PolicyLoadErrorCode =
  | "POLICY_FILE_MISSING"
  | "SIGNATURE_FILE_MISSING"
  | "POLICY_FILE_UNREADABLE"
  | "SIGNATURE_FILE_UNREADABLE"
  | "POLICY_JSON_INVALID"
  | "POLICY_SCHEMA_INVALID"
  | "SIGNATURE_INVALID";

export type PolicyLoadFailure = {
  ok: false;
  code: PolicyLoadErrorCode;
  error: string;
  policyPath: string;
  sigPath: string;
};

export type PolicyLoadSuccess = {
  ok: true;
  policy: SignedPolicy;
  policyPath: string;
  sigPath: string;
};

export type PolicyLoadResult = PolicyLoadSuccess | PolicyLoadFailure;

async function readUtf8File(pathname: string): Promise<string> {
  return await fs.readFile(pathname, "utf8");
}

function buildMissingError(
  code: PolicyLoadErrorCode,
  message: string,
  policyPath: string,
  sigPath: string,
): PolicyLoadFailure {
  return {
    ok: false,
    code,
    error: message,
    policyPath,
    sigPath,
  };
}

export async function loadSignedPolicy(params: {
  policyPath: string;
  sigPath: string;
  publicKey: string;
}): Promise<PolicyLoadResult> {
  const policyPath = params.policyPath;
  const sigPath = params.sigPath;

  let rawPolicy: string;
  try {
    rawPolicy = await readUtf8File(policyPath);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return buildMissingError(
        "POLICY_FILE_MISSING",
        `Policy file not found at ${policyPath}.`,
        policyPath,
        sigPath,
      );
    }
    return buildMissingError(
      "POLICY_FILE_UNREADABLE",
      `Failed to read policy file at ${policyPath}: ${String(err)}`,
      policyPath,
      sigPath,
    );
  }

  let rawSignature: string;
  try {
    rawSignature = await readUtf8File(sigPath);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return buildMissingError(
        "SIGNATURE_FILE_MISSING",
        `Policy signature file not found at ${sigPath}.`,
        policyPath,
        sigPath,
      );
    }
    return buildMissingError(
      "SIGNATURE_FILE_UNREADABLE",
      `Failed to read policy signature at ${sigPath}: ${String(err)}`,
      policyPath,
      sigPath,
    );
  }

  let parsedPolicy: unknown;
  try {
    parsedPolicy = JSON.parse(rawPolicy);
  } catch (err) {
    return buildMissingError(
      "POLICY_JSON_INVALID",
      `Policy JSON parse failed: ${String(err)}`,
      policyPath,
      sigPath,
    );
  }

  const validated = SignedPolicySchema.safeParse(parsedPolicy);
  if (!validated.success) {
    const issueText = validated.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    return buildMissingError(
      "POLICY_SCHEMA_INVALID",
      `Policy schema validation failed: ${issueText}`,
      policyPath,
      sigPath,
    );
  }

  const signature = rawSignature.trim();
  if (
    !verifyEd25519Signature({
      payload: rawPolicy,
      signatureBase64: signature,
      publicKey: params.publicKey,
    })
  ) {
    return buildMissingError(
      "SIGNATURE_INVALID",
      "Policy signature verification failed.",
      policyPath,
      sigPath,
    );
  }

  return {
    ok: true,
    policy: validated.data,
    policyPath,
    sigPath,
  };
}
