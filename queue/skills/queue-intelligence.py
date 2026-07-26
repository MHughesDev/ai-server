# queue/skills/queue-intelligence.py
"""Queue dependency graph, complexity, batching, conflicts, and CLI."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# --- Existing graph helpers (kept) ---


def load_graph(path: Path) -> dict[str, list[str]]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    start = 1 if lines and lines[0].startswith("#") else 0
    reader = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    rows = list(reader)
    ids = {(row.get("id") or "").strip() for row in rows if (row.get("id") or "").strip()}
    graph: dict[str, list[str]] = {}
    for row in rows:
        qid = (row.get("id") or "").strip()
        if not qid:
            continue
        deps = [d.strip() for d in (row.get("dependencies") or "").split(",") if d.strip()]
        graph[qid] = [d for d in deps if d in ids]
    return graph


def kahn(graph: dict[str, list[str]]) -> tuple[list[str] | None, bool]:
    """Return (topological_order, has_cycle)."""

    indeg = dict.fromkeys(graph, 0)
    adj: dict[str, list[str]] = defaultdict(list)
    for n, deps in graph.items():
        for d in deps:
            if d in graph:
                indeg[n] += 1
                adj[d].append(n)
    q: deque[str] = deque(sorted(k for k, v in indeg.items() if v == 0))
    out: list[str] = []
    while q:
        u = q.popleft()
        out.append(u)
        for v in adj.get(u, []):
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(out) != len(graph):
        return None, True
    return out, False


PATH_RE = re.compile(r"(?:apps|packages|deploy)/[\w./-]+|\.cursor/rules/[\w.-]+\.md")


@dataclass
class QueueItem:
    id: str
    batch: str
    phase: str
    category: str
    summary: str
    dependencies: list[str]
    related_files: str
    notes: str
    created_date: str
    status: str = ""


@dataclass
class ComplexityScore:
    value: int
    label: str
    factors: list[str]


@dataclass
class ConflictReport:
    item_a: str
    item_b: str
    overlapping_patterns: list[str]
    risk: str


class DependencyGraph:
    """Wraps Kahn + adjacency for queue items."""

    def __init__(self, items: list[QueueItem], archived_ids: set[str]) -> None:
        self.items = {i.id: i for i in items}
        self.archived_ids = archived_ids
        self._graph: dict[str, list[str]] = {}
        self._build()

    def _build(self) -> None:
        ids = set(self.items)
        for qid, item in self.items.items():
            self._graph[qid] = [d for d in item.dependencies if d in ids]

    def get_ready_items(self) -> list[QueueItem]:
        ready: list[QueueItem] = []
        for item in self.items.values():
            if all(d in self.archived_ids for d in item.dependencies):
                ready.append(item)
        return sorted(ready, key=lambda x: x.id)

    def get_blocked_items(self) -> list[tuple[QueueItem, list[str]]]:
        out: list[tuple[QueueItem, list[str]]] = []
        for item in self.items.values():
            missing = [d for d in item.dependencies if d not in self.archived_ids]
            if missing:
                out.append((item, missing))
        return out

    def detect_cycles(self) -> list[list[str]]:
        order, cyc = kahn(self._graph)
        if not cyc:
            return []
        # Approximate: nodes not in a successful topo order
        seen = set(order or [])
        return [sorted([n for n in self._graph if n not in seen])] if cyc else []

    def render_mermaid(self) -> str:
        lines = ["graph TD"]
        blocked = {i.id for i, _ in self.get_blocked_items()}
        for qid, item in sorted(self.items.items()):
            safe = re.sub(r"[^\w]", "_", qid)
            style = ":::blocked" if qid in blocked else ""
            summ = (item.summary[:40] + "…") if len(item.summary) > 40 else item.summary
            lines.append(f'  {safe}["{qid}<br/>{summ}"]{style}')
        for qid, deps in self._graph.items():
            safe = re.sub(r"[^\w]", "_", qid)
            for d in deps:
                ds = re.sub(r"[^\w]", "_", d)
                lines.append(f"  {ds} --> {safe}")
        lines.append("  classDef blocked fill:#f88,stroke:#333;")
        return "\n".join(lines)

    def topological_sort(self) -> list[QueueItem]:
        order, cyc = kahn(self._graph)
        if cyc or order is None:
            return list(self.items.values())
        return [self.items[i] for i in order if i in self.items]


class ComplexityScorer:
    """Heuristic S/M/L/XL complexity."""

    _CAT_WEIGHT = {"infrastructure": 3, "security": 3, "core-api": 2, "testing": 1}

    def score(self, item: QueueItem, _archive: list[QueueItem]) -> ComplexityScore:
        factors: list[str] = []
        score = 1
        slen = len(item.summary)
        if slen > 200:
            score += 2
            factors.append("long summary")
        elif slen > 80:
            score += 1
            factors.append("medium summary")
        nd = len(item.dependencies)
        score += min(nd, 4)
        if nd:
            factors.append(f"{nd} dependencies")
        score += self._CAT_WEIGHT.get(item.category.lower(), 1)
        factors.append(f"category={item.category}")
        value = max(1, min(10, score))
        label = "S" if value <= 3 else "M" if value <= 5 else "L" if value <= 8 else "XL"
        return ComplexityScore(value=value, label=label, factors=factors)


class BatchSuggester:
    """Group items into suggested batches."""

    _MOD = re.compile(r"apps/api/src/([^/]+)/")

    def suggest(self, items: list[QueueItem]) -> list[list[QueueItem]]:
        if not items:
            return []
        by_batch: dict[str, list[QueueItem]] = defaultdict(list)
        for it in items:
            by_batch[it.batch or "default"].append(it)
        groups: list[list[QueueItem]] = []
        for batch_items in by_batch.values():
            by_mod: dict[str, list[QueueItem]] = defaultdict(list)
            for it in batch_items:
                mods = self._MOD.findall(it.summary)
                key = mods[0] if mods else "_ungrouped"
                by_mod[key].append(it)
            for g in by_mod.values():
                groups.append(g)
        return [g for g in groups if len(g) > 1] or [items]


class ConflictDetector:
    """Detect overlapping file/module references between open items."""

    def detect(self, items: list[QueueItem]) -> list[ConflictReport]:
        refs: dict[str, list[str]] = {}
        for it in items:
            combined = f"{it.summary}\n{it.related_files}"
            refs[it.id] = PATH_RE.findall(combined)
        reports: list[ConflictReport] = []
        ids = list(refs.keys())
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                sa, sb = set(refs[a]), set(refs[b])
                overlap = sorted(sa & sb)
                if not overlap:
                    continue
                n = len(overlap)
                if n > 3:
                    risk = "high"
                elif n >= 1:
                    risk = "medium"
                else:
                    risk = "low"
                reports.append(
                    ConflictReport(
                        item_a=a,
                        item_b=b,
                        overlapping_patterns=overlap,
                        risk=risk,
                    )
                )
        return reports


def load_items(path: Path) -> list[QueueItem]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    start = 1 if lines and lines[0].startswith("#") else 0
    reader = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    out: list[QueueItem] = []
    for row in reader:
        qid = (row.get("id") or "").strip()
        if not qid:
            continue
        deps = [d.strip() for d in (row.get("dependencies") or "").split(",") if d.strip()]
        out.append(
            QueueItem(
                id=qid,
                batch=(row.get("batch") or "").strip(),
                phase=(row.get("phase") or "").strip(),
                category=(row.get("category") or "").strip(),
                summary=(row.get("summary") or "").strip(),
                dependencies=deps,
                related_files=(row.get("related_files") or "").strip(),
                notes=(row.get("notes") or "").strip(),
                created_date=(row.get("created_date") or "").strip(),
            )
        )
    return out


def load_archive_ids(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    start = 1 if lines and lines[0].startswith("#") else 0
    reader = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    done: set[str] = set()
    for row in reader:
        if (row.get("status") or "").strip().lower() in {"done", "complete", "completed"}:
            qid = (row.get("id") or "").strip()
            if qid:
                done.add(qid)
    return done


def full_analysis(repo_root: Path) -> dict[str, Any]:
    qpath = repo_root / "queue" / "queue.csv"
    apath = repo_root / "queue" / "queuearchive.csv"
    items = load_items(qpath)
    archived = load_archive_ids(apath)
    dg = DependencyGraph(items, archived)
    scorer = ComplexityScorer()
    archive_rows = load_items(apath) if apath.is_file() else []
    scores = {it.id: scorer.score(it, archive_rows) for it in items}
    return {
        "ready_items": [i.id for i in dg.get_ready_items()],
        "blocked_items": [(i.id, m) for i, m in dg.get_blocked_items()],
        "cycles": dg.detect_cycles(),
        "complexity_scores": {k: {"value": v.value, "label": v.label, "factors": v.factors} for k, v in scores.items()},
        "batch_suggestions": [[x.id for x in g] for g in BatchSuggester().suggest(items)],
        "conflicts": [
            {
                "a": c.item_a,
                "b": c.item_b,
                "overlap": c.overlapping_patterns,
                "risk": c.risk,
            }
            for c in ConflictDetector().detect(items)
        ],
    }


def _print_report(data: dict[str, Any]) -> None:
    print(json.dumps(data, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Queue intelligence")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_graph = sub.add_parser("graph", help="Print Mermaid dependency graph")
    p_analyze = sub.add_parser("analyze", help="Full analysis JSON")
    p_ready = sub.add_parser("ready", help="Ready item IDs")
    p_blocked = sub.add_parser("blocked", help="Blocked items with missing deps")

    for p in (p_graph, p_analyze, p_ready, p_blocked):
        p.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])

    args = parser.parse_args()
    root = args.repo_root
    qpath = root / "queue" / "queue.csv"
    if not qpath.is_file():
        print(f"Missing {qpath}", file=sys.stderr)
        return 1

    items = load_items(qpath)
    archived = load_archive_ids(root / "queue" / "queuearchive.csv")
    dg = DependencyGraph(items, archived)

    if args.cmd == "graph":
        print(dg.render_mermaid())
        return 0
    if args.cmd == "ready":
        for i in dg.get_ready_items():
            print(i.id)
        return 0
    if args.cmd == "blocked":
        for item, missing in dg.get_blocked_items():
            print(f"{item.id}: missing {','.join(missing)}")
        return 0
    if args.cmd == "analyze":
        _print_report(full_analysis(root))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
