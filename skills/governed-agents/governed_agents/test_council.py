from governed_agents.council import (
    generate_reviewer_prompt, aggregate_votes, CouncilVerdict,
    run_council, Claim, check_claim_context, compute_context_score,
    _check_numeric_match, _context_match,
)
from governed_agents.contract import TaskContract, ContextEntry
from governed_agents.orchestrator import GovernedOrchestrator


def test_prompt_contains_objective():
    prompt = generate_reviewer_prompt("Build cache", ["Key expires", "TTL works"], "I built it")
    assert "Build cache" in prompt
    assert "Key expires" in prompt
    assert "TTL works" in prompt


def test_prompt_contains_json_schema():
    prompt = generate_reviewer_prompt("X", [], "Y")
    assert '"verdict"' in prompt
    assert "approve" in prompt
    assert "reject" in prompt


def test_majority_approve_passes():
    verdicts = [
        CouncilVerdict(reviewer_id="r1", verdict="approve", parse_success=True),
        CouncilVerdict(reviewer_id="r2", verdict="approve", parse_success=True),
        CouncilVerdict(reviewer_id="r3", verdict="reject", parse_success=True),
    ]
    result = aggregate_votes(verdicts)
    assert result.passed is True
    assert abs(result.score - 0.667) < 0.01


def test_majority_reject_fails():
    verdicts = [
        CouncilVerdict(reviewer_id="r1", verdict="reject", parse_success=True),
        CouncilVerdict(reviewer_id="r2", verdict="reject", parse_success=True),
        CouncilVerdict(reviewer_id="r3", verdict="approve", parse_success=True),
    ]
    result = aggregate_votes(verdicts)
    assert result.passed is False


def test_parse_failure_pessimistic():
    v = CouncilVerdict.from_output("this is not json at all", "r1")
    assert v.verdict == "reject"
    assert v.parse_success is False


def test_empty_council_fails():
    result = aggregate_votes([])
    assert result.passed is False
    assert result.score == 0.0


def test_generate_council_tasks_count():
    g = GovernedOrchestrator(
        contract=TaskContract(
            objective="Test", acceptance_criteria=["Works"],
            verification_mode="council", council_size=3,
        ),
        model="anthropic/claude-haiku-4-5",
    )
    prompts = g.generate_council_tasks("output here")
    assert len(prompts) == 3
    assert "[Reviewer 1/3]" in prompts[0]
    assert "[Reviewer 3/3]" in prompts[2]


def test_run_council_prompt_premise_supported():
    context = [
        ContextEntry(
            message_id="m1",
            timestamp="2026-02-24T00:00:00Z",
            content="Revenue was 50 million in Q4 and risks include market slowdown.",
            source_type="user_message",
        )
    ]
    output = "Revenue was 50 million in Q4 [Context: user message]\nBecause this is stable, we proceed.\nRisk: market slowdown."
    verdict = run_council(task_id="t1", agent_output=output, user_provided_context=context)
    assert verdict.context_fact_score == 1.0
    assert verdict.claims_supported_by_prompt >= 1


def test_numeric_mismatch_contradicts_prompt_k4():
    assert _check_numeric_match("Revenue is 53M", "Revenue is 50M", tolerance=0.05) is False
    claim = Claim(claim_id="c1", text="Revenue is 53M", rank=1, claim_type="PROMPT_PREMISE")
    context = [
        ContextEntry(
            message_id="m1",
            timestamp="2026-02-24T00:00:00Z",
            content="Revenue is 50M.",
            source_type="user_message",
        )
    ]
    verdict = _context_match(claim, context)
    assert verdict.verdict == "CONTRADICTS_PROMPT"


def test_context_error_returns_infra_fail_k5(monkeypatch):
    def _boom(_claim, _context):
        raise TimeoutError("simulated timeout")

    monkeypatch.setattr("governed_agents.council._context_match", _boom)
    claim = Claim(claim_id="c2", text="Claim text", rank=1, claim_type="PROMPT_PREMISE")
    verdict = check_claim_context(claim, [])
    assert verdict.verdict == "INFRA_FAIL"


def test_compute_context_score_excludes_infra_fail():
    verdicts = [
        type("V", (), {"verdict": "SUPPORTED_BY_PROMPT"})(),
        type("V", (), {"verdict": "INFRA_FAIL"})(),
    ]
    score = compute_context_score(verdicts)
    assert score == 1.0


def test_task_contract_context_string_migration():
    contract = TaskContract(objective="x", user_provided_context="legacy context")
    assert isinstance(contract.user_provided_context, list)
    assert len(contract.user_provided_context) == 1
    assert contract.user_provided_context[0].content == "legacy context"
