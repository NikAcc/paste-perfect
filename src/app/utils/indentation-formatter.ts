import { IndentationModeValue } from "@types";
import { RegexPatterns } from "../regex/regex-patterns";
import { HTML_CODE_SELECTOR, INDENTATION_MODE_MAP, SpecialCharacters } from "../constants";
import { RegexFlags } from "../regex/regex-flags";

/**
 * Provides utilities for handling indentation in highlighted code by masking and replacing indentation markers.
 *
 * This class helps standardize indentation formatting by:
 * - Masking leading whitespace and tab characters in highlighted code with special markers.
 * - Replacing those markers with the correct indentation format based on the specified mode (Tabs, Spaces, or Non-Breaking Spaces).
 */
export class IndentationFormatter {
  /**
   * Masks indentation by replacing:
   *  - Each leading whitespace character with one {@link MARKER}.
   *  - Each leading tab character with "tabSize"-many {@link MARKER}`.
   *
   * @param preElement The highlighted code container.
   * @param tabSize The number of spaces per tab.
   */
  public static maskIndentation(preElement: HTMLPreElement | null | undefined, tabSize: number): void {
    const codeElement: HTMLElement = preElement?.querySelector(HTML_CODE_SELECTOR) as HTMLElement;

    if (!preElement || !codeElement) return;

    // Match all leading whitespaces or tabs
    codeElement.innerHTML = codeElement.innerHTML.replace(RegexPatterns.INDENTATION_REGEX, (match: string): string =>
      match
        // Replace all leading whitespaces
        .replace(RegexPatterns.WHITESPACE_REGEX, SpecialCharacters.MARKER)
        // Replace all leading tabs
        .replace(RegexPatterns.TAB_REGEX, SpecialCharacters.MARKER.repeat(tabSize))
    );
  }

  /**
   * Replaces special markers in highlighted code to maintain correct indentation.
   *
   * @param node The highlighted code container.
   * @param mode The indentation mode (Tabs, Spaces, Non-Breaking Spaces).
   * @param tabSize The number of spaces per tab.
   */
  public static replaceMarkers(node: HTMLElement, mode: IndentationModeValue, tabSize: number): void {
    let replacementSymbol;
    if (mode === INDENTATION_MODE_MAP.Tabs) {
      // Special handling for tabs
      const tabRegex = new RegExp(`(${SpecialCharacters.MARKER}){${tabSize}}`, RegexFlags.GLOBAL);
      node.innerHTML = node.innerHTML
        // Replace "tabSize" markers with one tab
        .replace(tabRegex, SpecialCharacters.TAB)
        // Replace remaining markers with spaces
        .replace(RegexPatterns.MARKER_REGEX, SpecialCharacters.SPACE);
    } else {
      // TODO: Whitespaces fixen / Stackoverflow fragen https://stigmortenmyre.no/mso/html/concepts/ofconwhitespace.htm
      if (mode === INDENTATION_MODE_MAP.Spaces) {
        // Replace each marker with a space
        replacementSymbol = SpecialCharacters.SPACE;
      } else {
        // INDENTATION_MODE_MAP.NON_BREAKING_SPACES
        // Replace each marker with a non-breaking space
        replacementSymbol = SpecialCharacters.NON_BREAKING_SPACE;
      }
      node.innerHTML = node.innerHTML.replace(RegexPatterns.MARKER_REGEX, replacementSymbol);
    }
  }
}
