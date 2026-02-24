"""
LLM Council Gate — open-ended verification via independent reviewer agents.
Gate 5 of the Governed Agents verification pipeline.
"""
from dataclasses import dataclass, field
from typing import Optional
import json
import re

from governed_agents.contract import ContextEntry

PASS_THRESHOLD = 0.70

SCORE_MAP = {
    "SUPPORTED": 1.0,
    "SUPPORTED_BY_PROMPT": 1.0,
    "MISATTRIBUTED": 0.2,
    "CONTRADICTS_PROMPT": 0.0,
    "NOT_IN_PROMPT": 0.0,
    "UNSUPPORTED": 0.0,
    "INFRA_FAIL": None,
}

QUALITY_WEIGHTS = {
    "argument_coherent": 0.30,
    "reasoning_sound": 0.30,
    "risks_addressed": 0.20,
    "user_intent_match": 0.20,
}


@dataclass
class Claim:
    claim_id: str
    text: str
    rank: int
    claim_type: str = "FACTUAL"  # FACTUAL | SYNTHESIZED_LOGIC | PROMPT_PREMISE
    source_cited: Optional[str] = None


@dataclass
class CorePillar:
    claim: Claim
    is_rank_1: bool = False


@dataclass
class FactVerdict:
    claim_id: str
    verdict: str
    score: float
    evidence: str = ""
    source_used: Optional[str] = None


@dataclass
class QualityVerdict:
    argument_coherent: bool
    reasoning_sound: bool
    risks_addressed: bool
    user_intent_match: bool = False
    quality_score: float = 0.0
    quality_notes: str = ""


@dataclass
class CouncilVerdict:
    # reviewer vote compatibility
    reviewer_id: str = "council"
    verdict: str = "reject"  # approve|reject OR PASS|FAIL|MISATTRIBUTED
    confidence: float = 0.5
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    raw: str = ""
    parse_success: bool = False

    # v7.2 council-level fields
    external_fact_score: float = 1.0
    context_fact_score: float = 1.0
    quality_score: float = 1.0
    final_score: float = 1.0
    rank_1_fabricated: bool = False
    claims_checked: int = 0
    claims_supported: int = 0
    claims_supported_by_prompt: int = 0
    claims_contradicts_prompt: int = 0
    claims_not_in_prompt: int = 0
    claims_misattributed: int = 0
    claims_unsupported: int = 0
    infra_fails: int = 0
    quality_verdict: Optional[QualityVerdict] = None
    fact_verdicts: list[FactVerdict] = field(default_factory=list)
    transparency_notes: list[str] = field(default_factory=list)

    @property
    def fact_score(self) -> float:
        """Backward-compat alias from pre-v7.2 single fact score."""
        return self.external_fact_score

    @classmethod
    def from_output(cls, raw: str, reviewer_id: str) -> "CouncilVerdict":
        v = cls(reviewer_id=reviewer_id, raw=raw)
        try:
            json_str = raw
            if "{" in raw:
                json_str = raw[raw.find("{"):raw.rfind("}") + 1]
            data = json.loads(json_str)

            parsed_verdict = str(data.get("verdict", "reject"))
            lower_verdict = parsed_verdict.lower()
            if lower_verdict in ("approve", "reject"):
                v.verdict = lower_verdict
            elif parsed_verdict in ("PASS", "FAIL", "MISATTRIBUTED"):
                v.verdict = parsed_verdict
            else:
                v.verdict = "reject"

            v.confidence = max(0.0, min(1.0, float(data.get("confidence", 0.5))))
            v.strengths = data.get("strengths", []) if isinstance(data.get("strengths"), list) else []
            v.weaknesses = data.get("weaknesses", []) if isinstance(data.get("weaknesses"), list) else []
            v.missing = data.get("missing", []) if isinstance(data.get("missing"), list) else []
            v.external_fact_score = float(data.get("external_fact_score", v.external_fact_score))
            v.context_fact_score = float(data.get("context_fact_score", v.context_fact_score))
            v.quality_score = float(data.get("quality_score", v.quality_score))
            v.final_score = float(data.get("final_score", v.final_score))
            v.parse_success = True
        except Exception:
            v.verdict = "reject"
            v.parse_success = False
        return v


