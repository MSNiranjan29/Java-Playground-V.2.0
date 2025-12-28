// ==========================================
// 1. CODEMIRROR EDITOR SETUP
// ==========================================
let editor = CodeMirror(document.getElementById("editor"), {
  value: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter your name:");
        String name = sc.nextLine();
        
        System.out.println("Enter your age:");
        int age = sc.nextInt();
        
        System.out.println("Hello " + name + ", you are " + age + "!");
    }
}`,
  mode: "text/x-java",
  theme: "dracula",
  lineNumbers: true,
  gutters: ["CodeMirror-linenumbers", "error-gutter"],
  extraKeys: {
    "Ctrl-Space": "autocomplete",
    "Ctrl-Enter": function (cm) {
      connectAndRun();
    },
    "Cmd-Enter": function (cm) {
      connectAndRun();
    }, // Mac
  },
});

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const container = document.getElementById("container");
const splitter = document.getElementById("splitter");
const editorPane = document.querySelector(".editor-pane");
const terminalPane = document.getElementById("terminalPane");
const layoutSelect = document.getElementById("layoutSelect");

// Header Buttons
const runBtn = document.getElementById("runBtn");
const copyBtn = document.getElementById("copyBtn");
const aiBtn = document.getElementById("aiBtn");
const hintBtn = document.getElementById("hintBtn"); // Make sure this exists in HTML
const saveBtn = document.getElementById("saveBtn");

// Terminal Elements
const terminalBody = document.getElementById("terminalBody");
const terminalOutput = document.getElementById("terminalOutput");
const terminalInput = document.getElementById("terminalInput");

// Sidebar Elements
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const closeSidebar = document.getElementById("closeSidebar");
const programList = document.getElementById("programList");
const newProgramBtn = document.getElementById("newProgramBtn");

// Modals
const saveModal = document.getElementById("saveModal");
const deleteModal = document.getElementById("deleteModal");
const fileNameInput = document.getElementById("fileNameInput");
const cancelSaveBtn = document.getElementById("cancelSaveBtn");
const confirmSaveBtn = document.getElementById("confirmSaveBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const saveModalTitle = document.getElementById("saveModalTitle");

// State Variables
let socket = null;
let editorSizePercent = 60;
let currentProgramId = null;
let pendingDeleteId = null;

// ==========================================
// 3. LAYOUT & RESIZING
// ==========================================
function setLayout(layout) {
  const isHorizontal = layout === "right" || layout === "left";
  container.className = `layout-${layout} ${
    isHorizontal ? "horizontal" : "vertical"
  }`;
  splitter.className = `splitter ${
    isHorizontal ? "splitter-vertical" : "splitter-horizontal"
  }`;
  applySizing(editorSizePercent);
}

function applySizing(pct) {
  pct = Math.max(10, Math.min(90, pct));
  editorPane.style.flex = `0 0 ${pct}%`;
  terminalPane.style.flex = `1 1 ${100 - pct}%`;
  editor.refresh();
}

layoutSelect.addEventListener("change", (e) => setLayout(e.target.value));
setLayout("right");

// Splitter Dragging Logic
let isDragging = false;
splitter.addEventListener("mousedown", () => {
  isDragging = true;
  document.body.style.userSelect = "none";
});
window.addEventListener("mouseup", () => {
  isDragging = false;
  document.body.style.userSelect = "";
});
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = container.getBoundingClientRect();
  const isHorizontal = container.classList.contains("horizontal");
  let pct = isHorizontal
    ? ((e.clientX - rect.left) / rect.width) * 100
    : ((e.clientY - rect.top) / rect.height) * 100;

  if (
    container.classList.contains("layout-left") ||
    container.classList.contains("layout-top")
  )
    pct = 100 - pct;
  editorSizePercent = pct;
  applySizing(pct);
});

// ==========================================
// 4. TERMINAL LOGIC
// ==========================================
function addToTerminal(text, type = "normal") {
  const div = document.createElement("div");
  div.className = "log-entry log-" + type;
  div.textContent = text;
  terminalOutput.appendChild(div);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

function clearTerminal() {
  terminalOutput.innerHTML = "";
  terminalInput.focus();
}

terminalBody.addEventListener("click", () => {
  if (window.getSelection().toString().length === 0) {
    terminalInput.focus();
  }
});

terminalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const text = terminalInput.value;
    addToTerminal(text + " ↵", "input"); // Echo input

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send("INPUT:" + text);
    } else {
      addToTerminal("Program is not running. Click Run first.", "system");
    }
    terminalInput.value = "";
  }
});

// ==========================================
// 5. COMPILER & WEBSOCKET
// ==========================================
function connectAndRun() {
  clearErrors();
  addToTerminal("--- Compiling & Running ---", "system");

  runBtn.innerHTML = '<span class="btn-icon">⏳</span> Running...';
  runBtn.disabled = true;

  if (socket) socket.close();

  socket = new WebSocket("ws://localhost:8080/terminal");

  socket.onopen = () => {
    socket.send("RUN:" + editor.getValue());
    terminalInput.focus();
  };

  socket.onmessage = (event) => {
    const msg = event.data;
    if (msg.startsWith("OUTPUT:")) {
      addToTerminal(msg.substring(7), "normal");
    } else if (msg.startsWith("ERROR:")) {
      const errorText = msg.substring(6);
      addToTerminal(errorText, "error");
      highlightErrorLines(errorText);
    } else if (msg.startsWith("EXIT:")) {
      addToTerminal("=== " + msg.substring(5) + " ===", "system");
      socket.close();
    }
  };

  socket.onclose = () => {
    runBtn.innerHTML = '<span class="btn-icon">▶</span> Run';
    runBtn.disabled = false;
  };

  socket.onerror = () => {
    addToTerminal("Connection Error. Is the server running?", "error");
    runBtn.innerHTML = '<span class="btn-icon">▶</span> Run';
    runBtn.disabled = false;
  };
}

// ==========================================
// 6. AI FEATURES (TESTS & HINTS)
// ==========================================
aiBtn.addEventListener("click", () => {
  addToTerminal("Generating BRUTAL test cases... 🧪", "system");
  fetch("/api/gemini/testcases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: editor.getValue() }),
  })
    .then((res) => res.json())
    .then((data) => {
      addToTerminal("\n", "normal");
      addToTerminal(data.testCases, "ai");
      addToTerminal("\n", "normal");
    })
    .catch((err) => addToTerminal("Error calling AI: " + err, "error"));
});

if (hintBtn) {
  hintBtn.addEventListener("click", () => {
    addToTerminal("Analyzing code for hints... 💡", "system");
    fetch("/api/gemini/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: editor.getValue() }),
    })
      .then((res) => res.json())
      .then((data) => {
        addToTerminal("\n--- HINTS ---\n", "system");
        addToTerminal(data.result, "ai");
        addToTerminal("-------------\n", "system");
      })
      .catch((err) => addToTerminal("Error calling Hint AI: " + err, "error"));
  });
}

// ==========================================
// 7. TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return; // Guard clause

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  toastContainer.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 8. SIDEBAR & PROGRAM MANAGEMENT
// ==========================================
// Toggle Sidebar
menuBtn.addEventListener("click", () => sidebar.classList.add("open"));
closeSidebar.addEventListener("click", () => sidebar.classList.remove("open"));
document
  .querySelector(".editor-pane")
  .addEventListener("click", () => sidebar.classList.remove("open"));

function loadPrograms() {
  fetch("/api/programs")
    .then((res) => res.json())
    .then((programs) => {
      programList.innerHTML = "";
      programs.forEach((prog) => {
        const div = document.createElement("div");
        div.className = `program-item ${
          prog.id === currentProgramId ? "active" : ""
        }`;

        // SVG ICONS DEFINITIONS
        const fileIcon = `<svg class="file-icon" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
        const editIcon = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        const trashIcon = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        div.innerHTML = `
                    <div class="file-info">
                        ${fileIcon}
                        <span class="prog-title">${prog.name}</span>
                    </div>
                    <div class="program-actions">
                        <button class="action-btn" title="Rename" onclick="openRenameModal(${prog.id}, '${prog.name}', event)">
                            ${editIcon}
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="confirmDelete(${prog.id}, event)">
                            ${trashIcon}
                        </button>
                    </div>
                `;

        // Handle Click
        div.onclick = (e) => {
          // Prevent opening if an action button was clicked
          if (e.target.closest(".action-btn")) return;
          openProgram(prog);
        };

        programList.appendChild(div);
      });
    })
    .catch(() => console.log("Guest mode or API error"));
}

