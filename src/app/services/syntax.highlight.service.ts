import { computed, inject, Injectable, Signal } from "@angular/core";
import * as Prism from "prismjs";

import { HTML_CODE_PRE_SELECTOR, HTML_CODE_SELECTOR } from "../constants";
import { SettingsService } from "./settings.service";
import { MessageService } from "primeng/api";
import { IndentationModeValue, LanguageDefinition } from "@types";
import { PrismLangLoaderService } from "@services/prism-lang-loader.service";
import { NodeUtils } from "@utils/node-utils";
import { InlineStyleApplier } from "@utils/inline-style-applier";
import { IndentationFormatter } from "@utils/indentation-formatter";
import { SanitizerWrapper } from "@utils/sanitizer";
import formatXml from "xml-formatter";

/**
 * A service responsible for syntax highlighting and clipboard copying of code snippets.
 * Uses Prism.js for syntax highlighting and applies minimal inline styles for clipboard copying.
 */
@Injectable({
  providedIn: "root",
})
export class SyntaxHighlightService {
  /**
   * Service for managing the highlighting settings.
   */
  private settingsService: SettingsService = inject(SettingsService);

  /**
   * Service for loading the required prism languages dynamically.
   */
  private prismLanguageLoaderService: PrismLangLoaderService = inject(PrismLangLoaderService);

  /**
   * PrimeNGs messages service for displaying toasts to the user
   */
  private messageService: MessageService = inject(MessageService);

  /**
   * Signal representing the current indentation mode (e.g., tabs or spaces).
   */
  private mode: Signal<IndentationModeValue> = computed(() => this.settingsService.editorSettings.indentationMode);

  /**
   * Signal representing the current tab size setting.
   */
  private tabSize: Signal<number> = computed(() => this.settingsService.editorSettings.indentationSize);

  /**
   * Highlights a code snippet using Prism.js.
   *
   * @param code The raw code to highlight.
   * @param language The language for syntax highlighting.
   * @returns A Promise resolving to an HTML string with syntax-highlighted code.
   */
  public async highlightCode(code: string, language: LanguageDefinition): Promise<string> {
    // Replace vertical tabs with a newline if needed
    const sanitizedCode = SanitizerWrapper.sanitizeInput(code);

    if (!Prism.languages[language.value]) {
      // Load prism language if it hasn't already been loaded before
      await this.prismLanguageLoaderService.loadPrismLanguage(language);
    }

    // Use Prism to highlight
    return Prism.highlight(sanitizedCode, Prism.languages[language.value], language.value);
  }

  /**
   * Copies the currently highlighted code from the DOM into the clipboard,
   * including minimal inline styling (such as color and font settings).
   *
   * Notes:
   * - Looks for the `<pre><code>` snippet in the DOM.
   * - Replaces leading spaces and wraps text nodes so copying preserves indentation.
   */
  public copyToClipboard() {
    const preElement: HTMLPreElement = document.querySelector(HTML_CODE_PRE_SELECTOR) as HTMLPreElement;
    if (!preElement) {
      this.messageService.add({
        severity: "warn",
        summary: "No code available",
        detail: "Please enter some code before copying.",
      });
      return;
    }

    // Clone the node
    const clonedElement: HTMLPreElement = preElement.cloneNode(true) as HTMLPreElement;
    const codeElement: HTMLElement = clonedElement?.querySelector(HTML_CODE_SELECTOR) as HTMLElement;
    if (!codeElement) return;

    // TODO: Useful order:
    // 1. Apply minimal inline styles and remember root styles
    // 2. Mask Indentation
    // 3. Wrap all text nodes with span
    // 4 .Wrap all lines with paragraphs
    // 5. Replace markers

    // Apply inline styles to ensure color/font are carried over
    InlineStyleApplier.applyMinimalInlineStyles(preElement, clonedElement, true);

    // Mask the indentation
    IndentationFormatter.maskIndentation(clonedElement, this.tabSize());

    // Wrap all text nodes in a span element so that we can apply inline styles
    NodeUtils.wrapAllTextNodesWithSpan(clonedElement);

    // console.log("wrapped with span: ");
    // console.log(formatXml(clonedElement.outerHTML.replaceAll("\n", "NL"), { indentation: "  " }));
    NodeUtils.wrapAllLinesWithParagraphs(codeElement);
    console.log(formatXml(clonedElement.outerHTML, { indentation: "  " }));
    console.log("WrappedElem: ", clonedElement);

    // NodeUtils.wrapLinesInParagraphs(codeElement);
    // console.log("P-Wrapped : ", clonedElement.outerHTML);

    // Replace the markers
    IndentationFormatter.replaceMarkers(clonedElement, this.mode(), this.tabSize());

    console.log("Final: ", clonedElement);

    // Extract and sanitize HTML
    const htmlSnippet: string = SanitizerWrapper.sanitizeOutput(clonedElement.outerHTML);
    // Extract plain text as fallback
    const textSnippet: string = clonedElement.outerText;

    // Write to clipboard in both 'text/html' and 'text/plain' forms
    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/html": new Blob([htmlSnippet], { type: "text/html" }),
          "text/plain": new Blob([textSnippet], { type: "text/plain" }),
        }),
      ])
      .then(() => {
        this.messageService.add({
          severity: "success",
          summary: "Copied successfully",
          detail: "The code has been copied to your clipboard.",
        });
      })
      .catch((err) => {
        this.messageService.add({
          severity: "error",
          summary: "Copy failed",
          detail: "An error occurred while copying the code. Please try again.",
        });
        console.error("Failed to copy:", err);
      });
  }
}
