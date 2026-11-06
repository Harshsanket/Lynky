import type {
  Override,
  Provider,
} from "./schemas/providers.js";

export interface OverrideIssue {
  overrideIndex: number;
  provider: string;
  code: string;
  message: string;
}

const addUnique = (
  target: string[],
  values: string[],
  label: string,
  issues: OverrideIssue[],
  overrideIndex: number,
  provider: string,
  existingKind: "set" | "list"
): void => {
  const seen = new Set(existingKind === "set" ? [] : target);

  for (const value of values) {
    if (existingKind === "set" && target.includes(value)) {
      issues.push({
        overrideIndex,
        provider,
        code: "duplicate_value",
        message: `${label} already contains ${JSON.stringify(value)}`,
      });
      continue;
    }

    if (existingKind === "list" && seen.has(value)) {
      issues.push({
        overrideIndex,
        provider,
        code: "duplicate_value",
        message: `${label} already contains ${JSON.stringify(value)}`,
      });
      continue;
    }

    target.push(value);
    seen.add(value);
  }
};

const removeValues = (
  target: string[],
  values: string[],
  label: string,
  issues: OverrideIssue[],
  overrideIndex: number,
  provider: string
): void => {
  for (const value of values) {
    const index = target.indexOf(value);

    if (index === -1) {
      issues.push({
        overrideIndex,
        provider,
        code: "missing_value",
        message: `${label} does not contain ${JSON.stringify(value)}`,
      });
      continue;
    }

    target.splice(index, 1);
  }
};

/**
 * Apply local overrides to the generated ClearURLs provider list.
 *
 * The vendored upstream file is never edited. Provider order is preserved:
 * patches happen in place and additions append in override order.
 */
export const applyProviderOverrides = (
  providers: readonly Provider[],
  overrides: readonly Override[]
): { providers: Provider[]; issues: OverrideIssue[] } => {
  const result = providers.map((provider) => ({
    ...provider,
    hostHints: [...provider.hostHints],
    rules: [...provider.rules],
    referralMarketing: [...provider.referralMarketing],
    exceptions: [...provider.exceptions],
    redirections: [...provider.redirections],
    rawRules: [...provider.rawRules],
  }));
  const issues: OverrideIssue[] = [];

  const findIndex = (id: string) =>
    result.findIndex((provider) => provider.id === id);

  overrides.forEach((override, overrideIndex) => {
    const { provider, action } = override;
    const index = findIndex(provider);

    if (action === "add") {
      if (!override.providerDefinition) {
        issues.push({
          overrideIndex,
          provider,
          code: "missing_definition",
          message: "add overrides require providerDefinition",
        });
        return;
      }

      if (override.providerDefinition.id !== provider) {
        issues.push({
          overrideIndex,
          provider,
          code: "id_mismatch",
          message: `providerDefinition.id must equal ${JSON.stringify(provider)}`,
        });
        return;
      }

      if (index !== -1) {
        issues.push({
          overrideIndex,
          provider,
          code: "duplicate_provider",
          message: `provider ${JSON.stringify(provider)} already exists`,
        });
        return;
      }

      result.push({
        ...override.providerDefinition,
        hostHints: [...override.providerDefinition.hostHints],
        rules: [...override.providerDefinition.rules],
        referralMarketing: [
          ...override.providerDefinition.referralMarketing,
        ],
        exceptions: [...override.providerDefinition.exceptions],
        redirections: [...override.providerDefinition.redirections],
        rawRules: [...override.providerDefinition.rawRules],
      });
      return;
    }

    if (index === -1) {
      issues.push({
        overrideIndex,
        provider,
        code: "missing_provider",
        message: `provider ${JSON.stringify(provider)} does not exist`,
      });
      return;
    }

    const target = result[index]!;

    if (action === "remove" || action === "disable") {
      result.splice(index, 1);
      return;
    }

    if (override.addRules) {
      addUnique(
        target.rules,
        override.addRules,
        "rules",
        issues,
        overrideIndex,
        provider,
        "list"
      );
    }

    if (override.removeRules) {
      removeValues(
        target.rules,
        override.removeRules,
        "rules",
        issues,
        overrideIndex,
        provider
      );
    }

    if (override.addExceptions) {
      addUnique(
        target.exceptions,
        override.addExceptions,
        "exceptions",
        issues,
        overrideIndex,
        provider,
        "list"
      );
    }

    if (override.removeExceptions) {
      removeValues(
        target.exceptions,
        override.removeExceptions,
        "exceptions",
        issues,
        overrideIndex,
        provider
      );
    }

    if (override.addRedirections) {
      addUnique(
        target.redirections,
        override.addRedirections,
        "redirections",
        issues,
        overrideIndex,
        provider,
        "list"
      );
    }

    if (override.removeRedirections) {
      removeValues(
        target.redirections,
        override.removeRedirections,
        "redirections",
        issues,
        overrideIndex,
        provider
      );
    }

    if (override.addHostHints) {
      addUnique(
        target.hostHints,
        override.addHostHints,
        "hostHints",
        issues,
        overrideIndex,
        provider,
        "set"
      );
    }

    if (override.removeHostHints) {
      removeValues(
        target.hostHints,
        override.removeHostHints,
        "hostHints",
        issues,
        overrideIndex,
        provider
      );
    }

    if (override.setCompleteProvider !== undefined) {
      target.completeProvider = override.setCompleteProvider;
    }
  });

  const ids = new Set<string>();

  for (const provider of result) {
    if (ids.has(provider.id)) {
      issues.push({
        overrideIndex: -1,
        provider: provider.id,
        code: "duplicate_provider",
        message: `provider ${JSON.stringify(provider.id)} is duplicated`,
      });
    }

    ids.add(provider.id);
  }

  return { providers: result, issues };
};
