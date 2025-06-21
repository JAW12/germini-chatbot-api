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
    // IMPORTANT: Use innerHTML only after sanitizing and formatting the text.
    messageTextElement.innerHTML = processBotResponseText(text);

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
   * @param {string} str The potentially unsafe string.
   * @returns {string} The sanitized string.
   */
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  /**
   * Processes the bot's response text to be safely displayed as HTML.
   * @param {string} text - The raw text from the bot.
   * @returns {string} - The HTML formatted and sanitized text.
   */
  function processBotResponseText(text) {
    // 1. Sanitize the entire input to prevent XSS. This converts characters like `<` and `>`
    // into their HTML entities (e.g., `&lt;` and `&gt;`), disabling any raw HTML from the AI.
    // This is a critical security step.
    const sanitizedText = escapeHTML(text);

    // 2. Normalize multiple newlines for consistent paragraph spacing and trim whitespace.
    const cleanedText = sanitizedText.trim().replace(/\n{3,}/g, '\n\n');

    if (cleanedText === '') {
      return ''; // Handle cases where input is only whitespace.
    }

    // 3. Split by double newlines to create paragraphs.
    const paragraphs = cleanedText.split('\n\n');

    // 4. Map each paragraph to a <p> tag, converting single newlines inside to <br>,
    //    and filter out any empty paragraphs that might result from extra newlines.
    return paragraphs
      .map(para => {
        if (para.trim()) {
          const paraWithBreaks = para.replace(/\n/g, '<br>');
          return `<p>${paraWithBreaks}</p>`;
        }
        return '';
      })
      .join('');
  }
});
