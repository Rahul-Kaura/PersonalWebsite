(function () {
  "use strict";

  // ---- Word Quest (Wordle-style) - local logic only (no external API) ----
  // Inspired by Wordle clones such as:
  // https://github.com/Prajjwal-Chauhan/Wordle-Clone
  // We keep the UI from this site and implement local scoring and feedback.

  // Word list: loaded from wordle_words.txt (1500 5-letter words)
  var LOCAL_WORD_LIST = [];

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

  function loadWordList() {
    if (LOCAL_WORD_LIST.length) return Promise.resolve();
    return fetch("wordle_words.txt")
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var words = text.split(/\s+/).map(function (w) { return w.trim().toLowerCase(); })
          .filter(function (w) { return w.length === 5; });
        if (words.length) LOCAL_WORD_LIST = words;
      })
      .catch(function () {
        // If loading fails we fall back to a small built-in list.
        LOCAL_WORD_LIST = ["array", "query", "stack", "graph", "cloud", "model", "token", "neural"];
      });
  }

  function pickLocalWord() {
    if (!LOCAL_WORD_LIST.length) {
      LOCAL_WORD_LIST = ["array", "query", "stack", "graph", "cloud", "model", "token", "neural"];
    }
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
        var answer = wordQuest.localTarget || "";
        setMessage("Out of guesses! The word was: " + answer.toUpperCase() + ". Click New Game to try another.", "lose");
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

  // ---- Phishing Shield (email / URL spotter) ----
  var PHISHING_SCENARIOS = [
    { subject: "Urgent: Verify your SCU account now", from: "it-helpdesk@scu-security.com", body: "Dear student,\n\nWe detected unusual login attempts on your account. Please confirm your password within 30 minutes to avoid suspension:\nhttps://scu.edu.verify-login-secure.com\n\nIT Security", label: "phishing", reason: "Look-alike domain, artificial urgency, and password request." },
    { subject: "Receipt for your tuition payment", from: "bursar@scu.edu", body: "Hi Rahul,\n\nYour tuition payment has been received. You can view your statement in the official portal.\n\nThanks,\nSCU Bursar's Office", label: "safe", reason: "Uses official scu.edu address and no login link in email body." },
    { subject: "Password Expiring Today – Action Required", from: "support@scu-it.com", body: "Your email password expires today. Click the link below and enter your current password to keep access:\nhttp://scu-it-reset.com/login\n\nSupport Team", label: "phishing", reason: "Non-SCU domain and asks for current password directly." },
    { subject: "Professor shared a file with you", from: "drive-sharing@google.com", body: "Rahul,\n\nYour professor shared a document with you via Google Drive.\nOpen in Drive: https://drive.google.com/...\n\nGoogle Drive", label: "safe", reason: "Legitimate sender and domain." },
    { subject: "Security Alert: Multiple failed logins", from: "no-reply@secure-scu-login.com", body: "We blocked several suspicious login attempts.\nImmediately log in here to secure your account:\nhttps://secure-scu-login.com\n\nSecurity Center", label: "phishing", reason: "Not an scu.edu domain and tries to create panic." },
    { subject: "Free AirPods for SCU Students", from: "campus-giveaway@promooffers.io", body: "Congrats! You were randomly selected for a free AirPods giveaway. Just enter your credit card for shipping.\n\nClaim now: http://scu-free-airpods.io", label: "phishing", reason: "Too good to be true; asks for card data on unknown domain." },
    { subject: "Career Center Appointment Reminder", from: "careercenter@scu.edu", body: "Hi Rahul,\n\nThis is a reminder of your appointment with the Career Center tomorrow at 3pm.\n\nIf you need to reschedule, log into the career portal as usual.", label: "safe", reason: "Consistent with expected campus communications." },
    { subject: "Security Training Overdue", from: "security-training@scu.edu", body: "Hello,\n\nOur records show you still need to complete the annual security awareness training.\nPlease log in through the usual MySCU portal to finish it.\n\nThank you.", label: "safe", reason: "Uses official domain and points you to normal login path." },
    { subject: "Action Needed: Scholarship Disbursement", from: "finance-officer@scu-scholarships.net", body: "Dear student,\n\nWe cannot release your scholarship funds until you confirm your bank credentials here:\nhttps://scholarships-scu-payments.net", label: "phishing", reason: "Non-SCU domain and direct request for bank credentials." },
    { subject: "Unusual sign-in attempt blocked", from: "no-reply@accounts.google.com", body: "We blocked a sign-in attempt to your Google account.\nIf this was you, you can safely ignore this message.\n\nCheck activity: https://myaccount.google.com/device-activity", label: "safe", reason: "Legitimate domain and typical Google security wording." }
  ];

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var phishingState = { order: [], index: 0, correct: 0, total: 0 };

  function currentPhish() {
    var idx = phishingState.order[phishingState.index];
    return PHISHING_SCENARIOS[idx];
  }

  function showPhishScenario() {
    if (!phishingState.order.length) {
      phishingState.order = shuffleArray(PHISHING_SCENARIOS);
      phishingState.index = 0;
      phishingState.correct = 0;
      phishingState.total = 0;
    }
    var scenario = currentPhish();
    var bodyEl = document.getElementById("phish-body");
    var metaEl = document.getElementById("phish-meta");
    var feedbackEl = document.getElementById("phish-feedback");
    var scoreEl = document.getElementById("phish-score");
    if (bodyEl) bodyEl.textContent = scenario.body;
    if (metaEl) metaEl.innerHTML = "<strong>From:</strong> " + scenario.from + "<br><strong>Subject:</strong> " + scenario.subject;
    if (feedbackEl) { feedbackEl.textContent = ""; feedbackEl.className = "game-message"; }
    if (scoreEl) scoreEl.textContent = "Score: " + phishingState.correct + " / " + phishingState.total + " decided";
  }

  function handlePhishChoice(choice) {
    var scenario = currentPhish();
    var feedbackEl = document.getElementById("phish-feedback");
    var scoreEl = document.getElementById("phish-score");
    phishingState.total++;
    var isCorrect = (choice === scenario.label);
    if (isCorrect) {
      phishingState.correct++;
      if (feedbackEl) { feedbackEl.textContent = "Correct – " + scenario.reason; feedbackEl.className = "game-message win"; }
    } else if (feedbackEl) {
      var expected = scenario.label === "phishing" ? "phishy" : "safe";
      feedbackEl.textContent = "Not quite. This is considered " + expected + " because: " + scenario.reason;
      feedbackEl.className = "game-message lose";
    }
    if (scoreEl) scoreEl.textContent = "Score: " + phishingState.correct + " / " + phishingState.total + " decided";
  }

  function nextPhish() {
    phishingState.index++;
    if (phishingState.index >= phishingState.order.length) {
      phishingState.order = shuffleArray(PHISHING_SCENARIOS);
      phishingState.index = 0;
    }
    showPhishScenario();
  }

  function initPhishingShield() {
    if (!document.getElementById("phish-body")) return;
    phishingState.order = shuffleArray(PHISHING_SCENARIOS);
    phishingState.index = 0;
    phishingState.correct = 0;
    phishingState.total = 0;
    showPhishScenario();
    document.querySelectorAll(".phish-btn[data-choice]").forEach(function (btn) {
      btn.addEventListener("click", function () { handlePhishChoice(btn.getAttribute("data-choice")); });
    });
    var nextBtn = document.getElementById("phish-next");
    if (nextBtn) nextBtn.addEventListener("click", nextPhish);
  }

  // ---- Cipher Lab (decryption challenges) ----
  var CIPHER_CHALLENGES = [
    { cipher: "Khoor, Zruog!", plain: "hello, world!", hint: "Classic Caesar shift by +3.", type: "caesar" },
    { cipher: "Uifsf jt op tqppo.", plain: "there is no spoon.", hint: "Every letter shifted +1.", type: "caesar" },
    { cipher: "Gr zg rh uli gsv Uilnvmg?", plain: "to it is you the Student?", hint: "Atbash-style reversal of the alphabet.", type: "substitution" },
    { cipher: "H3ll0, 57ud3n7!", plain: "hello, student!", hint: "Typical leetspeak (numbers for letters).", type: "leet" },
    { cipher: "Pdeo eo k fobxkq ql elzzbp qeb ifkb.", plain: "this is a simple caesar over the text.", hint: "Caesar shift but not +1 or +3.", type: "caesar" },
    { cipher: "ifmmp tfdsfu bhfou", plain: "hello secret agent", hint: "Each letter one ahead of its plain form.", type: "caesar" },
    { cipher: "Sgd vzsdijnm hr qdzcq.", plain: "the watershed is ready.", hint: "Shift of -1 from encrypted back to plain.", type: "caesar" },
    { cipher: "Vg'f abg gur frperg vs rirelbar pna ernq vg.", plain: "it's not the secret if everyone can read it.", hint: "ROT13: letters rotated by 13.", type: "rot13" },
    { cipher: "Ymj vznhp gwtbs ktc ozrux tajw ymj qfed itl.", plain: "the quick brown fox jumps over the lazy dog.", hint: "Caesar with a shift of +5.", type: "caesar" },
    { cipher: "Lbh unir snxr rapbhagre nccyvpngvba.", plain: "you have fake encounter application.", hint: "Another ROT13 example.", type: "rot13" }
  ];

  var cipherState = { order: [], index: 0, solved: 0, attempts: 0 };

  function currentCipher() {
    var idx = cipherState.order[cipherState.index];
    return CIPHER_CHALLENGES[idx];
  }

  function normaliseAnswer(str) {
    return (str || "").trim().toLowerCase();
  }

  function showCipherChallenge() {
    if (!cipherState.order.length) {
      cipherState.order = shuffleArray(CIPHER_CHALLENGES);
      cipherState.index = 0;
      cipherState.solved = 0;
      cipherState.attempts = 0;
    }
    var challenge = currentCipher();
    var cipherEl = document.getElementById("cipher-ciphertext");
    var hintEl = document.getElementById("cipher-hint");
    var inputEl = document.getElementById("cipher-answer");
    var feedbackEl = document.getElementById("cipher-feedback");
    var scoreEl = document.getElementById("cipher-score");
    if (cipherEl) cipherEl.textContent = challenge.cipher;
    if (hintEl) hintEl.textContent = "Hint: " + challenge.hint;
    if (inputEl) { inputEl.value = ""; inputEl.focus(); }
    if (feedbackEl) { feedbackEl.textContent = ""; feedbackEl.className = "game-message"; }
    if (scoreEl) scoreEl.textContent = "Solved: " + cipherState.solved + " · Attempts: " + cipherState.attempts;
  }

  function handleCipherSubmit() {
    var challenge = currentCipher();
    var inputEl = document.getElementById("cipher-answer");
    var feedbackEl = document.getElementById("cipher-feedback");
    var scoreEl = document.getElementById("cipher-score");
    if (!inputEl || !feedbackEl || !scoreEl) return;
    var guess = inputEl.value;
    if (!guess.trim()) {
      feedbackEl.textContent = "Type your decryption guess first.";
      feedbackEl.className = "game-message info";
      return;
    }
    cipherState.attempts++;
    var correctPlain = normaliseAnswer(challenge.plain);
    var guessPlain = normaliseAnswer(guess);
    if (guessPlain === correctPlain) {
      cipherState.solved++;
      feedbackEl.textContent = "Nice work – you fully decrypted it!";
      feedbackEl.className = "game-message win";
    } else {
      feedbackEl.textContent = "Not quite. Compare patterns and punctuation, then try again.";
      feedbackEl.className = "game-message lose";
    }
    scoreEl.textContent = "Solved: " + cipherState.solved + " · Attempts: " + cipherState.attempts;
  }

  function nextCipher() {
    cipherState.index++;
    if (cipherState.index >= cipherState.order.length) {
      cipherState.order = shuffleArray(CIPHER_CHALLENGES);
      cipherState.index = 0;
    }
    showCipherChallenge();
  }

  function initCipherLab() {
    if (!document.getElementById("cipher-ciphertext")) return;
    cipherState.order = shuffleArray(CIPHER_CHALLENGES);
    cipherState.index = 0;
    cipherState.solved = 0;
    cipherState.attempts = 0;
    showCipherChallenge();
    var submitBtn = document.getElementById("cipher-submit");
    var nextBtn = document.getElementById("cipher-next");
    if (submitBtn) submitBtn.addEventListener("click", handleCipherSubmit);
    if (nextBtn) nextBtn.addEventListener("click", nextCipher);
    var answerInput = document.getElementById("cipher-answer");
    if (answerInput) answerInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); handleCipherSubmit(); } });
  }

  function bootGames() {
    var hasWordQuest = !!document.getElementById("word-quest-board");
    var hasPhish = !!document.getElementById("phish-body");
    var hasCipher = !!document.getElementById("cipher-ciphertext");
    if (hasWordQuest) {
      loadWordList().finally(function () { initWordQuest(); });
    }
    if (hasPhish) initPhishingShield();
    if (hasCipher) initCipherLab();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGames);
  } else {
    bootGames();
  }
})();