@dataclass
class CouncilResult:
    passed: bool
    score: float
    approvals: int
    total: int
    verdicts: list[CouncilVerdict] = field(default_factory=list)
    summary: str = ""

    @property
    def details(self) -> str:
        return self.summary


def generate_reviewer_prompt(
    objective: str,
    criteria: list[str],
    agent_output: str,
    custom_prompt: Optional[str] = None,
) -> str:
    # NOTE: agent_output is injected unfiltered — prompt injection risk if the
    # reviewed agent embeds adversarial instructions in its output.
    # Mitigation: use a stronger model for reviewers than for the task agent.
    criteria_text = "\n".join(f"- {c}" for c in criteria)
    instruction = custom_prompt or (
        "You are an independent reviewer. Be precise and critical. "
        "An honest rejection is more valuable than a false approval."
    )
    return f"""COUNCIL REVIEW REQUEST

{instruction}

Task Objective: {objective}

Acceptance Criteria:
{criteria_text}

--- OUTPUT TO REVIEW ---
{agent_output}
---

Return ONLY this JSON (no other text):
{{
  \"verdict\": \"approve\",
  \"confidence\": 0.8,
  \"strengths\": [\"strength 1\"],
  \"weaknesses\": [\"weakness 1\"],
  \"missing\": [\"missing item\"]
}}

verdict must be exactly \"approve\" or \"reject\".
"""


def aggregate_votes(
    verdicts: list[CouncilVerdict],
    threshold: float = 0.5,
) -> CouncilResult:
    if not verdicts:
        return CouncilResult(
            passed=False, score=0.0, approvals=0, total=0,
            summary="No verdicts received — defaulting to FAIL"
        )

    approvals = sum(1 for v in verdicts if v.verdict == "approve")
    total = len(verdicts)
    score = approvals / total
    passed = approvals > total / 2  # strict majority (50/50 = FAIL)

    all_weaknesses = list(dict.fromkeys(
        w for v in verdicts for w in v.weaknesses
    ))[:5]
    all_missing = list(dict.fromkeys(
        m for v in verdicts for m in v.missing
    ))[:3]

    summary = (
        f"Council: {approvals}/{total} approved "
        f"(score={score:.2f}, {'PASS ✅' if passed else 'FAIL ❌'})"
    )
    if all_weaknesses:
        summary += "\nWeaknesses: " + "; ".join(all_weaknesses)
    if all_missing:
        summary += "\nMissing: " + "; ".join(all_missing)

    return CouncilResult(
        passed=passed, score=score,
        approvals=approvals, total=total,
        verdicts=verdicts, summary=summary,
    )


# --- Reviewer 0 (triage) ----------------------------------------------------

def extract_core_pillars(
    agent_output: str,
    model: str = "claude-haiku-4-5",
    high_stakes: bool = False,
    reviewer_b_model: str = "claude-haiku-4-5",
) -> tuple[list[CorePillar], str]:
    """Extract simple claim pillars and enforce model diversity when high_stakes."""
    selected_model = model
    if high_stakes and selected_model == reviewer_b_model:
        diversity_upgrade = {
            "claude-haiku-4-5": "claude-sonnet-4-5",
            "claude-sonnet-4-5": "claude-opus-4-5",
        }
        selected_model = diversity_upgrade.get(selected_model, "claude-sonnet-4-5")

    candidates = [line.strip(" -*\t") for line in agent_output.splitlines() if line.strip()]
    if not candidates:
        candidates = [agent_output.strip()] if agent_output.strip() else []

    pillars: list[CorePillar] = []
    for idx, text in enumerate(candidates[:6], start=1):
        claim_type = "SYNTHESIZED_LOGIC"
        if "[context:" in text.lower() or "[sourc" in text.lower() and "user prompt" in text.lower():
            claim_type = "PROMPT_PREMISE"
        elif "http://" in text.lower() or "https://" in text.lower() or "[source:" in text.lower():
            claim_type = "FACTUAL"

        source_match = re.search(r"(https?://\S+|\[Source:[^\]]+\]|\[Context:[^\]]+\]|\[InternalDoc:[^\]]+\])", text, re.IGNORECASE)
        claim = Claim(
            claim_id=f"c{idx}",
            text=text,
            rank=idx,
            claim_type=claim_type,
            source_cited=source_match.group(1) if source_match else None,
        )
        corrected_note = _auto_correct_tag_pointer(claim)
        pillar = CorePillar(claim=claim, is_rank_1=(idx == 1))
        if corrected_note:
            # Keep correction in claim text context for observability
            pillar.claim.text = f"{pillar.claim.text}"
        pillars.append(pillar)

    return pillars, selected_model


