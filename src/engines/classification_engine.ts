/**
 * Classification Engine – classifies content with model-based or heuristic classification.
 * Production: Uses Model Gateway for intent/complexity detection.
 * @see Architecture §10.6; SOW M1
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

export interface ClassificationEngineOptions {
  modelGateway?: IModelGateway;
  /** Default model for classification */
  classificationModel?: string;
}

/** Standard classification labels */
export const CLASSIFICATION_LABELS = {
  intent: ["query", "command", "chat", "coding", "extraction", "analysis", "generation"],
  complexity: ["simple", "moderate", "complex"],
  urgency: ["low", "normal", "high", "critical"],
  domain: ["general", "technical", "business", "creative", "scientific"],
  risk: ["safe", "caution", "review_required"],
} as const;

export type IntentLabel = (typeof CLASSIFICATION_LABELS.intent)[number];
export type ComplexityLabel = (typeof CLASSIFICATION_LABELS.complexity)[number];
export type UrgencyLabel = (typeof CLASSIFICATION_LABELS.urgency)[number];
export type DomainLabel = (typeof CLASSIFICATION_LABELS.domain)[number];
export type RiskLabel = (typeof CLASSIFICATION_LABELS.risk)[number];

export interface ClassificationResult {
  intent: IntentLabel;
  complexity: ComplexityLabel;
  urgency: UrgencyLabel;
  domain: DomainLabel;
  risk: RiskLabel;
  confidence: number;
  all_labels: string[];
  raw_scores: Record<string, number>;
}

function createClassificationArtifact(result: ClassificationResult): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "classification_result",
    schema_ref: "schema://classification_result@v1",
    encoding: "json",
    content: { inline: result },
  };
}

function extractTextFromArtifacts(artifacts: TypedArtifact[]): string {
  const texts: string[] = [];
  for (const artifact of artifacts) {
    const content = artifact.content as { inline?: string | Record<string, unknown>; uri?: string } | undefined;
    if (typeof content?.inline === "string") {
      texts.push(content.inline);
    } else if (typeof content?.inline === "object" && content.inline !== null) {
      // Try to extract text from common fields
      const obj = content.inline;
      const textField = obj.text ?? obj.content ?? obj.prompt ?? obj.query ?? JSON.stringify(obj);
      if (typeof textField === "string") texts.push(textField);
    }
  }
  return texts.join(" ").slice(0, 2000); // Limit input size
}

async function classifyWithModel(
  modelGateway: IModelGateway,
  text: string,
  model: string
): Promise<ClassificationResult> {
  const prompt = `Analyze the following text and classify it into categories.

Text: """${text.slice(0, 1500)}"""

Provide classification in this exact JSON format:
{
  "intent": "query|command|chat|coding|extraction|analysis|generation",
  "complexity": "simple|moderate|complex",
  "urgency": "low|normal|high|critical",
  "domain": "general|technical|business|creative|scientific",
  "risk": "safe|caution|review_required",
  "confidence": 0.0-1.0,
  "raw_scores": {
    "intent_query": 0.0-1.0,
    "intent_coding": 0.0-1.0,
    "complexity_moderate": 0.0-1.0,
    ...
  }
}

Respond only with the JSON object.`;

  try {
    const result = await modelGateway.complete({ prompt, max_tokens: 400, model });
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ClassificationResult>;
      return {
        intent: (parsed.intent as IntentLabel) ?? "query",
        complexity: (parsed.complexity as ComplexityLabel) ?? "simple",
        urgency: (parsed.urgency as UrgencyLabel) ?? "normal",
        domain: (parsed.domain as DomainLabel) ?? "general",
        risk: (parsed.risk as RiskLabel) ?? "safe",
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.8)),
        all_labels: [
          parsed.intent ?? "query",
          parsed.complexity ?? "simple",
          parsed.urgency ?? "normal",
          parsed.domain ?? "general",
          parsed.risk ?? "safe",
        ],
        raw_scores: parsed.raw_scores ?? {},
      };
    }
  } catch (err) {
    // Fall back to heuristic
  }

  return performHeuristicClassification(text);
}

function performHeuristicClassification(text: string): ClassificationResult {
  const lowerText = text.toLowerCase();

  // Intent detection
  let intent: IntentLabel = "query";
  if (lowerText.includes("code") || lowerText.includes("function") || lowerText.includes("class")) intent = "coding";
  else if (lowerText.includes("extract") || lowerText.includes("parse")) intent = "extraction";
  else if (lowerText.includes("analyze") || lowerText.includes("compare")) intent = "analysis";
  else if (lowerText.includes("generate") || lowerText.includes("create") || lowerText.includes("write")) intent = "generation";
  else if (lowerText.includes("hello") || lowerText.includes("hi ") || lowerText.includes("chat")) intent = "chat";
  else if (lowerText.startsWith("do ") || lowerText.startsWith("run ") || lowerText.startsWith("execute")) intent = "command";

  // Complexity
  let complexity: ComplexityLabel = "simple";
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 100 || text.includes("and") && text.split("and").length > 3) complexity = "complex";
  else if (wordCount > 30) complexity = "moderate";

  // Domain
  let domain: DomainLabel = "general";
  if (lowerText.includes("api") || lowerText.includes("code") || lowerText.includes("data")) domain = "technical";
  else if (lowerText.includes("business") || lowerText.includes("revenue") || lowerText.includes("customer")) domain = "business";
  else if (lowerText.includes("art") || lowerText.includes("creative") || lowerText.includes("story")) domain = "creative";
  else if (lowerText.includes("research") || lowerText.includes("study") || lowerText.includes("experiment")) domain = "scientific";

  // Risk
  let risk: RiskLabel = "safe";
  if (lowerText.includes("delete") || lowerText.includes("remove") || lowerText.includes("password")) risk = "caution";
  if (lowerText.includes("private key") || lowerText.includes("ssn") || lowerText.includes("credit card")) risk = "review_required";

  // Urgency
  let urgency: UrgencyLabel = "normal";
  if (lowerText.includes("urgent") || lowerText.includes("asap") || lowerText.includes("emergency")) urgency = "high";
  if (lowerText.includes("critical") || lowerText.includes("outage") || lowerText.includes("down")) urgency = "critical";

  return {
    intent,
    complexity,
    urgency,
    domain,
    risk,
    confidence: 0.7,
    all_labels: [intent, complexity, urgency, domain, risk],
    raw_scores: { [intent]: 0.8, [complexity]: 0.7, [domain]: 0.75 },
  };
}

export function createClassificationEngine(options: ClassificationEngineOptions = {}): IEngine {
  const { modelGateway, classificationModel = "gpt-4o-mini" } = options;

  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      // Handle both full EngineInvocation and simplified test objects
      const textFromArtifacts = extractTextFromArtifacts(inv.context_artifacts ?? []);
      const textFromPrompt = (inv as unknown as { prompt?: string }).prompt ?? "";
      const text = textFromArtifacts || textFromPrompt || "general query";

      let classification: ClassificationResult;

      if (modelGateway && text.length > 0) {
        try {
          classification = await classifyWithModel(modelGateway, text, classificationModel);
        } catch (err) {
          classification = performHeuristicClassification(text);
          classification.all_labels.push("model_fallback");
        }
      } else {
        classification = performHeuristicClassification(text);
      }

      const durationMs = Date.now() - start;
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [createClassificationArtifact(classification)],
        confidence: classification.confidence,
        metrics: { duration_ms: durationMs },
        proposed_next_action: classification.complexity === "complex" ? { type: "request_replan" } : { type: "none" },
      };
    },
  };
}
