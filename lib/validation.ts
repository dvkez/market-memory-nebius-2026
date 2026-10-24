import { z } from "zod";
import type { Source, Report } from "./domain.ts";
const claim = z.object({ text: z.string().min(1).max(900), sourceIds: z.array(z.string()).min(1).max(8) }).strict();
export const reportSchema = z.object({
  headline: z.string().min(1).max(160), summary: z.array(claim).min(1).max(4),
  changes: z.array(claim).max(4), contradictions: z.array(claim).max(4),
  limitations: z.array(z.string().max(300)).max(5),
  charts: z.array(z.object({ kind: z.enum(["price_sentiment","volume","scatter"]), title: z.string().max(100) }).strict()).min(1).max(3),
}).strict();
export function validateReport(value: unknown, sources: Source[]): Report {
  const result = reportSchema.parse(value);
  const ids = new Set(sources.map(s => s.id));
  for (const c of [...result.summary,...result.changes,...result.contradictions]) {
    if (c.sourceIds.some(id => !ids.has(id))) throw new Error("Nebius report referenced an unknown source.");
    if (/<\/?[a-z]/i.test(c.text)) throw new Error("Nebius report contained unsupported markup.");
  }
  const charts = new Set<string>();
  result.charts = result.charts.filter(c => charts.has(c.kind) ? false : (charts.add(c.kind),true));
  return result;
}
const labels = z.object({ labels: z.array(z.object({ id: z.string(), sentiment: z.union([z.literal(-1),z.literal(0),z.literal(1)]), topic: z.string().max(80), rationale: z.string().max(300) }).strict()) }).strict();
export function classifySources(value: unknown, sources: Source[]): Source[] {
  const result = labels.parse(value);
  const map = new Map(result.labels.map(l => [l.id,l]));
  const ids = new Set(sources.map(s => s.id));
  if (map.size !== sources.length || result.labels.length !== sources.length || result.labels.some(l => !ids.has(l.id))) throw new Error("Nebius classification did not match the source set.");
  return sources.map(s => ({ ...s, ...map.get(s.id)! }));
}