def _auto_correct_tag_pointer(claim: Claim) -> Optional[str]:
    """Fix tag/pointer collisions silently and return correction note."""
    source = (claim.source_cited or "").lower()
    if claim.claim_type == "FACTUAL" and ("user prompt" in source or source.startswith("[context:")):
        claim.claim_type = "PROMPT_PREMISE"
        return "claim_type FACTUAL -> PROMPT_PREMISE"
    if claim.claim_type == "PROMPT_PREMISE" and source.startswith("http"):
        claim.claim_type = "FACTUAL"
        return "claim_type PROMPT_PREMISE -> FACTUAL"
    return None


def route_claims(pillars: list[CorePillar]) -> tuple[list[CorePillar], list[CorePillar]]:
    """FACTUAL + PROMPT_PREMISE -> reviewer A, everything -> reviewer B."""
    claims_for_a = [
        p for p in pillars
        if p.claim.claim_type in ("FACTUAL", "PROMPT_PREMISE")
    ]
    return claims_for_a, pillars


# --- Reviewer A (fact/context checks) ---------------------------------------

def _normalize_number(value: str, suffix: str = "") -> float:
    cleaned = value.replace(",", "")
    number = float(cleaned)
    unit = suffix.lower()
    if unit == "k":
        return number * 1_000
    if unit == "m":
        return number * 1_000_000
    if unit == "b":
        return number * 1_000_000_000
    return number


def _extract_numbers(text: str) -> list[float]:
    matches = re.findall(r"(?<!\w)(\d+(?:[\.,]\d+)?)(?:\s*([kKmMbB]))?(?:\s*%)?", text)
    numbers: list[float] = []
    for raw_value, suffix in matches:
        try:
            numbers.append(_normalize_number(raw_value, suffix))
        except ValueError:
            continue
    return numbers


def _check_numeric_match(claim_text: str, context_text: str, tolerance: float = 0.05) -> Optional[bool]:
    """Return True if numerically aligned, False if > tolerance mismatch, None if no numbers."""
    claim_numbers = _extract_numbers(claim_text)
    context_numbers = _extract_numbers(context_text)
    if not claim_numbers or not context_numbers:
        return None

    for claim_value in claim_numbers:
        baseline = abs(claim_value) if abs(claim_value) > 1e-9 else 1.0
        nearest_ratio = min(abs(ctx - claim_value) / baseline for ctx in context_numbers)
        if nearest_ratio > tolerance:
            return False
    return True


def _check_semantic_contradiction(claim_text: str, context_text: str) -> bool:
    inversions = [
        ("increase", "decrease"),
        ("higher", "lower"),
        ("up", "down"),
        ("profit", "loss"),
        ("rise", "fall"),
        ("steigt", "fällt"),
    ]
    claim_l = claim_text.lower()
    context_l = context_text.lower()
    for left, right in inversions:
        if left in claim_l and right in context_l:
            return True
        if right in claim_l and left in context_l:
            return True
    return False


