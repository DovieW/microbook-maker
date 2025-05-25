const { EPub } = require('epub2');
const { JSDOM } = require('jsdom');

class EpubParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.epub = null;
    this.content = [];
  }

  async parse() {
    return new Promise((resolve, reject) => {
      this.epub = new EPub(this.filePath);
      
      this.epub.on('end', async () => {
        try {
          const structuredContent = await this.extractStructuredContent();
          resolve(structuredContent);
        } catch (error) {
          reject(error);
        }
      });

      this.epub.on('error', (error) => {
        reject(error);
      });

      this.epub.parse();
    });
  }

  async extractStructuredContent() {
    const content = [];
    let totalWordCount = 0;

    // Get the spine (reading order) of the EPUB
    const spine = this.epub.flow;
    
    for (let i = 0; i < spine.length; i++) {
      const chapter = spine[i];
      const chapterContent = await this.getChapterContent(chapter.id);
      
      if (chapterContent && chapterContent.elements.length > 0) {
        content.push(chapterContent);
        totalWordCount += chapterContent.wordCount;
      }
    }

    return {
      content,
      totalWordCount,
      metadata: this.epub.metadata
    };
  }

  async getChapterContent(chapterId) {
    return new Promise((resolve, reject) => {
      this.epub.getChapter(chapterId, (error, text) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const parsedContent = this.parseHtmlContent(text);
          resolve(parsedContent);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  parseHtmlContent(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    const elements = [];
    let wordCount = 0;
    let chapterTitle = '';

    // Try to find chapter title from various heading tags
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .chapter-title, .title');
    if (headings.length > 0) {
      chapterTitle = headings[0].textContent.trim();
    }

    // Process all text-containing elements
    const walker = document.createTreeWalker(
      document.body || document,
      dom.window.NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Skip script, style, and other non-content elements
          if (['SCRIPT', 'STYLE', 'META', 'LINK'].includes(node.tagName)) {
            return dom.window.NodeFilter.FILTER_REJECT;
          }
          return dom.window.NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      const element = this.processElement(currentNode);
      if (element) {
        elements.push(element);
        wordCount += element.wordCount;
      }
    }

    return {
      chapterTitle,
      elements: this.mergeConsecutiveText(elements),
      wordCount
    };
  }

  processElement(node) {
    const tagName = node.tagName.toLowerCase();
    const textContent = this.getDirectTextContent(node);
    
    if (!textContent.trim()) {
      return null;
    }

    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    if (wordCount === 0) {
      return null;
    }

    let elementType = 'text';
    let formatting = {};

    // Determine element type and formatting
    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        elementType = 'heading';
        formatting.level = parseInt(tagName.charAt(1));
        break;
      case 'p':
        elementType = 'paragraph';
        break;
      case 'blockquote':
        elementType = 'blockquote';
        break;
      case 'em':
      case 'i':
        formatting.italic = true;
        break;
      case 'strong':
      case 'b':
        formatting.bold = true;
        break;
      case 'u':
        formatting.underline = true;
        break;
      case 'center':
        formatting.align = 'center';
        break;
    }

    // Check for inline formatting within the element
    this.detectInlineFormatting(node, formatting);

    return {
      type: elementType,
      text: textContent.trim(),
      wordCount,
      formatting
    };
  }

  getDirectTextContent(node) {
    let text = '';
    for (let child of node.childNodes) {
      if (child.nodeType === 3) { // Text node
        text += child.textContent;
      } else if (child.nodeType === 1) { // Element node
        // For inline elements, include their text
        const tagName = child.tagName.toLowerCase();
        if (['em', 'i', 'strong', 'b', 'u', 'span', 'a'].includes(tagName)) {
          text += child.textContent;
        }
      }
    }
    return text;
  }

  detectInlineFormatting(node, formatting) {
    // Check for nested formatting elements
    const strongElements = node.querySelectorAll('strong, b');
    const emElements = node.querySelectorAll('em, i');
    const underlineElements = node.querySelectorAll('u');

    if (strongElements.length > 0) {
      formatting.bold = true;
    }
    if (emElements.length > 0) {
      formatting.italic = true;
    }
    if (underlineElements.length > 0) {
      formatting.underline = true;
    }

    // Check for style attributes
    const style = node.getAttribute('style');
    if (style) {
      if (style.includes('font-weight: bold') || style.includes('font-weight:bold')) {
        formatting.bold = true;
      }
      if (style.includes('font-style: italic') || style.includes('font-style:italic')) {
        formatting.italic = true;
      }
      if (style.includes('text-decoration: underline') || style.includes('text-decoration:underline')) {
        formatting.underline = true;
      }
      if (style.includes('text-align: center') || style.includes('text-align:center')) {
        formatting.align = 'center';
      }
    }
  }

  mergeConsecutiveText(elements) {
    const merged = [];
    let currentParagraph = null;

    for (const element of elements) {
      if (element.type === 'paragraph' || (element.type === 'text' && !element.formatting.level)) {
        if (currentParagraph) {
          // Merge with previous paragraph
          currentParagraph.text += ' ' + element.text;
          currentParagraph.wordCount += element.wordCount;
        } else {
          currentParagraph = {
            type: 'paragraph',
            text: element.text,
            wordCount: element.wordCount,
            formatting: element.formatting
          };
        }
      } else {
        // Push any accumulated paragraph
        if (currentParagraph) {
          merged.push(currentParagraph);
          currentParagraph = null;
        }
        // Push the current element (heading, blockquote, etc.)
        merged.push(element);
      }
    }

    // Don't forget the last paragraph
    if (currentParagraph) {
      merged.push(currentParagraph);
    }

    return merged;
  }
}

module.exports = EpubParser;