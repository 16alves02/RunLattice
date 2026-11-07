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

  it("rejects a rendered message longer than Discord's limit", () => {
    expect(() => renderInputTemplate("{{input.message}}", { message: "x".repeat(2_001) })).toThrow(/2,000 characters/);
  });
});