function openProgram(prog) {
  currentProgramId = prog.id;
  editor.setValue(prog.code);
  sidebar.classList.remove("open");
  loadPrograms();
}

newProgramBtn.addEventListener("click", () => {
  currentProgramId = null;
  editor.setValue(
    `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World!");\n    }\n}`
  );
  sidebar.classList.remove("open");
  loadPrograms();
  showToast("New program started", "info");
});

// ==========================================
// 9. SAVE & RENAME LOGIC (MODAL)
// ==========================================
function initiateSave() {
  saveModal.style.display = "flex";

  // Suggest name
  if (!currentProgramId) {
    const match = editor.getValue().match(/class\s+(\w+)/);
    fileNameInput.value = match ? match[1] + ".java" : "Main.java";
    if (saveModalTitle) saveModalTitle.textContent = "Save Program";
  } else {
    // Find current name logic is handled inside openRenameModal mostly,
    // but if simple save is clicked on existing file, just prepopulate standard logic
    const match = editor.getValue().match(/class\s+(\w+)/);
    fileNameInput.value = match ? match[1] + ".java" : "Main.java";
    if (saveModalTitle) saveModalTitle.textContent = "Save Changes";
  }

  fileNameInput.focus();
  fileNameInput.select();
}

window.openRenameModal = function (id, currentName, event) {
  event.stopPropagation();
  currentProgramId = id;
  saveModal.style.display = "flex";
  if (saveModalTitle) saveModalTitle.textContent = "Rename Program";
  fileNameInput.value = currentName;
  fileNameInput.focus();
  fileNameInput.select();
};

