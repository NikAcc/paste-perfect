import { NodeUtils } from "@utils/node-utils";
import { StyleProperties } from "@types";
import { getEntries } from "@utils/utils";

/**
 * This class is necessary because when copying HTML to the clipboard, styles must be applied as inline styles manually.
 * Otherwise, they won't have any effect. This process is not done automatically due to performance reasons — assigning all
 * inline styles to all elements would create a significant overhead. Instead, we manually apply only the essential styles,
 * primarily font-related ones such as font-family and color, while stripping away all others.
 *
 * Additionally, since some text nodes have been converted into span nodes (which would typically inherit properties from
 * their parent), we store the root styles (i.e., styles of the root element) and apply them to these converted text nodes.
 * This ensures that text appearance remains consistent even after transformation.
 */
export class InlineStyleApplier {
  /**
   * Stores computed style properties from the root node for child elements.
   *
   * This is necessary for elements that were previously text nodes and have now been converted into HTML elements.
   * Since these elements did not exist as styled nodes in the original structure, they require explicit styling from
   * the root node to maintain consistency. The stored properties help reapply the correct styles where needed.
   */
  private static rootStyleProperties: StyleProperties = {};

  /**
   * Defines the subset of styles that are copied inline when creating the final snippet. We can also provide default values for which inline styles do not get applied for (i.e., the default font style is "normal" and we don't have to repeat that for every single element)
   *
   * Mostly font-related properties are retained, while background colors, margins, paddings,
   * and other layout styles are excluded. This keeps the copied content lightweight while
   * ensuring textual appearance remains accurate.
   */
  private static readonly RELEVANT_STYLE_PROPERTIES: StyleProperties = {
    color: "rgba(0, 0, 0)", // or undefined if no default should be used
    "font-family": undefined, // use no default font family
    "font-size": undefined, // use not default font size
    "font-style": "normal",
    "font-variant": "normal",
    "font-weight": "400",
  };

  public static getRootStyleProperties(): StyleProperties {
    return this.rootStyleProperties;
  }

  /**
   * Recursively applies minimal inline font styling (color, font-size, etc.) from the original node to the cloned node.
   *
   *  - Only properties specified in `RELEVANT_STYLE_PROPERTIES` are considered to avoid unnecessary inline styles.
   *  - If the node is the root, its computed styles are stored for application to child nodes that require them.
   *  - Converted text nodes (now span elements) are styled explicitly to maintain visual consistency.
   *
   * @param original - The original DOM node to extract computed styles from.
   * @param cloned - The cloned DOM node to apply styles to.
   * @param [isRoot=false] - Indicates if this is the top-level call (used to store root styles).
   */
  static applyMinimalInlineStyles(original: Node, cloned: Node, isRoot = false): void {
    if (isRoot) {
      // Reset root-level styles before processing
      this.rootStyleProperties = {};
    }

    if (NodeUtils.isHtmlElement(original) && NodeUtils.isHtmlElement(cloned)) {
      this.applyElementStyles(original, cloned, isRoot);
    } else if (NodeUtils.isHtmlElement(cloned) && !isRoot) {
      this.applyStoredRootStyles(cloned);
    }

    // Recursively apply styles to child nodes
    cloned.childNodes.forEach((child: ChildNode, index: number): void => {
      if (NodeUtils.isHtmlElement(child)) {
        this.applyMinimalInlineStyles(original.childNodes[index], child);
      }
    });
  }

  /**
   * Extracts and applies computed styles from the original element to the cloned element.
   *
   * - All class attributes are removed since they won't be included in the copied snippet.
   * - Only relevant styles (font and text-related) are applied as inline styles.
   * - If the element is the root, its styles are stored for application to converted text nodes.
   *
   * @param original - The original HTML element from which styles are extracted.
   * @param cloned - The cloned HTML element to which styles will be applied.
   * @param isRoot - Boolean indicating if this element is the root.
   */
  private static applyElementStyles(original: HTMLElement, cloned: HTMLElement, isRoot: boolean): void {
    // Remove classes as they are useless (because only inline styles are copied to clipboard, no stylesheets)
    // cloned.removeAttribute("class");

    // Retrieve computed style for the original element
    const computedStyle: CSSStyleDeclaration = window.getComputedStyle(original);
    let styles = "";

    // Apply only relevant styles
    getEntries(this.RELEVANT_STYLE_PROPERTIES).forEach(([propKey, defaultValue]) => {
      const value: string = computedStyle.getPropertyValue(propKey);

      if (isRoot) {
        // Store root-level styles for later use in child elements
        this.rootStyleProperties[propKey] = value;
      }

      // Apply style only if it's different from the default
      if (value && value !== String(defaultValue)) {
        // Note: We manually escape the values and apply it later on as setProperty would break the escaping for some reason
        styles += `${propKey}: ${value.replace(/"/g, "'")}; `;
      }
    });
    cloned.setAttribute("style", styles);
  }

  // Helper to decode HTML entities
  private static decodeHTMLEntities(str: string) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  /**
   * Applies the stored root-level styles to a non-root element.
   *
   * This is necessary for elements that were originally text nodes but have been converted into span elements.
   * Since such elements do not inherit styles in the usual way, we explicitly reapply the stored styles to maintain
   * text consistency.
   *
   * @param element - The HTML element to which stored root styles will be applied.
   */
  private static applyStoredRootStyles(element: HTMLElement): void {
    // Apply stored root properties to non-root elements that require explicit styling
    getEntries(this.rootStyleProperties).forEach(([propKey, propValue]) => {
      if (propValue && propValue !== this.RELEVANT_STYLE_PROPERTIES[propKey]) {
        element.style.setProperty(propKey, propValue);
      }
    });
  }
}
