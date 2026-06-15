from scanner.engine.finding import Finding

SEVERITY_PENALTIES = {
    "critical": 20,
    "high": 10,
    "medium": 5,
    "low": 2,
}


class SecurityScorer:
    """
    Calculates a security score from 0 to 100.
    Starts at 100 and deducts points per vulnerability.
    Penalties decrease globally as more vulnerabilities are found,
    so large codebases with many findings aren't unfairly scored at 0.
    """

    def calculate(self, findings: list[Finding]) -> int:
        if not findings:
            return 100

        # Order by severity so the worst vulnerabilities count at full weight
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        sorted_findings = sorted(
            findings,
            key=lambda f: severity_order.get(f.severity, 4),
        )

        score = 100
        for i, finding in enumerate(sorted_findings, start=1):
            base_penalty = SEVERITY_PENALTIES.get(finding.severity, 2)
            # Global diminishing factor — 1st full, 2nd halved, 3rd /3, etc.
            penalty = base_penalty / i
            score -= penalty

        return max(0, round(score))