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

      const previewEl = $("#doc-preview");
      const filename = `${doc.type}-${doc.number}.pdf`;
      await window.html2pdf().from(previewEl).set({
        margin: 0.4,
        filename,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      }).save();
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
