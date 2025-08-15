/**
 * Sends chat messages to the EchoSoul AI server (no memory dependency).
 * @param {Array} messages - Chat messages (roles: 'user' or 'assistant').
 * @returns {Promise<string>} - The AI-generated reply.
 */
export const chatWithGPT = async (messages) => {
  const systemPrompt = `
You are EchoSoul, a personal AI companion that helps users reflect on their thoughts and emotions.

You don't have access to user memories — rely only on the current conversation to guide your responses.

Be empathetic, brief, and insightful.

If you don’t have enough context to answer, say:
"I’m still learning about you. Could you tell me more?"
  `.trim();

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const makeRequest = async () => {
    const response = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: fullMessages }),
    });
    return await response.json();
  };

  try {
    let data = await makeRequest();

    // Retry once if timeout or server error
    if (data.error || !data.reply) {
      console.warn("⚠️ First request failed, retrying...");
      await new Promise((res) => setTimeout(res, 1500)); // small wait
      data = await makeRequest();
    }

    if (data.reply) {
      return data.reply;
    } else {
      console.error("⚠️ Unexpected GPT response:", data);
      return "🤖 EchoSoul couldn't generate a response.";
    }
  } catch (error) {
    console.error("🔥 GPT API Error (frontend):", error);
    return "⚠️ EchoSoul is offline or unreachable.";
  }
};