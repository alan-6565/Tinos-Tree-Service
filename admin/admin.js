(function () {
  "use strict";

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  const loginScreen = $("#login-screen");
  const app = $("#app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const logoutBtn = $("#logout-btn");
  const lineItemsEl = $("#line-items");
  const addLineItemBtn = $("#add-line-item");
  const generateBtn = $("#generate-btn");
  const formError = $("#form-error");
  const historyBody = $("#history-body");
  const clientSearchInput = $("#client-search");
  const clientSearchResults = $("#client-search-results");

  let allDocuments = [];

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  function lineItemRow(description = "", price = "") {
    const row = document.createElement("div");
    row.className = "line-item";
    row.innerHTML = `
      <input type="text" class="li-desc" placeholder="e.g. Tree Removal, Trimming, Stump Grinding, etc." value="${description}">
      <input type="number" class="li-price" placeholder="0.00" min="0" step="0.01" value="${price}">
      <button type="button" class="remove-line" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
    row.querySelector(".remove-line").addEventListener("click", () => {
      if (lineItemsEl.children.length > 1) row.remove();
      updatePreview();
    });
    row.querySelectorAll("input").forEach((el) => el.addEventListener("input", updatePreview));
    return row;
  }

  function getFormState() {
    const docType = $('input[name="docType"]:checked').value;
    const lineItems = $$(".line-item", lineItemsEl).map((row) => ({
      description: row.querySelector(".li-desc").value.trim(),
      price: parseFloat(row.querySelector(".li-price").value) || 0,
    }));
    return {
      docType,
      clientName: $("#client-name").value.trim(),
      clientAddress: $("#client-address").value.trim(),
      clientEmail: $("#client-email").value.trim(),
      clientPhone: $("#client-phone").value.trim(),
      lineItems,
    };
  }

  function renderPreview(state, meta) {
    $("#preview-doc-title").textContent = state.docType === "proposal" ? "PROPOSAL" : "INVOICE";
    $("#preview-doc-number").textContent = meta && meta.number ? `#${meta.number}` : "#—";
    $("#preview-doc-date").textContent = new Date(meta && meta.created_at ? meta.created_at : Date.now())
      .toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

    $("#preview-client-name").textContent = state.clientName || "—";
    $("#preview-client-address").textContent = state.clientAddress || "";
    $("#preview-client-email").textContent = state.clientEmail || "";
    $("#preview-client-phone").textContent = state.clientPhone || "";

    const tbody = $("#preview-line-items");
    tbody.innerHTML = "";
    let total = 0;
    const items = state.lineItems.filter((i) => i.description);
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">No services added yet</td></tr>`;
    } else {
      items.forEach((item) => {
        total += item.price;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(item.description)}</td><td>${money(item.price)}</td>`;
        tbody.appendChild(tr);
      });
    }
    $("#preview-total").textContent = money(total);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updatePreview() {
    renderPreview(getFormState());
  }

  function addHistoryRow(doc) {
    if (historyBody.dataset.empty === "true") {
      historyBody.innerHTML = "";
      historyBody.dataset.empty = "false";
    }
    const tr = document.createElement("tr");
    const date = new Date(doc.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    tr.innerHTML = `
      <td>${doc.number}</td>
      <td>${doc.type === "proposal" ? "Proposal" : "Invoice"}</td>
      <td>${escapeHtml(doc.client_name)}</td>
      <td>${money(doc.total)}</td>
      <td>${date}</td>
    `;
    historyBody.prepend(tr);
  }

  function renderHistory(documents) {
    if (!documents || documents.length === 0) {
      historyBody.dataset.empty = "true";
      historyBody.innerHTML = `<tr><td colspan="5" class="muted">No documents yet.</td></tr>`;
      return;
    }
    historyBody.dataset.empty = "false";
    historyBody.innerHTML = "";
    documents.forEach(addHistoryRow);
  }

  function showApp() {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
  }

  function showLogin() {
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }

  async function checkSession() {
    const res = await fetch("/api/admin/documents");
    if (res.status === 401) {
      showLogin();
      return;
    }
    showApp();
    if (res.ok) {
      const { documents } = await res.json();
      allDocuments = documents || [];
      renderHistory(documents);
    } else {
      const err = await res.json().catch(() => ({}));
      historyBody.innerHTML = `<tr><td colspan="5" class="form-error">Could not load history: ${escapeHtml(err.error || "server error")}</td></tr>`;
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    const password = $("#password").value;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      loginForm.reset();
      checkSession();
    } else {
      loginError.classList.remove("hidden");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    showLogin();
  });

  addLineItemBtn.addEventListener("click", () => {
    lineItemsEl.appendChild(lineItemRow());
    updatePreview();
  });

  $$('input[name="docType"]').forEach((el) => el.addEventListener("change", updatePreview));
  ["client-name", "client-address", "client-email", "client-phone"].forEach((id) => {
    $(`#${id}`).addEventListener("input", updatePreview);
  });

  // Returning-client lookup: dedupe past documents into a client list
  // (by email, else phone, else name) so a repeat customer can be found
  // and the form autofilled instead of retyped.
  function uniqueClients() {
    const seen = new Map();
    allDocuments.forEach((doc) => {
      const key = (doc.client_email || doc.client_phone || doc.client_name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.set(key, {
        name: doc.client_name || "",
        address: doc.client_address || "",
        email: doc.client_email || "",
        phone: doc.client_phone || "",
      });
    });
    return Array.from(seen.values());
  }

  function renderClientResults(matches) {
    if (matches.length === 0) {
      clientSearchResults.innerHTML = `<div class="client-search__empty">No matching clients yet</div>`;
    } else {
      clientSearchResults.innerHTML = matches.map((c, i) => `
        <div class="client-search__item" data-index="${i}">
          <strong>${escapeHtml(c.name || "(no name)")}</strong>
          <span>${escapeHtml([c.phone, c.email, c.address].filter(Boolean).join(" · "))}</span>
        </div>
      `).join("");
    }
    clientSearchResults.classList.remove("hidden");
  }

  function hideClientResults() {
    clientSearchResults.classList.add("hidden");
  }

  clientSearchInput.addEventListener("input", () => {
    const query = clientSearchInput.value.trim().toLowerCase();
    if (!query) {
      hideClientResults();
      return;
    }
    const matches = uniqueClients().filter((c) =>
      [c.name, c.email, c.phone].some((field) => field.toLowerCase().includes(query))
    );
    renderClientResults(matches);
    clientSearchResults.dataset.matches = JSON.stringify(matches);
  });

  clientSearchInput.addEventListener("focus", () => {
    if (clientSearchInput.value.trim()) clientSearchInput.dispatchEvent(new Event("input"));
  });

  clientSearchResults.addEventListener("click", (e) => {
    const item = e.target.closest(".client-search__item");
    if (!item || item.dataset.index === undefined) return;
    const matches = JSON.parse(clientSearchResults.dataset.matches || "[]");
    const client = matches[Number(item.dataset.index)];
    if (!client) return;
    $("#client-name").value = client.name;
    $("#client-address").value = client.address;
    $("#client-email").value = client.email;
    $("#client-phone").value = client.phone;
    clientSearchInput.value = "";
    hideClientResults();
    updatePreview();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".client-search")) hideClientResults();
  });

  generateBtn.addEventListener("click", async () => {
    formError.classList.add("hidden");
    const state = getFormState();
    state.lineItems = state.lineItems.filter((i) => i.description);

    if (!state.clientName || state.lineItems.length === 0) {
      formError.textContent = "Please enter a client name and at least one service.";
      formError.classList.remove("hidden");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";

    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: state.docType, ...state }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not save document");
      }
      const { document: doc } = await res.json();
      renderPreview(state, doc);
      addHistoryRow(doc);
      allDocuments.unshift(doc);

      const filename = `${doc.type}-${doc.number}.pdf`;
      // Render a detached clone appended in normal document flow (html2canvas
      // renders position:fixed elements as blank). html2canvas captures
      // relative to document (0,0), so rather than compute scroll
      // compensation, just force scroll to the top for the capture and
      // restore the admin's actual scroll position afterward.
      const previewEl = $("#doc-preview");
      const clone = previewEl.cloneNode(true);
      clone.removeAttribute("id");
      clone.classList.add("doc-preview--export");
      clone.style.margin = "0";
      // SVG ids must be unique in the document; give the clone's its own.
      clone.querySelectorAll("[id]").forEach((el) => {
        const newId = `${el.id}-clone`;
        clone.querySelectorAll(`[href="#${el.id}"]`).forEach((ref) => ref.setAttribute("href", `#${newId}`));
        el.id = newId;
      });
      document.body.appendChild(clone);
      const restoreScrollX = window.scrollX;
      const restoreScrollY = window.scrollY;
      window.scrollTo(0, 0);
      try {
        await window.html2pdf().from(clone).set({
          margin: 0.4,
          filename,
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], avoid: "tr" },
        }).save();
      } finally {
        clone.remove();
        window.scrollTo(restoreScrollX, restoreScrollY);
      }
    } catch (err) {
      formError.textContent = err.message || "Something went wrong.";
      formError.classList.remove("hidden");
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Generate Document';
    }
  });

  // Init
  lineItemsEl.appendChild(lineItemRow());
  updatePreview();
  checkSession();
})();
