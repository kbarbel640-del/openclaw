"""
Verification Gates — deterministic checks on agent output.
No LLM needed. Pure code.
"""
import os
import subprocess
import ast
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Literal, Optional


@dataclass
class VerificationResult:
    passed: bool = False
    needs_council: bool = False
    layer_failed: Optional[str] = None  # "structural" | "grounding" | None
    details: str = ""
    checks: list[dict] = field(default_factory=list)
    summary: str = ""

    def add_check(self, name: str, passed: bool, detail: str = ""):
        self.checks.append({"name": name, "passed": passed, "detail": detail})

    def evaluate(self):
        """Set overall passed based on all checks."""
        self.passed = all(c["passed"] for c in self.checks) if self.checks else False
        failed = [c for c in self.checks if not c["passed"]]
        if failed:
            self.summary = "FAILED: " + "; ".join(c["name"] + ": " + c["detail"] for c in failed)
        else:
            self.summary = f"ALL {len(self.checks)} CHECKS PASSED"
        return self


VALID_POINTER_PATTERN = re.compile(
    r"\[Source:\s*(https?://\S+|User Prompt|Task [^\]]+|Report [^\]]+|Output [^\]]+|Research [^\]]+|Analysis [^\]]+)\]"
    r"|\[Context:\s*[^\]]+\]"
    r"|\[InternalDoc:\s*[^\]]+\]",
    re.IGNORECASE,
)


def classify_pointer(pointer: str) -> Literal["external", "internal", "dependency", "none"]:
    """Classify source pointers for research gating and transparency."""
    if not pointer:
        return "none"
    value = pointer.strip()
    if not VALID_POINTER_PATTERN.search(value):
        return "none"

    lower = value.lower()
    if "http://" in lower or "https://" in lower:
        return "external"
    if lower.startswith("[context:") or lower.startswith("[internaldoc:") or "user prompt" in lower:
        return "internal"
    if any(token in lower for token in ("[source: task ", "[source: report ", "[source: output ")):
        return "dependency"
    return "internal"


def count_sources(output: str) -> dict[str, int]:
    """Count source pointers by category."""
    counts = {
        "external_sources_count": 0,
        "internal_sources_count": 0,
        "dependency_sources_count": 0,
    }
    for match in VALID_POINTER_PATTERN.finditer(output):
        pointer = match.group(0)
        pointer_type = classify_pointer(pointer)
        if pointer_type == "external":
            counts["external_sources_count"] += 1
        elif pointer_type == "internal":
            counts["internal_sources_count"] += 1
        elif pointer_type == "dependency":
            counts["dependency_sources_count"] += 1
    return counts


def verify_files_exist(files: list[str], base_dir: str = ".") -> VerificationResult:
    """Gate 1: Do the required output files actually exist?"""
    result = VerificationResult()
    for f in files:
        path = Path(base_dir) / f
        exists = path.exists()
        size = path.stat().st_size if exists else 0
        result.add_check(
            f"file_exists:{f}",
            exists and size > 0,
            f"{'exists' if exists else 'MISSING'} ({size}B)" if exists else "FILE NOT FOUND"
        )
    return result.evaluate()


def verify_python_syntax(files: list[str], base_dir: str = ".") -> VerificationResult:
    """Gate 2: Does the Python code parse without syntax errors?"""
    result = VerificationResult()
    for f in files:
        if not f.endswith(".py"):
            continue
        path = Path(base_dir) / f
        if not path.exists():
            result.add_check(f"syntax:{f}", False, "file not found")
            continue
        try:
            source = path.read_text()
            ast.parse(source)
            result.add_check(f"syntax:{f}", True, "valid Python")
        except SyntaxError as e:
            result.add_check(f"syntax:{f}", False, f"SyntaxError line {e.lineno}: {e.msg}")
    return result.evaluate()


def verify_no_dangerous_imports(files: list[str], base_dir: str = ".",
                                 forbidden: list[str] = None) -> VerificationResult:
    """Gate 3: AST-based import whitelist check."""
    if forbidden is None:
        forbidden = ["subprocess", "shutil.rmtree", "os.system"]
    
    result = VerificationResult()
    for f in files:
        if not f.endswith(".py"):
            continue
        path = Path(base_dir) / f
        if not path.exists():
            continue
        try:
            tree = ast.parse(path.read_text())
            found_imports = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in forbidden:
                            found_imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module in forbidden:
                        found_imports.append(node.module)
            
            if found_imports:
                result.add_check(f"imports:{f}", False, f"forbidden: {found_imports}")
            else:
                result.add_check(f"imports:{f}", True, "clean")
        except SyntaxError:
            result.add_check(f"imports:{f}", False, "can't parse")
    return result.evaluate()


