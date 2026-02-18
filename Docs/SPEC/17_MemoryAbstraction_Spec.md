# 17 MemoryAbstraction Spec

## Purpose
Unified governed interface for vector and structured memory.

## Responsibilities
Scope enforcement, retrieval ranking/filtering, write-back governance, TTL/decay, provenance tracking.

## Stores
Vector DB, Postgres (or equivalent), artifact object storage.

## Failure Handling
Safe degrade path when retrieval is empty or stores are unavailable.
