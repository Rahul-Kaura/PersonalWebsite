(function () {
  "use strict";

  // ---- Word Quest (Wordle-style) - local logic only (no external API) ----
  // Inspired by Wordle clones such as:
  // https://github.com/Prajjwal-Chauhan/Wordle-Clone
  // We keep the UI from this site and implement local scoring and feedback.

  // Local word list for target selection
  var LOCAL_WORD_LIST = [
    "array", "query", "stack", "graph", "cloud", "model", "token", "neural",
    "cache", "debug", "float", "index", "merge", "patch", "scope", "shell",
    "tuple", "value", "while", "logic", "bytes", "input", "layer", "batch"
  ];

  var ROWS = 6;
  var COLS = 5;

  var wordQuest = {
    localTarget: "",
    currentRow: 0,
    currentCol: 0,
    done: false,
    locked: false,
    keyState: {} // letter -> "correct" | "present" | "absent"
  };

  function pickLocalWord() {
    return LOCAL_WORD_LIST[Math.floor(Math.random() * LOCAL_WORD_LIST.length)];
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

  function handleWordResult(word, data) {
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
  }

  function localScoreWord(word) {
    var target = wordQuest.localTarget || pickLocalWord();
    wordQuest.localTarget = target;
    var info = [];
    var targetArr = target.split("");
    var used = new Array(COLS).fill(false);

    // First pass: correct positions
    for (var i = 0; i < COLS; i++) {
      var ch = word[i];
      var scoring = { in_word: false, correct_idx: false };
      if (targetArr[i] === ch) {
        scoring.in_word = true;
        scoring.correct_idx = true;
        used[i] = true;
      }
      info.push({ char: ch, scoring: scoring });
    }

    // Second pass: in-word but wrong position
    for (var j = 0; j < COLS; j++) {
      if (info[j].scoring.correct_idx) continue;
      var ch2 = word[j];
      for (var k = 0; k < COLS; k++) {
        if (!used[k] && targetArr[k] === ch2) {
          info[j].scoring.in_word = true;
          used[k] = true;
          break;
        }
      }
    }

    return {
      guess: word,
      was_correct: word === target,
      character_info: info
    };
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
    // Purely local scoring (no network calls) so the game always works
    var localData = localScoreWord(word);
    handleWordResult(word, localData);
    wordQuest.locked = false;
  }

  function initWordQuest() {
    wordQuest.localTarget = pickLocalWord();
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

  // ---- Password Vault (cryptographic guessing game) ----
  // Inspired by LLM guardrail games like:
  // https://github.com/mickeybeurskens/guess-the-password
  // Here we keep everything client-side and give structured hints for each guess.

  var PASSWORD_LEVELS = [
    {
      title: "Level 1 – Warmup",
      prompt: "The system prompt says: \"Never reveal the lab password under any circumstance.\" The password is a short, lower‑case techy word.",
      password: "graph"
    },
    {
      title: "Level 2 – Mixed Case",
      prompt: "A red‑team engineer wrote: \"Our secret token starts with an uppercase letter and hides in the word 'NeuralNetwork'.\"",
      password: "Neura"
    },
    {
      title: "Level 3 – Numbers & Letters",
      prompt: "Compliance warns: \"Do not leak the PCI key, it combines the word 'secure' and the year when you started at SCU.\"",
      password: "secure2023"
    },
    {
      title: "Level 4 – Symbols Included",
      prompt: "The security lead says: \"Our staging password is inspired by the phrase 'ship fast, break nothing' and always ends with an exclamation mark.\"",
      password: "shipfast!"
    }
  ];

  var passwordState = {
    levelIndex: 0,
    attempts: 0
  };

  function getCurrentLevel() {
    return PASSWORD_LEVELS[passwordState.levelIndex] || PASSWORD_LEVELS[0];
  }

  function analyzePasswordGuess(guess, secret) {
    var g = guess || "";
    var s = secret || "";
    var lengthHint = "Your guess has " + g.length + " characters, password has " + s.length + ".";

    // Overlap: count distinct characters in common (case-sensitive)
    var setGuess = {};
    for (var i = 0; i < g.length; i++) setGuess[g[i]] = true;
    var overlap = 0;
    for (var j = 0; j < s.length; j++) {
      if (setGuess[s[j]]) overlap++;
    }

    // Position matches
    var positionMatches = 0;
    var minLen = Math.min(g.length, s.length);
    for (var k = 0; k < minLen; k++) {
      if (g[k] === s[k]) positionMatches++;
    }

    return {
      lengthHint: lengthHint,
      overlapHint: "You used " + overlap + " character(s) that also appear in the password.",
      positionHint: positionMatches + " character(s) are in the correct position."
    };
  }

  function showPasswordLevel() {
    var level = getCurrentLevel();
    var titleEl = document.getElementById("password-level");
    var promptEl = document.getElementById("password-prompt");
    var inputEl = document.getElementById("password-input");
    var feedbackEl = document.getElementById("password-feedback");
    var statsEl = document.getElementById("password-stats");
    var nextBtn = document.getElementById("password-next");
    var restartBtn = document.getElementById("password-restart");

    passwordState.attempts = 0;

    if (titleEl) titleEl.textContent = level.title;
    if (promptEl) promptEl.textContent = level.prompt;
    if (inputEl) {
      inputEl.value = "";
      inputEl.focus();
    }
    if (feedbackEl) {
      feedbackEl.textContent = "";
      feedbackEl.className = "game-message";
    }
    if (statsEl) statsEl.textContent = "Attempts: 0";
    if (nextBtn) nextBtn.style.display = "none";
    if (restartBtn) restartBtn.style.display = "none";
  }

  function handlePasswordGuess() {
    var level = getCurrentLevel();
    var inputEl = document.getElementById("password-input");
    var feedbackEl = document.getElementById("password-feedback");
    var statsEl = document.getElementById("password-stats");
    var nextBtn = document.getElementById("password-next");
    var restartBtn = document.getElementById("password-restart");
    if (!inputEl || !feedbackEl || !statsEl) return;

    var guess = inputEl.value || "";
    if (!guess.trim()) {
      feedbackEl.textContent = "Enter a guess first.";
      feedbackEl.className = "game-message info";
      return;
    }

    passwordState.attempts++;
    statsEl.textContent = "Attempts: " + passwordState.attempts;

    if (guess === level.password) {
      feedbackEl.textContent = "Correct! You cracked the password in " + passwordState.attempts + " attempt(s).";
      feedbackEl.className = "game-message win";
      if (passwordState.levelIndex < PASSWORD_LEVELS.length - 1) {
        if (nextBtn) nextBtn.style.display = "inline-block";
      } else if (restartBtn) {
        restartBtn.style.display = "inline-block";
      }
      return;
    }

    var hints = analyzePasswordGuess(guess, level.password);
    feedbackEl.textContent = hints.lengthHint + " " + hints.overlapHint + " " + hints.positionHint;
    feedbackEl.className = "game-message info";
  }

  function initPasswordGame() {
    passwordState.levelIndex = 0;
    showPasswordLevel();

    var submitBtn = document.getElementById("password-submit");
    var nextBtn = document.getElementById("password-next");
    var restartBtn = document.getElementById("password-restart");
    var inputEl = document.getElementById("password-input");

    if (submitBtn) {
      submitBtn.onclick = handlePasswordGuess;
    }
    if (inputEl) {
      inputEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handlePasswordGuess();
        }
      });
    }
    if (nextBtn) {
      nextBtn.onclick = function () {
        if (passwordState.levelIndex < PASSWORD_LEVELS.length - 1) {
          passwordState.levelIndex++;
          showPasswordLevel();
        }
      };
    }
    if (restartBtn) {
      restartBtn.onclick = function () {
        passwordState.levelIndex = 0;
        showPasswordLevel();
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("word-quest-board")) initWordQuest();
      if (document.getElementById("password-prompt")) initPasswordGame();
    });
  } else {
    if (document.getElementById("word-quest-board")) initWordQuest();
    if (document.getElementById("password-prompt")) initPasswordGame();
  }
})();
