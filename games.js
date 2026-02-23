(function () {
  "use strict";

  // ---- Word Quest (Wordle-style) ----
  var WORD_LIST = [
    "array", "query", "stack", "graph", "cloud", "model", "token", "neural",
    "cache", "debug", "float", "index", "merge", "patch", "scope", "shell",
    "tuple", "value", "while", "logic", "bytes", "input", "layer", "batch"
  ];
  var ROWS = 6;
  var COLS = 5;

  var wordQuest = {
    target: "",
    guesses: [],
    currentRow: 0,
    currentCol: 0,
    done: false
  };

  function pickWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  }

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

  function updateKeyStates() {
    var keyState = {};
    wordQuest.guesses.forEach(function (guess) {
      var target = wordQuest.target;
      for (var i = 0; i < 5; i++) {
        var ch = guess[i];
        if (!ch) return;
        var cell = getCell(wordQuest.guesses.indexOf(guess), i);
        if (cell) {
          if (target[i] === ch) keyState[ch] = "correct";
          else if (target.indexOf(ch) !== -1 && keyState[ch] !== "correct") keyState[ch] = "present";
          else if (!keyState[ch]) keyState[ch] = "absent";
        }
      }
    });
    document.querySelectorAll("#word-quest-keyboard .key-btn[data-key]").forEach(function (btn) {
      var k = btn.getAttribute("data-key");
      btn.className = "key-btn " + (keyState[k] || "");
    });
  }

  function commitRow() {
    var word = "";
    for (var c = 0; c < COLS; c++) {
      var cell = getCell(wordQuest.currentRow, c);
      if (cell) word += (cell.textContent || "").toLowerCase();
    }
    if (word.length !== COLS) {
      setMessage("Finish the word (5 letters)");
      return;
    }
    if (WORD_LIST.indexOf(word) === -1) {
      setMessage("Not in word list");
      return;
    }
    wordQuest.guesses.push(word);
    var target = wordQuest.target;
    for (var c = 0; c < COLS; c++) {
      var cell = getCell(wordQuest.currentRow, c);
      if (!cell) continue;
      cell.classList.add("filled");
      var ch = word[c];
      if (target[c] === ch) cell.classList.add("correct");
      else if (target.indexOf(ch) !== -1) cell.classList.add("present");
      else cell.classList.add("absent");
    }
    updateKeyStates();
    if (word === target) {
      wordQuest.done = true;
      setMessage("You got it! 🚀", "win");
      return;
    }
    wordQuest.currentRow++;
    wordQuest.currentCol = 0;
    if (wordQuest.currentRow >= ROWS) {
      wordQuest.done = true;
      setMessage("The word was: " + target.toUpperCase(), "lose");
      return;
    }
    setMessage("");
  }

  function initWordQuest() {
    wordQuest.target = pickWord();
    wordQuest.guesses = [];
    wordQuest.currentRow = 0;
    wordQuest.currentCol = 0;
    wordQuest.done = false;
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
  var SENTIMENT_PHRASES = [
    { text: "This product is amazing!", sentiment: "positive" },
    { text: "The meeting was cancelled.", sentiment: "negative" },
    { text: "The weather is okay today.", sentiment: "neutral" },
    { text: "I love working on ML projects!", sentiment: "positive" },
    { text: "The server is down again.", sentiment: "negative" },
    { text: "No changes in this release.", sentiment: "neutral" },
    { text: "Incredible results from the model.", sentiment: "positive" },
    { text: "We need to fix this bug ASAP.", sentiment: "negative" },
    { text: "The report is ready for review.", sentiment: "neutral" },
    { text: "Best conference I've ever attended!", sentiment: "positive" }
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
    sentimentState.order = indices.slice(0, 5);
  }

  function showSentimentPhrase() {
    var phraseEl = document.getElementById("sentiment-phrase");
    var feedbackEl = document.getElementById("sentiment-feedback");
    var scoreEl = document.getElementById("sentiment-score");
    var restartBtn = document.getElementById("sentiment-restart");
    if (sentimentState.index >= sentimentState.order.length) {
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
    sentimentState.total = Math.min(5, sentimentState.order.length);
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
