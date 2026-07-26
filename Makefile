# Makefile
# Canonical command entrypoint for the replicated queue system.

SHELL := C:/Program Files/Git/bin/bash.exe
.DEFAULT_GOAL := help

.PHONY: help queue-peek queue-top-item queue-validate queue-archive queue-archive-top queue-pr-merge queue-graph queue-analyze idea-queue skills-list audit-self \
        queue\:peek queue\:top-item queue\:validate queue\:archive queue\:archive-top queue\:pr-merge queue\:graph queue\:analyze idea\:queue skills\:list audit\:self

## help: Show queue targets
help:
	@echo "Targets:"
	@grep -E '^##' $(MAKEFILE_LIST) | sed 's/^## //' | column -t -s ':'

## queue-peek: show queue header + first row
queue-peek:
	@queue/scripts/queue-peek.sh

## queue-top-item: print first open row as one JSON line (full item for agents)
queue-top-item:
	@queue/scripts/queue-top-item.sh

## queue-validate: validate queue CSV schema
queue-validate:
	@queue/scripts/queue-validate.sh

## queue-archive: move row to archive (QUEUE_ID= required)
queue-archive:
	@QUEUE_ID="$(QUEUE_ID)" queue/scripts/queue-archive.sh

## queue-archive-top: move first open row to archive (no QUEUE_ID — token-friendly)
queue-archive-top:
	@ARCHIVE_TOP=1 queue/scripts/queue-archive.sh

## queue-pr-merge: after archive+validate — gh pr merge --merge --delete-branch (PR_NUMBER= optional)
queue-pr-merge:
	@PR_NUMBER="$(PR_NUMBER)" queue/scripts/queue-pr-merge.sh

## queue-graph: Mermaid dependency graph
queue-graph:
	@queue/scripts/queue-graph.sh

## queue-analyze: validate + queue intelligence analysis
queue-analyze:
	@queue/scripts/queue-analyze.sh

## skills-list: list available skills
skills-list:
	@queue/scripts/skills-list.sh

## audit-self: queue-system self-audit
audit-self:
	@queue/scripts/audit-self.sh

## idea-queue: queue seeding path
idea-queue:
	@queue/scripts/idea-to-queue.sh

queue\:peek: queue-peek
queue\:top-item: queue-top-item
queue\:validate: queue-validate
queue\:archive: queue-archive
queue\:archive-top: queue-archive-top
queue\:pr-merge: queue-pr-merge
queue\:graph: queue-graph
queue\:analyze: queue-analyze
skills\:list: skills-list
audit\:self: audit-self
idea\:queue: idea-queue
