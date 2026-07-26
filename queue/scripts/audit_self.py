"""Queue-system self-audit: validate files and referenced assets exist."""

from __future__ import annotations

import sys
from pathlib import Path

QUEUE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = QUEUE_ROOT.parent
sys.path.insert(0, str(QUEUE_ROOT))

from dev_mcp.queue_ops import validate_archive, validate_open


REQUIRED_PATHS = [
    "queue/queue.csv",
    "queue/queuearchive.csv",
    "queue/QUEUE_INSTRUCTIONS.md",
    "queue/QUEUE_AGENT_PROMPT.md",
    "queue/queue.lock",
    "queue/docs/queue-system-overview.md",
    "queue/docs/queue-categories.md",
    "queue/docs/queue-intelligence.md",
    "queue/procedures/start-queue-item.md",
    "queue/procedures/archive-queue-item.md",
    "queue/procedures/add-queue-category.md",
    "queue/procedures/implement-change.md",
    "queue/procedures/validate-change.md",
    "queue/procedures/open-pull-request.md",
    "queue/procedures/handoff.md",
    ".cursor/rules/queue.md",
    "queue/prompts/queue_worker_executor.md",
    "queue/prompts/queue_processor.md",
    "queue/skills/README.md",
    "queue/skills/queue-triage.md",
    "queue/skills/queue-triage.py",
    "queue/skills/queue-intelligence.md",
    "queue/skills/queue-intelligence.py",
    "queue/skills/task-planning.md",
    "queue/skills/implementation-handoff.md",
    "queue/skills/queue-seeder.py",
    "queue/dev_mcp/queue_ops/__init__.py",
    "queue/dev_mcp/queue_ops/py.typed",
    "queue/dev_mcp/queue_ops/test_queue_ops.py",
    "queue/scripts/queue-top-item.sh",
    "queue/scripts/queue_top_item.py",
    "queue/scripts/queue-peek.sh",
    "queue/scripts/queue_peek.py",
    "queue/scripts/queue-validate.sh",
    "queue/scripts/queue_validate.py",
    "queue/scripts/queue-archive.sh",
    "queue/scripts/queue_archive.py",
    "queue/scripts/queue-graph.sh",
    "queue/scripts/queue_graph.py",
    "queue/scripts/queue-analyze.sh",
    "queue/scripts/queue_analyze.py",
    "queue/scripts/queue-pr-merge.sh",
    "queue/scripts/queue_pr_merge.py",
    "queue/scripts/skills-list.sh",
    "queue/scripts/skills_list.py",
    "queue/scripts/audit-self.sh",
    "queue/scripts/audit_self.py",
    "queue/scripts/idea-to-queue.sh",
    "Makefile",
]


def main() -> int:
    errors: list[str] = []

    for rel in REQUIRED_PATHS:
        if not (REPO_ROOT / rel).exists():
            errors.append(f"missing required file: {rel}")

    errors.extend(validate_open(QUEUE_ROOT / "queue.csv"))
    errors.extend(validate_archive(QUEUE_ROOT / "queuearchive.csv"))

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print("Queue audit OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
