import { SpecialCharacters } from "../constants";
import { InlineStyleApplier } from '@utils/inline-style-applier';
import { getEntries } from '@utils/utils';

export class NodeUtils {
  /**
   * Wraps all lines (detected by Unix/Windows/Mac newlines) with `<p>` tags,
   * ensuring open elements are correctly closed between lines, removing empty
   * spans, and separating leading markers into their own `<span>`.
   *
   * @param node - The root node whose child content should be processed.
   */
  public static wrapAllLinesWithParagraphs(node: Node): void {
    if (!node) return;

    // 1) Serialize existing child content to raw HTML
    const html = this.serializeChildrenToHTML(node);

    // 2) Convert that raw HTML into an array of “lines” (strings)
    //    taking care to properly open/close tags around newlines.
    const lines = this.domToLines(html);

    // 3) Clear the original node’s child content
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    // 4) Final post-processing on each line, then wrap in <p>
    for (const rawLine of lines) {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) continue; // skip purely empty lines

      // a) Split out leading Markers into a separate <span>
      const withSplitMarkers = this.separateLeadingMarkers(trimmedLine);

      // b) Remove any empty <span></span>
      const cleanedLine = this.removeEmptySpans(withSplitMarkers);

      // c) Create a <p> wrapping the final line
      const p = document.createElement("p");
      // TODO: When using tabstop mode, add tabstops here (tab-stops:left 27.88pt left 55.75pt left 83.63pt;)
      p.setAttribute(
        "style",
        `${getEntries(InlineStyleApplier.getRootStyleProperties()).map(([key, value]) => {
          return `${key}: ${value}`;
        }).join("; ")};`
      );
      p.innerHTML = cleanedLine;
      node.appendChild(p);
    }
  }

  /**
   * Recursively traverses a node's children and wraps text nodes inside `<span>` elements.
   */
  public static wrapAllTextNodesWithSpan(node: Node): void {
    node.childNodes.forEach((child: ChildNode): void => {
      if (this.isTextNode(child) && !this.isInsideSpan(child) && child.nodeValue?.trim() !== "") {
        const span: HTMLSpanElement = document.createElement(SpecialCharacters.SPAN_TAG);
        span.textContent = child.nodeValue;
        node.replaceChild(span, child);
      } else if (this.isHtmlElement(child)) {
        this.wrapAllTextNodesWithSpan(child);
      }
    });
  }

  /**
   * Converts all child nodes of the given node into a single raw HTML string.
   */
  private static serializeChildrenToHTML(node: Node): string {
    return Array.from(node.childNodes)
      .map((child) => {
        const container = document.createElement("div");
        container.appendChild(child.cloneNode(true));
        return container.innerHTML;
      })
      .join("");
  }

  /**
   * Takes raw HTML, parses it, and returns an array of lines. Each line is
   * produced by splitting on `\r?\n` and closing/reopening any still-open
   * tags between lines. This preserves the same “open tag / close tag”
   * logic that was previously inlined in the old method.
   */
  private static domToLines(html: string): string[] {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    const lines: string[] = [];
    let currentLine = "";

    // We'll store { tagName, openTagString } so we can re-open them after a newline
    const openElements: { tagName: string; openTag: string }[] = [];

    // Helper to finalize the current line and start a new one
    const commitLine = (): void => {
      // Close all open tags
      for (let i = openElements.length - 1; i >= 0; i--) {
        currentLine += `</${openElements[i].tagName}>`;
      }

      // We push it if it’s non-blank
      if (currentLine.trim() !== "") {
        lines.push(currentLine);
      }

      // Reset
      currentLine = "";

      // Re-open those tags for the next line
      openElements.forEach(({ openTag }) => {
        currentLine += openTag;
      });
    };

    // Recursive function to traverse the DOM
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        const textLines = text.split(/\r?\n/);

        textLines.forEach((segment, i) => {
          if (i > 0) {
            // We hit a newline boundary
            commitLine();
          }
          currentLine += segment;
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        // Construct an opening tag with attributes
        const attrs = Array.from(el.attributes)
          .map((attr) => ` ${attr.name}="${attr.value}"`)
          .join("");
        const openTag = `<${tagName}${attrs}>`;

        // Push our open-tag record
        openElements.push({ tagName, openTag });
        // Write the open tag
        currentLine += openTag;

        // Process children
        el.childNodes.forEach(processNode);

        // Pop from openElements
        openElements.pop();
        // Write the close tag
        currentLine += `</${tagName}>`;
      }
    };

    // Process top-level children in temp
    temp.childNodes.forEach(processNode);

    // Commit any leftover text if it’s non-empty
    if (currentLine.trim() !== "") {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Looks at the very start of a line for a run of one or more space
   * characters and splits them into a separate <span>. For example:
   * `<span>   Hello</span>` becomes `<span>   </span><span>Hello</span>`.
   */
  private static separateLeadingMarkers(lineHtml: string): string {
    const div = document.createElement("div");
    div.innerHTML = lineHtml;
    console.log("Separate line: ", lineHtml);

    const firstChild = div.firstChild;
    if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE && (firstChild as HTMLElement).tagName.toLowerCase() === "span") {
      const spanEl = firstChild as HTMLSpanElement;
      if (spanEl.childNodes.length === 1 && spanEl.firstChild && spanEl.firstChild.nodeType === Node.TEXT_NODE) {
        const text = spanEl.textContent || "";
        const match = text.match(new RegExp(`^(${SpecialCharacters.MARKER}+)(.*)$`));
        if (match) {
          const [, leadingMarkers, rest] = match;

          if (rest.length === 0) {
            // Entire string is just markers
            spanEl.textContent = leadingMarkers;
            spanEl.setAttribute("style", "mso-spacerun:yes");
            return div.innerHTML;
          } else {
            // spanEl.classList.add("MARKER");
            console.log("Leading: ", leadingMarkers);
            console.log("Rest: ", rest)
            spanEl.textContent = leadingMarkers; // keep the leading markers here
            spanEl.setAttribute("style", "mso-spacerun:yes");
            // TODO: Add processing / formatting here...
            // TODO: Maybe directly replace the markers in here? Would be mixed up but more efficient...
            // TODO: When using tab-mode, add/replace it with <span style="mso-tab-count:1">&#9;One Tab</span>

            const newSpan = document.createElement("span");
            newSpan.textContent = rest.trimStart(); // put the remainder in a new span

            div.insertBefore(newSpan, spanEl.nextSibling);
            return div.innerHTML;
          }
        }
      }
    }

    return lineHtml;
  }

  /**
   * Removes empty `<span></span>` tags in a given string of HTML.
   */
  private static removeEmptySpans(html: string): string {
    return html.replace(/<span[^>]*><\/span>/g, "");
  }

  /** Determines if the given node is an HTMLElement. */
  public static isHtmlElement(node?: Node | null): node is HTMLElement {
    return !!node && node.nodeType === Node.ELEMENT_NODE;
  }

  /** Determines if the given node is a Text node. */
  public static isTextNode(node?: Node | null): node is Text {
    return !!node && node.nodeType === Node.TEXT_NODE;
  }

  /** Checks if the given node is inside a `<span>`. */
  public static isInsideSpan(node: Node): boolean {
    let parent: ParentNode | null = node.parentNode;
    while (parent) {
      if (parent.nodeName.toLowerCase() === SpecialCharacters.SPAN_TAG) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  }
}
