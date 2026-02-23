(function () {
  "use strict";

  // ---- Word Quest (Wordle-style) using external Wordle-API backend ----
  // API docs: https://github.com/petergeorgas/Wordle-API
  // Endpoint: POST https://wordle-api.vercel.app/api/wordle
  // Body: { "guess": "words" }
  // Correct: { guess, was_correct: true }
  // Incorrect: { guess, was_correct: false, character_info: [{ char, scoring: { in_word, correct_idx }}, ...] }

  var WORDLE_API_URL = "https://wordle-api.vercel.app/api/wordle";
  var ROWS = 6;
  var COLS = 5;

  var wordQuest = {
    currentRow: 0,
    currentCol: 0,
    done: false,
    locked: false,
    keyState: {} // letter -> "correct" | "present" | "absent"
  };

  function buildBoard() {
    var board = document.getElementById("word-quest-board");
    if (!board) return;
    board.innerHTML = "";
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement("div");
        cell.className = "word-cell";
        cell.setAttribute("data-row", r);
        cell.setAttribute("data-col", c);
        cell.setAttribute("aria-label", "Row " + (r + 1) + " letter " + (c + 1));
        board.appendChild(cell);
      }
    }
  }

  function buildKeyboard() {
    var row1 = "qwertyuiop", row2 = "asdfghjkl", row3 = "zxcvbnm";
    var container = document.getElementById("word-quest-keyboard");
    if (!container) return;
    container.innerHTML = "";
    [row1, row2, row3].forEach(function (row) {
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex; gap:0.35rem; justify-content:center; width:100%; margin-bottom:0.35rem;";
      for (var i = 0; i < row.length; i++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key-btn";
        btn.textContent = row[i];
        btn.setAttribute("data-key", row[i]);
        wrap.appendChild(btn);
      }
      container.appendChild(wrap);
    });
    var back = document.createElement("button");
    back.type = "button";
    back.className = "game-btn";
    back.textContent = "⌫ Back";
    back.style.marginTop = "0.5rem";
    back.id = "word-quest-back";
    container.appendChild(back);
  }

  function getCell(r, c) {
    var board = document.getElementById("word-quest-board");
    if (!board) return null;
    return board.querySelector("[data-row=\"" + r + "\"][data-col=\"" + c + "\"]");
  }

  function setMessage(text, className) {
    var el = document.getElementById("word-quest-message");
    if (el) {
      el.textContent = text;
      el.className = "game-message " + (className || "info");
    }
  }

  function updateKeyStatesFromState() {
    var keyState = wordQuest.keyState || {};
    document.querySelectorAll("#word-quest-keyboard .key-btn[data-key]").forEach(function (btn) {
      var k = btn.getAttribute("data-key");
      btn.className = "key-btn " + (keyState[k] || "");
    });
  }

  function applyWordleApiResult(word, data) {
    // Color cells based on API response
    var info = data.character_info || [];
    for (var c = 0; c < COLS; c++) {
      var cell = getCell(wordQuest.currentRow, c);
      if (!cell) continue;
      var ch = word[c];
      cell.classList.add("filled");
      var scoring = info[c] && info[c].scoring ? info[c].scoring : null;
      var state;
      if (data.was_correct || (scoring && scoring.in_word && scoring.correct_idx)) {
        cell.classList.add("correct");
        state = "correct";
      } else if (scoring && scoring.in_word) {
        cell.classList.add("present");
        state = "present";
      } else {
        cell.classList.add("absent");
        state = "absent";
      }
      var existing = wordQuest.keyState[ch];
      if (state === "correct" || (state === "present" && existing !== "correct") || (!existing && state === "absent")) {
        wordQuest.keyState[ch] = state;
      }
    }
    updateKeyStatesFromState();
  }

  function commitRow() {
    if (wordQuest.done || wordQuest.locked) return;
    var word = "";
    for (var c = 0; c < COLS; c++) {
      var cell = getCell(wordQuest.currentRow, c);
      if (cell) word += (cell.textContent || "").toLowerCase();
    }
    if (word.length !== COLS) {
      setMessage("Finish the word (5 letters)");
      return;
    }
    if (!/^[a-z]{5}$/.test(word)) {
      setMessage("Use only letters A–Z");
      return;
    }
    wordQuest.locked = true;
    setMessage("Checking with Wordle API…", "info");

    fetch(WORDLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: word })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        applyWordleApiResult(word, data);
        if (data.was_correct) {
          wordQuest.done = true;
          setMessage("You got it! 🚀", "win");
        } else {
          wordQuest.currentRow++;
          wordQuest.currentCol = 0;
          if (wordQuest.currentRow >= ROWS) {
            wordQuest.done = true;
            setMessage("Out of guesses! Check back tomorrow.", "lose");
          } else {
            setMessage("");
          }
        }
      })
      .catch(function () {
        setMessage("Error contacting Wordle API. Try again.", "lose");
      })
      .finally(function () {
        wordQuest.locked = false;
      });
  }

  function initWordQuest() {
    wordQuest.currentRow = 0;
    wordQuest.currentCol = 0;
    wordQuest.done = false;
    wordQuest.locked = false;
    wordQuest.keyState = {};
    buildBoard();
    buildKeyboard();
    setMessage("Guess the 5-letter word");
    document.querySelectorAll("#word-quest-keyboard .key-btn[data-key]").forEach(function (btn) {
      btn.className = "key-btn";
    });
    var backBtn = document.getElementById("word-quest-back");
    if (backBtn) backBtn.onclick = function () { typeLetter("Backspace"); };
    document.getElementById("word-quest-keyboard").addEventListener("click", function (e) {
      var key = e.target.getAttribute("data-key");
      if (key) typeLetter(key);
    });
    document.getElementById("word-quest-new").onclick = initWordQuest;
    document.addEventListener("keydown", wordQuestKeydown);
  }

  function typeLetter(key) {
    if (wordQuest.done) return;
    if (key === "Backspace") {
      if (wordQuest.currentCol > 0) {
        wordQuest.currentCol--;
        var cell = getCell(wordQuest.currentRow, wordQuest.currentCol);
        if (cell) { cell.textContent = ""; cell.classList.remove("filled"); }
      }
      return;
    }
    if (key === "Enter") {
      commitRow();
      return;
    }
    if (key.length === 1 && key >= "a" && key <= "z" && wordQuest.currentCol < COLS) {
      var cell = getCell(wordQuest.currentRow, wordQuest.currentCol);
      if (cell) {
        cell.textContent = key.toUpperCase();
        cell.classList.add("filled");
        wordQuest.currentCol++;
      }
    }
  }

  function wordQuestKeydown(e) {
    if (!document.getElementById("word-quest-board") || !document.getElementById("word-quest-board").offsetParent) return;
    if (e.key === "Backspace" || e.key === "Enter" || (e.key.length === 1 && e.key >= "a" && e.key <= "z")) {
      e.preventDefault();
      typeLetter(e.key === "Backspace" ? "Backspace" : e.key === "Enter" ? "Enter" : e.key.toLowerCase());
    }
  }

  // ---- Sentiment Check ----
  // 30 more complex sentences (5–6+ words) to reflect real-world NLP tasks
  var SENTIMENT_PHRASES = [
    { text: "The latest model deployment exceeded every performance benchmark.", sentiment: "positive" },
    { text: "Despite several attempts, the training pipeline keeps failing silently.", sentiment: "negative" },
    { text: "The client requested another meeting to clarify the roadmap.", sentiment: "neutral" },
    { text: "Our A/B test showed significantly higher engagement this quarter.", sentiment: "positive" },
    { text: "The latency spike during peak traffic completely broke the dashboard.", sentiment: "negative" },
    { text: "Documentation updates are scheduled for next week's sprint planning.", sentiment: "neutral" },
    { text: "Team feedback on the new AI features has been overwhelmingly enthusiastic.", sentiment: "positive" },
    { text: "Users repeatedly reported crashes after the latest mobile release.", sentiment: "negative" },
    { text: "The experiment produced stable results across all evaluated datasets.", sentiment: "neutral" },
    { text: "Our collaboration with the research group unlocked several new opportunities.", sentiment: "positive" },
    { text: "Critical security vulnerabilities were discovered in the legacy authentication flow.", sentiment: "negative" },
    { text: "The committee postponed the decision until further legal review is complete.", sentiment: "neutral" },
    { text: "Customer satisfaction scores climbed steadily after the redesign launched.", sentiment: "positive" },
    { text: "Multiple stakeholders expressed serious doubts about the current strategy.", sentiment: "negative" },
    { text: "Usage metrics remained relatively flat throughout the entire campaign.", sentiment: "neutral" },
    { text: "The new recommendation engine significantly improved click-through rates.", sentiment: "positive" },
    { text: "Several key integrations failed during the live product demonstration.", sentiment: "negative" },
    { text: "The compliance team is still reviewing the updated data retention policy.", sentiment: "neutral" },
    { text: "Early adopters praised the intuitive interface and responsive design.", sentiment: "positive" },
    { text: "Production incidents increased noticeably after the last infrastructure change.", sentiment: "negative" },
    { text: "Engineering leadership requested a detailed report summarizing our findings.", sentiment: "neutral" },
    { text: "Beta users shared inspiring stories about how the tool improved their workflow.", sentiment: "positive" },
    { text: "Key partners threatened to withdraw support if deadlines slip again.", sentiment: "negative" },
    { text: "The data migration completed on schedule without any reported issues.", sentiment: "neutral" },
    { text: "Investors responded positively to the vision for AI-driven products.", sentiment: "positive" },
    { text: "Customers expressed frustration about recurring billing and login errors.", sentiment: "negative" },
    { text: "Internal surveys indicated mixed feelings about the proposed reorganization.", sentiment: "neutral" },
    { text: "The research paper received strong reviews from the conference committee.", sentiment: "positive" },
    { text: "Several test environments became unusable due to configuration drift overnight.", sentiment: "negative" },
    { text: "Regulators requested additional information before approving the deployment plan.", sentiment: "neutral" }
  ];

  var sentimentState = {
    order: [],
    index: 0,
    score: 0,
    total: 0
  };

  function shuffleSentimentOrder() {
    var indices = SENTIMENT_PHRASES.map(function (_, i) { return i; });
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = indices[i];
      indices[i] = indices[j];
      indices[j] = t;
    }
    sentimentState.order = indices; // full shuffled list; total controls how many per round
  }

  function showSentimentPhrase() {
    var phraseEl = document.getElementById("sentiment-phrase");
    var feedbackEl = document.getElementById("sentiment-feedback");
    var scoreEl = document.getElementById("sentiment-score");
    var restartBtn = document.getElementById("sentiment-restart");
    if (sentimentState.index >= sentimentState.total) {
      phraseEl.textContent = "";
      feedbackEl.textContent = "Done! You scored " + sentimentState.score + " / " + sentimentState.total + ".";
      feedbackEl.className = "game-message " + (sentimentState.score === sentimentState.total ? "win" : "info");
      scoreEl.textContent = "";
      document.getElementById("sentiment-choices").style.display = "none";
      if (restartBtn) restartBtn.style.display = "block";
      return;
    }
    var idx = sentimentState.order[sentimentState.index];
    var item = SENTIMENT_PHRASES[idx];
    phraseEl.textContent = "\"" + item.text + "\"";
    feedbackEl.textContent = "";
    feedbackEl.className = "game-message";
    scoreEl.textContent = "Score: " + sentimentState.score + " / " + sentimentState.total;
    document.getElementById("sentiment-choices").style.display = "flex";
    document.querySelectorAll(".sentiment-btn").forEach(function (b) {
      b.className = "sentiment-btn";
      b.disabled = false;
    });
    if (restartBtn) restartBtn.style.display = "none";
  }

  function initSentiment() {
    shuffleSentimentOrder();
    sentimentState.index = 0;
    sentimentState.score = 0;
    sentimentState.total = Math.min(10, sentimentState.order.length); // 10 random phrases per round
    showSentimentPhrase();
    document.getElementById("sentiment-restart").onclick = function () {
      initSentiment();
    };
    document.querySelectorAll(".sentiment-btn").forEach(function (btn) {
      btn.onclick = function () {
        if (sentimentState.index >= sentimentState.order.length) return;
        var idx = sentimentState.order[sentimentState.index];
        var item = SENTIMENT_PHRASES[idx];
        var choice = btn.getAttribute("data-sentiment");
        var correct = choice === item.sentiment;
        if (correct) sentimentState.score++;
        var feedbackEl = document.getElementById("sentiment-feedback");
        feedbackEl.textContent = correct ? "Correct! AI agrees: " + item.sentiment + "." : "AI says: " + item.sentiment + ".";
        feedbackEl.className = "game-message " + (correct ? "win" : "lose");
        btn.classList.add(correct ? "correct" : "wrong");
        document.querySelectorAll(".sentiment-btn").forEach(function (b) { b.disabled = true; });
        sentimentState.index++;
        setTimeout(showSentimentPhrase, 1200);
      };
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("word-quest-board")) initWordQuest();
      if (document.getElementById("sentiment-phrase")) initSentiment();
    });
  } else {
    if (document.getElementById("word-quest-board")) initWordQuest();
    if (document.getElementById("sentiment-phrase")) initSentiment();
  }
})();
