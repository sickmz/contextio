// @ts-ignore
const vscode = acquireVsCodeApi();

const search_input = document.getElementById("searchInput");
const search_results = document.getElementById("searchResults");
const context_pills_container = document.getElementById("contextPills");
const export_btn = document.getElementById("exportBtn");
const drop_hint = document.querySelector(".drop-hint");

const summary_container = document.getElementById("summary-container");
const context_summary = document.getElementById("context-summary");

let debounce_timer;
let active_index = -1;
let selected_for_multi_add = new Set();

const commands = [
  {
    name: "/opentabs",
    description: "Add all open tabs in the editor",
    command: "opentabs",
  },
];

function updateMultiSelectFooter() {
  let footer = document.getElementById("multiSelectFooter");
  if (selected_for_multi_add.size > 0) {
    if (!footer) {
      footer = document.createElement("li");
      footer.id = "multiSelectFooter";
      search_results.appendChild(footer);
    }
    footer.innerHTML = `
  <vscode-button id="addSelectedBtn" appearance="primary">
   Add ${selected_for_multi_add.size} selected files
  </vscode-button>
 `;
    const add_btn = document.getElementById("addSelectedBtn");
    if (add_btn) {
      add_btn.addEventListener("click", () => {
        vscode.postMessage({
          type: "addMultipleFiles",
          value: Array.from(selected_for_multi_add),
        });
        resetSearchUI();
      });
    }
  } else {
    if (footer) {
      footer.remove();
    }
  }
}

function resetSearchUI() {
  search_input.value = "";
  search_results.innerHTML = "";
  search_results.style.display = "none";
  active_index = -1;
  selected_for_multi_add.clear();
}

function createPill(file) {
  return `
 <div class="pill" data-resource="${file.resource}">
  <span class="file-name">${file.label}</span>
  <span class="close-btn codicon codicon-close"></span>
 </div>`;
}

function updateSummaryView(summary) {
  if (!summary) {
    context_summary.innerHTML = "";
    return;
  }
  context_summary.innerHTML = `
<pre>
Total Files: ${summary.total_files} files
Total Chars: ${summary.total_chars.toLocaleString()} chars
Total Tokens: ${summary.total_tokens.toLocaleString()} tokens
</pre>
`;
}