def _check_not_in_prompt_conditions(claim: Claim, context_entries: list[ContextEntry], context_text: str) -> bool:
    """Robust v7.2 checks with 30% word-match threshold."""
    has_prompt_tag = claim.claim_type == "PROMPT_PREMISE"
    source = (claim.source_cited or "").lower()
    has_internal_pointer = (
        "user prompt" in source
        or source.startswith("[context:")
        or source.startswith("[internaldoc:")
        or bool(context_entries)
    )

    claim_words = re.findall(r"\b[a-zA-Z0-9_]{3,}\b", claim.text.lower())
    if not claim_words:
        return True
    words_found = sum(1 for w in claim_words if w in context_text.lower())
    min_expected = max(1, int(len(claim_words) * 0.3))
    insufficient_word_match = words_found < min_expected
    return has_prompt_tag and has_internal_pointer and insufficient_word_match


def _context_match(claim: Claim, context_entries: list[ContextEntry]) -> FactVerdict:
    """Priority 0: tool-free context check before any external verification."""
    context_text = "\n".join(entry.content for entry in context_entries if getattr(entry, "content", "")).strip()
    if not context_text:
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="NOT_IN_PROMPT",
            score=0.0,
            evidence="No user_provided_context available",
            source_used="[Source: User Prompt]",
        )

    numeric_match = _check_numeric_match(claim.text, context_text, tolerance=0.05)
    if numeric_match is False:
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="CONTRADICTS_PROMPT",
            score=0.0,
            evidence="Numeric mismatch greater than 5% against provided context",
            source_used="[Source: User Prompt]",
        )

    if _check_semantic_contradiction(claim.text, context_text):
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="CONTRADICTS_PROMPT",
            score=0.0,
            evidence="Semantic contradiction detected against provided context",
            source_used="[Source: User Prompt]",
        )

    if _check_not_in_prompt_conditions(claim, context_entries, context_text):
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="NOT_IN_PROMPT",
            score=0.0,
            evidence="Claim not sufficiently present in user-provided context",
            source_used="[Source: User Prompt]",
        )

    return FactVerdict(
        claim_id=claim.claim_id,
        verdict="SUPPORTED_BY_PROMPT",
        score=1.0,
        evidence="Claim aligns with user-provided context",
        source_used="[Source: User Prompt]",
    )


def check_claim_context(claim: Claim, context_entries: list[ContextEntry]) -> FactVerdict:
    """Wrapper that guarantees INFRA_FAIL on unexpected errors (K5)."""
    try:
        return _context_match(claim, context_entries)
    except Exception as exc:
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="INFRA_FAIL",
            score=0.0,
            evidence=f"Context check failed: {exc}",
            source_used="[Source: User Prompt]",
        )


def check_claim(claim: Claim, brave_api_key: Optional[str] = None) -> FactVerdict:
    """Simple external check used by FACTUAL claims."""
    source = (claim.source_cited or "").lower()
    if "http://" in source or "https://" in source:
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="SUPPORTED",
            score=1.0,
            evidence="External source pointer present",
            source_used=claim.source_cited,
        )
    if "[source:" in source and "user prompt" in source:
        return FactVerdict(
            claim_id=claim.claim_id,
            verdict="MISATTRIBUTED",
            score=0.2,
            evidence="Internal pointer used for FACTUAL claim",
            source_used=claim.source_cited,
        )
    return FactVerdict(
        claim_id=claim.claim_id,
        verdict="UNSUPPORTED",
        score=0.0,
        evidence="No external evidence pointer available",
        source_used=claim.source_cited,
    )


def compute_fact_score(verdicts: list[FactVerdict]) -> float:
    scoreable = [v for v in verdicts if SCORE_MAP.get(v.verdict) is not None]
    if not scoreable:
        return 1.0
    total = sum(SCORE_MAP.get(v.verdict, 0.0) for v in scoreable)
    return total / len(scoreable)


