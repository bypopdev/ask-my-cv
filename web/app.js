"use strict";

const API_URL = window.ASK_MY_CV_API;
const MAX_HISTORY = 6;

const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("question");
const send = document.getElementById("send");
const suggestions = document.getElementById("suggestions");

/** Last question/answer pairs, sent back so follow-up questions have context. */
let history = [];

function addMessage(text, kind) {
  const div = document.createElement("div");
  div.className = `msg ${kind}`;
  div.textContent = text;
  log.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
  return div;
}

async function ask(question) {
  addMessage(question, "user");
  const pending = addMessage("Thinking…", "bot pending");
  send.disabled = true;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, history }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    pending.textContent = data.answer;
    pending.classList.remove("pending");
    history = [...history, { role: "user", content: question }, { role: "assistant", content: data.answer.slice(0, 1000) }].slice(-MAX_HISTORY);
  } catch (err) {
    pending.textContent = err.message;
    pending.className = "msg bot error";
  } finally {
    send.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  suggestions.hidden = true;
  ask(question);
});

suggestions.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) {
    suggestions.hidden = true;
    ask(event.target.textContent);
  }
});

if (!API_URL) addMessage("The assistant is not configured yet (missing API URL).", "bot error");
