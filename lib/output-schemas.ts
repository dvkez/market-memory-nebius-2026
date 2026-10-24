// Provider-side constraints complement the independent Zod validation on return.
const text = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const list = (items: unknown, minItems: number, maxItems: number) => ({ type: "array", items, minItems, maxItems });
export function classificationOutput(ids: string[]) {
  const label=object({ sentiment: { type: "integer", enum: [-1, 0, 1] }, topic: text(60), rationale: text(120) });
  return object({ labels: object(Object.fromEntries(ids.map(id=>[id,label]))) });
}
export function reportOutput(ids: string[]) {
  const claim = object({ text: text(900), sourceIds: list({ type: "string", enum: ids }, 1, 8) });
  return object({ headline: text(160), summary: list(claim, 1, 4), changes: list(claim, 0, 4), contradictions: list(claim, 0, 4), limitations: list(text(300), 0, 5), charts: list(object({ kind: { type: "string", enum: ["price_sentiment", "volume", "scatter"] }, title: text(100) }), 1, 3) });
}
