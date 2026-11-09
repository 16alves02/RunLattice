import { describe, expect, it } from "vitest";
import { renderInputTemplate } from "@/lib/template";

describe("workflow input templates", () => {
  it("renders nested string, number and boolean values", () => {
    expect(renderInputTemplate("New order: {{input.order.id}} · {{input.order.total}} · {{input.order.paid}}", {
      order: { id: "A-102", total: 42.5, paid: true },
    })).toBe("New order: A-102 · 42.5 · true");
  });

  it("leaves ordinary text unchanged", () => {
    expect(renderInputTemplate("A static notification", {})).toBe("A static notification");
  });

  it("rejects missing paths and non-scalar values", () => {
    expect(() => renderInputTemplate("{{input.customer.email}}", {})).toThrow(/unavailable/);
    expect(() => renderInputTemplate("{{input.customer}}", { customer: { name: "A" } })).toThrow(/string, number or boolean/);
  });

  it("blocks prototype-related paths", () => {
    expect(() => renderInputTemplate("{{input.constructor.name}}", {})).toThrow(/forbidden/);
    expect(() => renderInputTemplate("{{input.__proto__.polluted}}", {})).toThrow(/forbidden/);
  });

  it("JSON-encodes scalar input values for HTTP request bodies", () => {
    const rendered = renderInputTemplate('{"name": {{input.customer.name}}, "count": {{input.count}}}', {
      customer: { name: 'A "quoted" value' },
      count: 3,
    }, 65_536, true);
    expect(JSON.parse(rendered)).toEqual({ name: 'A "quoted" value', count: 3 });
  });

  it("makes an explicitly mapped prior HTTP response value available to later actions", () => {
    const rendered = renderInputTemplate('{"invoiceId": {{input.steps.http_action.responseValue}}}', {
      steps: { http_action: { httpStatus: 200, responseValue: "inv_123" } },
    }, 65_536, true);
    expect(JSON.parse(rendered)).toEqual({ invoiceId: "inv_123" });
  });

  it("supports a larger explicit limit for bounded HTTP payloads", () => {
    expect(renderInputTemplate("{{input.payload}}", { payload: "x".repeat(4_000) }, 65_536)).toHaveLength(4_000);
    expect(() => renderInputTemplate("{{input.payload}}", { payload: "x".repeat(4_000) }, 2_000)).toThrow(/2,000 characters/);
  });

  it("rejects a rendered message longer than Discord's limit", () => {
    expect(() => renderInputTemplate("{{input.message}}", { message: "x".repeat(2_001) })).toThrow(/2,000 characters/);
  });
});