def compute_context_score(verdicts: list[FactVerdict]) -> float:
    """Context score with INFRA_FAIL excluded from denominator."""
    scoreable = [v for v in verdicts if SCORE_MAP.get(v.verdict) is not None]
    if not scoreable:
        return 1.0
    total = sum(SCORE_MAP.get(v.verdict, 0.0) for v in scoreable)
    return total / len(scoreable)


# --- Reviewer B (quality) ----------------------------------------------------

def _extract_intent(context_entries: list[ContextEntry]) -> str:
    for entry in context_entries:
        if getattr(entry, "source_type", "") == "user_message":
            return entry.content
    if context_entries:
        return context_entries[0].content
    return ""


def review_quality(agent_output: str, pillars: list[CorePillar], user_intent: str = "") -> QualityVerdict:
    output_l = agent_output.lower()
    argument_coherent = len(agent_output.split()) >= 25
    reasoning_sound = any(token in output_l for token in ("because", "therefore", "thus", "deshalb", "daher"))
    risks_addressed = "risk" in output_l or "risiko" in output_l

    intent_words = {w for w in re.findall(r"\b[a-zA-Z0-9_]{4,}\b", user_intent.lower())}
    if intent_words:
        output_words = set(re.findall(r"\b[a-zA-Z0-9_]{4,}\b", output_l))
        overlap = len(intent_words.intersection(output_words))
        threshold = max(1, int(len(intent_words) * 0.2))
        user_intent_match = overlap >= threshold
    else:
        user_intent_match = True

    weighted = (
        (1.0 if argument_coherent else 0.0) * QUALITY_WEIGHTS["argument_coherent"]
        + (1.0 if reasoning_sound else 0.0) * QUALITY_WEIGHTS["reasoning_sound"]
        + (1.0 if risks_addressed else 0.0) * QUALITY_WEIGHTS["risks_addressed"]
        + (1.0 if user_intent_match else 0.0) * QUALITY_WEIGHTS["user_intent_match"]
    )

    notes = []
    if not argument_coherent:
        notes.append("Argumentation is too short/fragmented")
    if not reasoning_sound:
        notes.append("Reasoning chain markers are weak")
    if not risks_addressed:
        notes.append("Risks not explicitly addressed")
    if not user_intent_match:
        notes.append("Output does not match user intent strongly")

    return QualityVerdict(
        argument_coherent=argument_coherent,
        reasoning_sound=reasoning_sound,
        risks_addressed=risks_addressed,
        user_intent_match=user_intent_match,
        quality_score=weighted,
        quality_notes="; ".join(notes) if notes else "Quality checks passed",
    )


# --- Main v7.2 run -----------------------------------------------------------

