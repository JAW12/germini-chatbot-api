document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');
  const sendButton = form.querySelector('button');

  // Make the chat box accessible by having screen readers announce new messages.
  chatBox.setAttribute('aria-live', 'polite');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const userMessage = input.value.trim(); // Trim the message
    if (!userMessage || sendButton.disabled) {
      return; // Don't send empty messages or while a request is in progress
    }

    // Disable form controls to prevent multiple submissions
    input.disabled = true;
    sendButton.disabled = true;
    // Optional: change button text to show it's working
    sendButton.textContent = '...';

    appendMessage('User', userMessage);
    input.value = ''; // Clear the input field

    try {
      // Show a "Bot is thinking..." message
      appendMessage('Bot', 'Thinking...', 'thinking');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }), // Send message in the expected format
      });

      // Remove the "Thinking..." message
      removeThinkingMessage();

      if (!response.ok) {
        // Try to get error message from backend, otherwise use default
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          // If parsing error JSON fails, stick with the status text
          console.warn('Could not parse error JSON from server.', jsonError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Adjust 'data.reply' based on your backend's actual response structure
      const botMessage = data.reply || "Sorry, I couldn't get a response.";
      appendMessage('Bot', botMessage);

    } catch (error) {
      console.error('Error sending message to chatbot:', error);
      removeThinkingMessage(); // Ensure thinking message is removed on error
      appendMessage('Bot', error.message || 'An unexpected error occurred.', 'error');
    } finally {
      // Re-enable form controls regardless of success or failure
      input.disabled = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      input.focus(); // Set focus back to the input field for the next message
    }
  });

  /**
   * Appends a message to the chat box.
   * @param {string} sender - The sender of the message (e.g., 'User', 'Bot').
   * @param {string} text - The message text.
   * @param {string} [type=''] - An optional type for special styling (e.g., 'thinking', 'error').
   */
  function appendMessage(sender, text, type = '') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender.toLowerCase());

    if (type) {
      messageElement.classList.add(type);
    }

    const senderNameElement = document.createElement('strong');
    senderNameElement.textContent = `${sender}: `;

    const messageTextElement = document.createElement('span');
    if (sender === 'Bot') {
      // For bot messages, sanitize and then format for newlines.
      messageTextElement.innerHTML = processBotResponseText(text);
    } else {
      // For user messages, just set the text content. It's safer and simpler.
      messageTextElement.textContent = text;
    }

    messageElement.appendChild(senderNameElement);
    messageElement.appendChild(messageTextElement);
    
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
  }

  /**
   * Removes any message with the 'thinking' class from the chat box.
   */
  function removeThinkingMessage() {
    const thinkingElement = chatBox.querySelector('.message.thinking');
    if (thinkingElement) {
      thinkingElement.remove();
    }
  }

  /**
   * A simple and effective way to escape HTML characters to prevent XSS attacks.
   * It leverages the browser's own parser to safely handle text.
   * @param {string} str The potentially unsafe string.
   * @returns {string} The sanitized string.
   */
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  /**
   * Applies inline markdown formatting (bold, italic, code) to a string.
   * This should be applied after the string has been HTML-escaped.
   * @param {string} text The sanitized text to format.
   * @returns {string} Text with inline markdown converted to HTML tags.
   */
  function applyInlineMarkdown(text) {
    return text
      // Bold (e.g., **text** or __text__)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic (e.g., *text* or _text_)
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Inline code (e.g., `code`)
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  /**
   * Processes the bot's response text to be safely displayed as HTML.
   * It sanitizes the text, then converts basic markdown (code blocks, lists, bold, italic) to HTML.
   * @param {string} text - The raw text from the bot.
   * @returns {string} - The HTML formatted and sanitized text.
   */
  function processBotResponseText(text) {
    // 1. Sanitize the entire input to prevent XSS. This is the most critical step.
    const sanitizedText = escapeHTML(text);

    // 2. Extract code blocks to prevent markdown parsing inside them.
    const codeBlocks = [];
    let processedText = sanitizedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      // Note: The code is already sanitized from step 1.
      const languageClass = lang ? ` class="language-${lang}"` : '';
      const block = `<pre><code${languageClass}>${code.trim()}</code></pre>`;
      codeBlocks.push(block);
      // Use a placeholder with newlines to ensure it's treated as a distinct block.
      return `\n\n__CODE_BLOCK_${codeBlocks.length - 1}__\n\n`;
    });

    // 3. Normalize multiple newlines and split into blocks.
    const blocks = processedText.trim().split(/\n\n+/);

    // 4. Process each block into an HTML element.
    const htmlBlocks = blocks.map(block => {
      if (block.startsWith('__CODE_BLOCK_')) {
        return block; // Keep placeholder as is for now.
      }

      const trimmedBlock = block.trim();
      if (!trimmedBlock) return '';

      // Check for Unordered List (lines starting with * or -)
      if (/^([\*\-]\s)/m.test(trimmedBlock)) {
        const items = trimmedBlock.split('\n').map(line => {
          const itemContent = line.replace(/^[\*\-]\s/, '');
          return `<li>${applyInlineMarkdown(itemContent)}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
      }

      // Check for Ordered List (lines starting with 1., 2., etc.)
      if (/^(\d+\.\s)/m.test(trimmedBlock)) {
        const items = trimmedBlock.split('\n').map(line => {
          const itemContent = line.replace(/^\d+\.\s/, '');
          return `<li>${applyInlineMarkdown(itemContent)}</li>`;
        }).join('');
        return `<ol>${items}</ol>`;
      }
      
      // Otherwise, treat as a paragraph.
      // Apply inline markdown and convert single newlines within the paragraph to <br>.
      const paraWithInline = applyInlineMarkdown(trimmedBlock);
      const paraWithBreaks = paraWithInline.replace(/\n/g, '<br>');
      return `<p>${paraWithBreaks}</p>`;
    });

    // 5. Join the processed blocks and restore the real code blocks from placeholders.
    let finalHtml = htmlBlocks.join('');
    // This regex handles placeholders that might have been wrapped in <p> tags or stand alone.
    finalHtml = finalHtml.replace(/<p>__CODE_BLOCK_(\d+)__<\/p>|__CODE_BLOCK_(\d+)__/g, (match, index1, index2) => {
      const index = index1 || index2;
      return codeBlocks[parseInt(index, 10)];
    });

    return finalHtml;
  }
});
