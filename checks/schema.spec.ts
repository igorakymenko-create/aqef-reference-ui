import { test, expect } from "@playwright/test";
import {
  assemble,
  yamlText,
  parseSource,
  equal,
  normalized,
} from "../src/workspace/model";
test("prose-derived authoring schema rejects type coercion and conditional property violations", () => {
  const good = {
    project: {
      name: "schema-only",
      environments: [
        {
          name: "local",
          model_version: "m",
          prompt_version: "p",
          tool_configuration: null,
          infra_target: "local",
        },
      ],
      suites: [
        {
          name: "s",
          scenarios: [
            {
              name: "a",
              prompt: { template: "Hello" },
              contract: {
                constraints: [
                  {
                    validator: "schema",
                    target: "response",
                    expected: { type: "string" },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };
  const source = (value: any) => [
    { path: "project.yaml", content: yamlText(value), etag: null },
  ];
  expect(assemble(source(good)).issues).toEqual([]);
  for (const value of ["0.8", true]) {
    const bad = structuredClone(good) as any;
    bad.project.suites[0].scenarios[0].contract = {
      expectations: [
        {
          criteria: "[grounding] Check",
          judge: { model: "m", confidence_source: "self_rating" },
          confidence_threshold: value,
        },
      ],
    };
    expect(
      assemble(source(bad)).issues.some((issue) =>
        issue.includes("confidence_threshold"),
      ),
    ).toBe(true);
  }
  const mixed = structuredClone(good) as any;
  mixed.project.suites[0].scenarios[0].variables = {};
  mixed.project.suites[0].scenarios[0].dataset = "data@1";
  expect(assemble(source(mixed)).issues.length).toBeGreaterThan(0);
  const nullEnv = structuredClone(good) as any;
  nullEnv.project.environments[0].prompt_version = null;
  expect(
    assemble(source(nullEnv)).issues.some((issue) =>
      issue.includes("prompt_version"),
    ),
  ).toBe(true);
  expect(() =>
    parseSource({
      path: "flow.yaml",
      content: "project: {variables: {ToKeN: hidden}}",
      etag: null,
    }),
  ).toThrow("Sensitive key");
  expect(
    equal(
      "Constraint",
      { validator: "schema", target: "response", expected: {} },
      {
        validator: "schema",
        target: "response",
        expected: {},
        dimension: "functional",
        veto: false,
      },
    ),
  ).toBe(true);
  expect(
    equal(
      "Constraint",
      { validator: "schema", target: "response", expected: {}, veto: null },
      { validator: "schema", target: "response", expected: {}, veto: false },
    ),
  ).toBe(false);
  expect(
    normalized("Project", { name: "p", contracts: null }).contracts,
  ).toBeNull();
  expect(
    equal(
      "Suite",
      { name: "s", scenarios: [], execution: {} },
      {
        name: "s",
        scenarios: [],
        execution: { on_seeded_control_miss: "skip_class" },
      },
    ),
  ).toBe(false);
  expect(() =>
    parseSource({
      path: "safe-prompt.yaml",
      etag: null,
      content:
        "project:\n  name: literal\n  note: |\n    password: this is prompt text, not a key\n",
    }),
  ).not.toThrow("Sensitive key");
});