def verify_tests(test_command: str, cwd: str = ".", timeout: int = 30) -> VerificationResult:
    """Gate 4: Run tests and check they pass."""
    result = VerificationResult()
    try:
        proc = subprocess.run(
            test_command, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=timeout
        )
        passed = proc.returncode == 0
        output = (proc.stdout + proc.stderr)[-500:]  # Last 500 chars
        result.add_check("tests", passed, output.strip() if not passed else "all passed")
    except subprocess.TimeoutExpired:
        result.add_check("tests", False, f"TIMEOUT after {timeout}s")
    except Exception as e:
        result.add_check("tests", False, str(e))
    return result.evaluate()


def verify_lint(lint_command: str, cwd: str = ".", timeout: int = 15) -> VerificationResult:
    """Gate 5: Run linter and check for errors."""
    result = VerificationResult()
    try:
        proc = subprocess.run(
            lint_command, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=timeout
        )
        passed = proc.returncode == 0
        output = (proc.stdout + proc.stderr)[-300:]
        result.add_check("lint", passed, output.strip() if not passed else "clean")
    except subprocess.TimeoutExpired:
        result.add_check("lint", False, f"TIMEOUT after {timeout}s")
    except Exception as e:
        result.add_check("lint", False, str(e))
    return result.evaluate()


def run_full_verification(contract, base_dir: str = ".") -> VerificationResult:
    """Run all applicable verification gates for a contract."""
    combined = VerificationResult()
    
    # Gate 1: Files exist
    if contract.required_files:
        r = verify_files_exist(contract.required_files, base_dir)
        combined.checks.extend(r.checks)
    
    # Gate 2: Python syntax
    py_files = [f for f in contract.required_files if f.endswith(".py")]
    if py_files:
        r = verify_python_syntax(py_files, base_dir)
        combined.checks.extend(r.checks)
    
    # Gate 3: Dangerous imports
    if py_files:
        r = verify_no_dangerous_imports(py_files, base_dir)
        combined.checks.extend(r.checks)
    
    # Gate 4: Tests
    if contract.run_tests:
        r = verify_tests(contract.run_tests, base_dir)
        combined.checks.extend(r.checks)
    
    # Gate 5: Lint
    if contract.run_lint:
        r = verify_lint(contract.run_lint, base_dir)
        combined.checks.extend(r.checks)
    
    return combined.evaluate()


def run_non_coding_verification(output: str, contract) -> VerificationResult:
    from governed_agents.profiles import get_profile
    from governed_agents.structural_gate import run_structural_gate
    from governed_agents.grounding_gate import run_grounding_gate

    if contract.task_type == "custom" or contract.verification_mode == "deterministic":
        return VerificationResult(
            passed=True,
            needs_council=True,
            details="No structural/grounding gates for custom task type",
        )

    profile = get_profile(contract.task_type)

    if profile.get("structural_checks"):
        s_result = run_structural_gate(output, profile)
        if not s_result.passed:
            return VerificationResult(
                passed=False,
                needs_council=False,
                layer_failed="structural",
                details=s_result.summary,
            )

    if profile.get("grounding_checks"):
        g_result = run_grounding_gate(output, profile)
        if not g_result.passed:
            return VerificationResult(
                passed=False,
                needs_council=False,
                layer_failed="grounding",
                details=g_result.summary,
            )

    # v7.2 Research Gate Fix: track external/internal sources separately.
    if contract.task_type == "research":
        source_counts = count_sources(output)
        external_min = profile.get("min_external_sources", 1)
        internal_min = profile.get("min_internal_sources", 0)
        if source_counts["external_sources_count"] < external_min:
            return VerificationResult(
                passed=False,
                needs_council=False,
                layer_failed="grounding",
                details=(
                    f"Research Gate: external sources too low "
                    f"({source_counts['external_sources_count']} < {external_min})"
                ),
            )
        if source_counts["internal_sources_count"] < internal_min:
            return VerificationResult(
                passed=False,
                needs_council=False,
                layer_failed="grounding",
                details=(
                    f"Research Gate: internal sources too low "
                    f"({source_counts['internal_sources_count']} < {internal_min})"
                ),
            )

    return VerificationResult(
        passed=True,
        needs_council=True,
        details="Structural + Grounding gates passed — Council required",
    )