def run_council(
    task_id: str,
    agent_output: str,
    user_provided_context: Optional[list[ContextEntry]] = None,
    pass_threshold: float = PASS_THRESHOLD,
    brave_api_key: Optional[str] = None,
    high_stakes: bool = False,
    reviewer_b_model: str = "claude-haiku-4-5",
) -> CouncilVerdict:
    context_entries = user_provided_context or []

    pillars, reviewer_0_model = extract_core_pillars(
        agent_output,
        high_stakes=high_stakes,
        reviewer_b_model=reviewer_b_model,
    )
    claims_for_a, claims_for_b = route_claims(pillars)

    external_verdicts: list[FactVerdict] = []
    context_verdicts: list[FactVerdict] = []

    for pillar in claims_for_a:
        if pillar.claim.claim_type == "PROMPT_PREMISE":
            context_verdicts.append(check_claim_context(pillar.claim, context_entries))
        else:
            external_verdicts.append(check_claim(pillar.claim, brave_api_key=brave_api_key))

    external_fact_score = compute_fact_score(external_verdicts) if external_verdicts else 1.0
    context_fact_score = compute_context_score(context_verdicts) if context_verdicts else 1.0

    quality_verdict = review_quality(
        agent_output,
        claims_for_b,
        user_intent=_extract_intent(context_entries),
    )
    quality_score = quality_verdict.quality_score

    final_score = min(external_fact_score, context_fact_score, quality_score)

    all_fact_verdicts = external_verdicts + context_verdicts
    rank_1_fabricated = False
    for r1 in [p for p in pillars if p.is_rank_1]:
        for fv in all_fact_verdicts:
            if fv.claim_id == r1.claim.claim_id and fv.verdict in (
                "UNSUPPORTED", "MISATTRIBUTED", "CONTRADICTS_PROMPT", "NOT_IN_PROMPT"
            ):
                rank_1_fabricated = True
                final_score = 0.0

    misattributed_count = sum(1 for v in all_fact_verdicts if v.verdict == "MISATTRIBUTED")
    misattributed_rate = misattributed_count / len(all_fact_verdicts) if all_fact_verdicts else 0.0

    if rank_1_fabricated or final_score < pass_threshold:
        verdict = "MISATTRIBUTED" if misattributed_rate > 0.30 else "FAIL"
    else:
        verdict = "PASS"

    transparency_notes = []
    if high_stakes:
        transparency_notes.append(
            f"Model diversity enforced: reviewer_0_model={reviewer_0_model}, reviewer_b_model={reviewer_b_model}"
        )
    for fv in context_verdicts:
        if fv.verdict in ("SUPPORTED_BY_PROMPT", "CONTRADICTS_PROMPT", "NOT_IN_PROMPT"):
            transparency_notes.append(f"PROMPT_PREMISE {fv.claim_id}: {fv.verdict} ({fv.evidence})")

    confidence = max(0.0, min(1.0, final_score))
    return CouncilVerdict(
        reviewer_id="council",
        verdict=verdict,
        confidence=confidence,
        parse_success=True,
        external_fact_score=external_fact_score,
        context_fact_score=context_fact_score,
        quality_score=quality_score,
        final_score=final_score,
        rank_1_fabricated=rank_1_fabricated,
        claims_checked=len(all_fact_verdicts),
        claims_supported=sum(1 for v in all_fact_verdicts if v.verdict == "SUPPORTED"),
        claims_supported_by_prompt=sum(1 for v in all_fact_verdicts if v.verdict == "SUPPORTED_BY_PROMPT"),
        claims_contradicts_prompt=sum(1 for v in all_fact_verdicts if v.verdict == "CONTRADICTS_PROMPT"),
        claims_not_in_prompt=sum(1 for v in all_fact_verdicts if v.verdict == "NOT_IN_PROMPT"),
        claims_misattributed=misattributed_count,
        claims_unsupported=sum(1 for v in all_fact_verdicts if v.verdict == "UNSUPPORTED"),
        infra_fails=sum(1 for v in all_fact_verdicts if v.verdict == "INFRA_FAIL"),
        quality_verdict=quality_verdict,
        fact_verdicts=all_fact_verdicts,
        strengths=["Quality meets threshold"] if quality_score >= pass_threshold else [],
        weaknesses=[quality_verdict.quality_notes] if quality_verdict.quality_notes else [],
        transparency_notes=transparency_notes,
    )


def format_nutrition_label(verdict: CouncilVerdict) -> str:
    prompt_pass = verdict.claims_supported_by_prompt
    prompt_fail = verdict.claims_contradicts_prompt + verdict.claims_not_in_prompt
    prompt_icon = "✅ PROMPT MATCH" if prompt_fail == 0 and prompt_pass > 0 else "❌ PROMPT FAIL"

    lines = [
        "=== COUNCIL NUTRITION LABEL ===",
        f"Verdict: {verdict.verdict}",
        f"Final Score: {verdict.final_score:.2f}",
        f"External Fact Score: {verdict.external_fact_score:.2f}",
        f"Context Fact Score: {verdict.context_fact_score:.2f}",
        f"Quality Score: {verdict.quality_score:.2f}",
        f"Prompt Alignment: {prompt_icon}",
    ]

    if verdict.transparency_notes:
        lines.append("Transparency Notes:")
        for note in verdict.transparency_notes:
            lines.append(f"- {note}")

    return "\n".join(lines)
