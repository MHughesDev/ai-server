# 00 System Overview

## Purpose
Single-entry multimodal AI server that routes each request to the best pipeline under policy, budget, and safety controls.

## Non-Goals
- Thin model proxy.
- Cognition in ingress.
- Unbounded tool execution.

## High-Level Flow
Edge -> Ingress -> Brain Stem -> Policy/Strategy -> Router -> Pipeline Harness -> Synthesizer -> Response

## Core Ideas
- Strict cognition boundary.
- One primary endpoint (`POST /v1/query`).
- Pluggable pipelines.
- Mandatory model/tool/memory gateways.
- Full tracing and cost visibility.
