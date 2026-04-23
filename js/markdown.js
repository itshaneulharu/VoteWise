/**
 * Lightweight Markdown-to-HTML renderer for VoteWise bot responses.
 * Supports: bold, italic, headings, lists, line breaks, horizontal rules, inline code.
 * No external dependencies.
 */

const MarkdownRenderer = {
  /**
   * Convert a markdown string to sanitized HTML.
   * @param {string} md - Raw markdown text
   * @returns {string} HTML string
   */
  render(md) {
    if (!md) return '';

    let html = this._escapeHtml(md);

    // Headings (### > ## > #)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');

    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Unordered lists (- or *)
    html = this._parseLists(html, /^[\-\*] (.+)$/gm, 'ul');

    // Ordered lists
    html = this._parseLists(html, /^\d+\. (.+)$/gm, 'ol');

    // Paragraphs: wrap remaining loose lines
    html = this._wrapParagraphs(html);

    return html;
  },

  /**
   * Escape HTML special characters to prevent XSS.
   */
  _escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
    return text.replace(/[&<>]/g, c => map[c]);
  },

  /**
   * Parse consecutive list items into <ul>/<ol> blocks.
   */
  _parseLists(html, regex, tag) {
    const lines = html.split('\n');
    const result = [];
    let inList = false;
    const itemRegex = tag === 'ul' ? /^[\-\*] (.+)$/ : /^\d+\. (.+)$/;

    for (const line of lines) {
      const match = line.match(itemRegex);
      if (match) {
        if (!inList) {
          result.push(`<${tag}>`);
          inList = true;
        }
        result.push(`<li>${match[1]}</li>`);
      } else {
        if (inList) {
          result.push(`</${tag}>`);
          inList = false;
        }
        result.push(line);
      }
    }
    if (inList) result.push(`</${tag}>`);

    return result.join('\n');
  },

  /**
   * Wrap loose text lines in <p> tags.
   */
  _wrapParagraphs(html) {
    const blockTags = /^<(h[1-3]|ul|ol|li|\/ul|\/ol|hr|p|\/p|blockquote)/;
    const lines = html.split('\n');
    const result = [];
    let buffer = [];

    const flushBuffer = () => {
      if (buffer.length > 0) {
        const content = buffer.join('<br>').trim();
        if (content) result.push(`<p>${content}</p>`);
        buffer = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushBuffer();
      } else if (blockTags.test(trimmed)) {
        flushBuffer();
        result.push(trimmed);
      } else {
        buffer.push(trimmed);
      }
    }
    flushBuffer();

    return result.join('\n');
  }
};

// Export for module or global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownRenderer;
}