function updateHighlight() {
  const items = search_results.querySelectorAll("li[data-resource]");
  items.forEach((item, index) => {
    item.classList.toggle("active", index === active_index);
    if (index === active_index) {
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectFile(resource) {
  if (resource) {
    vscode.postMessage({ type: "addFile", value: resource });
    resetSearchUI();
  }
}

function executeCommand(command_type) {
  if (command_type === "opentabs") {
    vscode.postMessage({ type: "addOpenFiles" });
  }
  resetSearchUI();
}

search_input.addEventListener("input", (e) => {
  const query = e.target.value;
  active_index = -1;
  selected_for_multi_add.clear();
  clearTimeout(debounce_timer);

  if (query.startsWith("@")) {
    debounce_timer = setTimeout(() => {
      vscode.postMessage({ type: "searchFiles", value: query.substring(1) });
    }, 300);
    return;
  }

  if (query.startsWith("/")) {
    const filtered_commands = commands.filter((cmd) =>
      cmd.name.startsWith(query)
    );
    if (filtered_commands.length > 0) {
      search_results.className = "command-list";
      search_results.innerHTML = filtered_commands
        .map(
          (cmd) => `
  <li class="command-suggestion" data-command="${cmd.command}">
   <div class="command-name">${cmd.name}</div>
   <div class="command-description">${cmd.description}</div>
  </li>`
        )
        .join("");
      search_results.style.display = "block";
    } else {
      search_results.style.display = "none";
    }
    return;
  }

  resetSearchUI();
});

search_input.addEventListener("keydown", (e) => {
  const items = search_results.querySelectorAll(
    "li[data-resource], li[data-command]"
  );
  if (items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    active_index = (active_index + 1) % items.length;
    updateHighlight();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    active_index = (active_index - 1 + items.length) % items.length;
    updateHighlight();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (active_index >= 0) {
      const item = items[active_index];
      if (item.dataset.command) {
        executeCommand(item.dataset.command);
      } else {
        selectFile(item.dataset.resource);
      }
    }
  } else if (e.key === " ") {
    e.preventDefault();
    if (active_index >= 0) {
      const item = items[active_index];
      if (item.dataset.resource) {
        const checkbox = item.querySelector("vscode-checkbox");
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  }
});

search_results.addEventListener("click", (e) => {
  const target = e.target;
  if (target.tagName === "VSCODE-CHECKBOX") {
    return;
  }

  const item = target.closest("li[data-resource], li[data-command]");
  if (item) {
    if (item.dataset.command) {
      executeCommand(item.dataset.command);
    } else {
      selectFile(item.dataset.resource);
    }
  }
});

search_results.addEventListener("change", (e) => {
  const target = e.target;
  if (target.tagName === "VSCODE-CHECKBOX") {
    const resource = target.closest("li[data-resource]")?.dataset.resource;
    if (!resource) return;

    if (target.checked) {
      selected_for_multi_add.add(resource);
    } else {
      selected_for_multi_add.delete(resource);
    }
    updateMultiSelectFooter();
  }
});

context_pills_container.addEventListener("click", (e) => {
  const close_btn = e.target.closest(".close-btn");
  if (close_btn) {
    const pill = close_btn.closest(".pill");
    if (pill) {
      vscode.postMessage({ type: "removeFile", value: pill.dataset.resource });
    }
  }
});

document.getElementById("context-container").addEventListener("click", (e) => {
  if (e.target.closest("#clearContextBtn")) {
    vscode.postMessage({ type: "clearContext" });
  }
});

export_btn.addEventListener("click", () => {
  vscode.postMessage({ type: "exportContext" });
});

document.addEventListener("click", (e) => {
  if (!search_results.contains(e.target) && e.target !== search_input) {
    resetSearchUI();
  }
});

document.body.addEventListener("dragover", (event) => {
  event.preventDefault();
  context_pills_container.classList.add("drag-over");
});

document.body.addEventListener("dragleave", () => {
  context_pills_container.classList.remove("drag-over");
});

document.body.addEventListener("drop", (event) => {
  event.preventDefault();
  context_pills_container.classList.remove("drag-over");
  if (!event.dataTransfer) return;

  const data_types = [
    "application/vnd.code.uri-list",
    "text/uri-list",
    "resourceurls",
  ];
  let uris = [];

  for (const type of data_types) {
    const raw_data = event.dataTransfer.getData(type);
    if (!raw_data) continue;

    if (type === "resourceurls") {
      try {
        uris = JSON.parse(raw_data);
      } catch (e) {}
    } else {
      uris = raw_data
        .split("\n")
        .map((str) => str.trim())
        .filter(Boolean);
    }

    if (uris.length > 0) break;
  }

  const unique_uris = [...new Set(uris)];
  if (unique_uris.length > 0) {
    vscode.postMessage({ type: "addDroppedFiles", value: unique_uris });
  }
});

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "searchResults": {
      const grouped_files = message.files;
      const file_groups = Object.keys(grouped_files).sort();
      let html = "";

      if (file_groups.length > 0) {
        search_results.className = "file-list";

        for (const directory of file_groups) {
          html += `
   <li class="group-header">
    <span class="codicon codicon-folder"></span>
    <span>${directory}</span>
   </li>`;

          const files_in_group = grouped_files[directory].sort((a, b) =>
            a.filename.localeCompare(b.filename)
          );

          html += files_in_group
            .map(
              (file) => `
                <li class="file-item" data-resource="${file.resource}">
                <vscode-checkbox></vscode-checkbox>
                <span class="codicon codicon-file"></span>
                <span class="file-name">${file.filename}</span>
                </li>`
            )
            .join("");
        }
        search_results.innerHTML = html;
        search_results.style.display = "block";
      } else {
        search_results.style.display = "none";
      }
      updateMultiSelectFooter();
      break;
    }
    case "updateContext": {
      const has_files = message.files.length > 0;
      if (has_files) {
        context_pills_container.innerHTML = message.files
          .map(createPill)
          .join("");

        summary_container.style.display = "block";
        updateSummaryView(message.summary);
      } else {
        context_pills_container.innerHTML = `<p class="drop-hint">Drag and drop files here (hold shift)</p>`;
        summary_container.style.display = "none";
      }
      if (drop_hint) drop_hint.style.display = has_files ? "none" : "block";
      break;
    }
  }
});