function executeSave() {
  const name = fileNameInput.value.trim();
  if (!name) {
    showToast("Filename cannot be empty", "error");
    return;
  }

  const payload = {
    id: currentProgramId ? currentProgramId.toString() : null,
    title: name,
    code: editor.getValue(),
  };

  fetch("/api/programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Login required");
      return res.json();
    })
    .then((data) => {
      currentProgramId = data.id;
      showToast("Code saved successfully!", "success");
      saveModal.style.display = "none";
      loadPrograms();
    })
    .catch(() => {
      showToast("Please Login to save code!", "error");
      saveModal.style.display = "none";
    });
}

saveBtn.addEventListener("click", initiateSave);
confirmSaveBtn.addEventListener("click", executeSave);
cancelSaveBtn.addEventListener(
  "click",
  () => (saveModal.style.display = "none")
);
fileNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") executeSave();
});

// ==========================================
// 10. DELETE LOGIC (MODAL)
// ==========================================
window.confirmDelete = function (id, event) {
  event.stopPropagation();
  pendingDeleteId = id;
  deleteModal.style.display = "flex";
};

function executeDelete() {
  if (!pendingDeleteId) return;

  fetch(`/api/programs/${pendingDeleteId}`, { method: "DELETE" })
    .then(() => {
      showToast("Program deleted", "success");
      if (currentProgramId === pendingDeleteId) {
        currentProgramId = null;
        editor.setValue("");
      }
      deleteModal.style.display = "none";
      loadPrograms();
    })
    .catch(() => showToast("Error deleting program", "error"));
}

confirmDeleteBtn.addEventListener("click", executeDelete);
cancelDeleteBtn.addEventListener(
  "click",
  () => (deleteModal.style.display = "none")
);

// Close modals on outside click
window.onclick = (event) => {
  if (event.target == saveModal) saveModal.style.display = "none";
  if (event.target == deleteModal) deleteModal.style.display = "none";
};

// ==========================================
// 11. UTILS & SHORTCUTS
// ==========================================
function highlightErrorLines(errorText) {
  const lines = errorText.split("\n");
  lines.forEach((line) => {
    const match = line.match(/Line\s+(\d+):/) || line.match(/:(\d+):/);
    if (match) {
      const lineNum = parseInt(match[1]) - 1;
      if (editor.getLine(lineNum) !== undefined) {
        editor.addLineClass(lineNum, "background", "cm-error-line");
        const dot = document.createElement("div");
        dot.className = "error-gutter-marker";
        editor.setGutterMarker(lineNum, "error-gutter", dot);
      }
    }
  });
}

function clearErrors() {
  editor.eachLine((line) => {
    editor.removeLineClass(line, "background", "cm-error-line");
    editor.setGutterMarker(line, "error-gutter", null);
  });
}

function copyCode() {
  navigator.clipboard.writeText(editor.getValue());
  const oldText = copyBtn.innerHTML;
  copyBtn.innerHTML = '<span class="btn-icon">✓</span> Copied';
  setTimeout(() => (copyBtn.innerHTML = oldText), 1000);
}

// Global Shortcuts
document.addEventListener("keydown", function (e) {
  // Ctrl+S to Save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    initiateSave();
  }
});

// Event Listeners
runBtn.addEventListener("click", connectAndRun);
copyBtn.addEventListener("click", copyCode);
window.addEventListener("resize", () => editor.refresh());

// Initial Load
fetch("/user")
  .then((res) => res.json())
  .then((data) => {
    if (data.loggedIn) loadPrograms();
  });
