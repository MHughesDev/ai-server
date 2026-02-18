# 08 StrategyEngine Spec

## Purpose
Select pipeline and reasoning strategy from intent, confidence, complexity, and policy constraints.

## Strategy Set
`reactive_chat`, `rag_chat`, `planner_executor`, `tool_agent`, `multimodal_reasoner`.

## Outputs
`pipeline_type`, `strategy_id`, `verification_level`, `fallback_plan`.

## Rules
Low confidence + high risk routes to stricter verification or clarification path.
