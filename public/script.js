document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');

  // Make the chat box accessible by having screen readers announce new messages.
  chatBox.setAttribute('aria-live', 'polite');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const userMessage = input.value.trim();
    if (!userMessage) {
      return; // Don't send empty messages
    }

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
    const sanitizedText = escapeHTML(text);
    const cleanedText = sanitizedText.trim().replace(/\n{3,}/g, '\n\n');
    if (cleanedText === '') return '';

    return cleanedText.split('\n\n')
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
});
