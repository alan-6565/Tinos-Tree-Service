(function () {
  "use strict";

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  const loginScreen = $("#login-screen");
  const app = $("#app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const logoutBtn = $("#logout-btn");
  const jobsEl = $("#jobs");
  const addJobBtn = $("#add-job");
  const generateBtn = $("#generate-btn");
  const formError = $("#form-error");
  const historyBody = $("#history-body");
  const clientSearchInput = $("#client-search");
  const clientSearchResults = $("#client-search-results");

  let allDocuments = [];

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  // A job is one visit/work day: its own date (or date range), an optional
  // address when it's not at the client's address, the work done (one item
  // per line), and a single price for the whole job.
  function jobCard(job = {}) {
    const card = document.createElement("div");
    card.className = "job-card";
    card.innerHTML = `
      <div class="job-card__head">
        <strong class="job-card__title"></strong>
        <button type="button" class="remove-job" aria-label="Remove job"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="job-card__dates">
        <label>Date<input type="date" class="job-date"></label>
        <label>Through <span class="muted">(optional)</span><input type="date" class="job-end-date"></label>
      </div>
      <input type="text" class="job-address" placeholder="Job address (leave blank if same as client)">
      <textarea class="job-tasks" rows="3" placeholder="One per line, e.g.&#10;Complete pruning on a magnolia tree&#10;Remove a bottlebrush tree and grind the stump"></textarea>
      <label class="job-card__price">Price for this job
        <input type="number" class="job-price" placeholder="0.00" min="0" step="0.01">
      </label>
    `;
    card.querySelector(".job-date").value = job.date || "";
    card.querySelector(".job-end-date").value = job.endDate || "";
    card.querySelector(".job-address").value = job.address || "";
    card.querySelector(".job-tasks").value = (job.tasks || []).join("\n");
    card.querySelector(".job-price").value = job.price ?? "";
    card.querySelector(".remove-job").addEventListener("click", () => {
      if (jobsEl.children.length > 1) card.remove();
      updatePreview();
    });
    card.querySelectorAll("input, textarea").forEach((el) => el.addEventListener("input", updatePreview));
    return card;
  }

  function renumberJobs() {
    $$(".job-card", jobsEl).forEach((card, i) => {
      card.querySelector(".job-card__title").textContent = `Job ${i + 1}`;
    });
  }

  // Parse "YYYY-MM-DD" as a local date (new Date("2026-09-23") is UTC and
  // can show as the previous day here).
  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatJobDate(date, endDate) {
    if (!date) return "";
    const start = parseDate(date);
    const full = { year: "numeric", month: "short", day: "numeric" };
    if (!endDate || endDate <= date) return start.toLocaleDateString(undefined, full);
    const end = parseDate(endDate);
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString(undefined, { month: "short" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(undefined, full)} – ${end.toLocaleDateString(undefined, full)}`;
  }

  function getFormState() {
    const docType = $('input[name="docType"]:checked').value;
    const jobs = $$(".job-card", jobsEl).map((card) => ({
      date: card.querySelector(".job-date").value,
      endDate: card.querySelector(".job-end-date").value,
      address: card.querySelector(".job-address").value.trim(),
      tasks: card.querySelector(".job-tasks").value.split("\n").map((t) => t.trim()).filter(Boolean),
      price: parseFloat(card.querySelector(".job-price").value) || 0,
    }));
    return {
      docType,
      clientName: $("#client-name").value.trim(),
      clientAddress: $("#client-address").value.trim(),
      clientEmail: $("#client-email").value.trim(),
      clientPhone: $("#client-phone").value.trim(),
      jobs,
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

    const tbody = $("#preview-jobs");
    tbody.innerHTML = "";
    let total = 0;
    const jobs = state.jobs.filter((j) => j.tasks.length);
    if (jobs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">No jobs added yet</td></tr>`;
    } else {
      jobs.forEach((job) => {
        total += job.price;
        const heading = [formatJobDate(job.date, job.endDate), job.address].filter(Boolean).join(" · ");
        const tr = document.createElement("tr");
        tr.className = "job-row";
        tr.innerHTML = `
          <td>
            ${heading ? `<div class="job-row__head">${escapeHtml(heading)}</div>` : ""}
            <ul class="job-row__tasks">${job.tasks.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
          </td>
          <td>${money(job.price)}</td>`;
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
    renumberJobs();
    renderPreview(getFormState());
  }

  const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  function proposalLink(doc) {
    return `${location.origin}/proposal.html?t=${encodeURIComponent(doc.share_token)}`;
  }

  // Proposals: approval status from the client's link, plus a button to
  // share the link and, once approved, to turn it into an invoice.
  function proposalStatusCell(doc) {
    if (!doc.share_token) {
      return `<button type="button" class="link-btn" data-action="share">Create link</button>`;
    }
    let pill;
    if (doc.approved_at) {
      pill = `<span class="status-pill status-pill--approved" title="Approved by ${escapeHtml(doc.approved_name || "")} on ${shortDate(doc.approved_at)}">Approved</span>`;
    } else if (doc.viewed_at) {
      pill = `<span class="status-pill status-pill--viewed" title="Opened ${shortDate(doc.viewed_at)}">Viewed</span>`;
    } else {
      pill = `<span class="status-pill">Not opened</span>`;
    }
    const action = doc.approved_at
      ? `<button type="button" class="link-btn" data-action="to-invoice">Make invoice</button>`
      : `<button type="button" class="link-btn" data-action="copy">Send link</button>`;
    return `${pill} ${action}`;
  }

  function statusCell(doc) {
    if (doc.type === "proposal") return proposalStatusCell(doc);
    return doc.paid_at
      ? `<button type="button" class="status-btn status-btn--paid" data-action="unpay" title="Click to mark unpaid">Paid</button>`
      : `<button type="button" class="status-btn status-btn--unpaid" data-action="pay" title="Click to mark paid">Unpaid</button>`;
  }

  function historyRowHtml(doc) {
    const date = new Date(doc.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    return `
      <td>${doc.number}</td>
      <td>${doc.type === "proposal" ? "Proposal" : "Invoice"}</td>
      <td>${escapeHtml(doc.client_name)}</td>
      <td>${money(doc.total)}</td>
      <td>${date}</td>
      <td>${statusCell(doc)}</td>
      <td><button type="button" class="delete-btn" data-action="delete" aria-label="Delete ${doc.type} #${doc.number}" title="Delete"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></td>
    `;
  }

  function addHistoryRow(doc) {
    if (historyBody.dataset.empty === "true") {
      historyBody.innerHTML = "";
      historyBody.dataset.empty = "false";
    }
    const tr = document.createElement("tr");
    tr.dataset.id = doc.id;
    tr.innerHTML = historyRowHtml(doc);
    historyBody.prepend(tr);
  }

  // Text/email the approval link: the phone's share sheet when available,
  // otherwise copy to the clipboard (or show it to copy by hand).
  async function shareLink(doc, btn) {
    const url = proposalLink(doc);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Proposal #${doc.number} from Tino's Tree Service`,
          text: `Hi ${doc.client_name}, here is your proposal from Tino's Tree Service. You can review and approve it here:`,
          url,
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      const original = btn.textContent;
      btn.textContent = "Link copied!";
      setTimeout(() => { btn.textContent = original; }, 2000);
    } catch {
      prompt("Copy this link and send it to the client:", url);
    }
  }

  // Fill the form from a past document (e.g. an approved proposal -> invoice).
  function loadIntoForm(doc, docType) {
    $(`input[name="docType"][value="${docType}"]`).checked = true;
    $("#client-name").value = doc.client_name || "";
    $("#client-address").value = doc.client_address || "";
    $("#client-email").value = doc.client_email || "";
    $("#client-phone").value = doc.client_phone || "";
    jobsEl.innerHTML = "";
    const jobs = Array.isArray(doc.line_items) && doc.line_items.length ? doc.line_items : [{}];
    jobs.forEach((job) => jobsEl.appendChild(jobCard({
      date: job.date || "",
      endDate: job.endDate || "",
      address: job.address || "",
      tasks: job.tasks || [],
      price: job.price,
    })));
    updatePreview();
    $(".doc-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  historyBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const doc = allDocuments.find((d) => d.id === tr.dataset.id);
    if (!doc) return;
    const action = btn.dataset.action;
    const label = `${doc.type === "proposal" ? "proposal" : "invoice"} #${doc.number} for ${doc.client_name}`;

    if (action === "copy") {
      shareLink(doc, btn);
      return;
    }
    if (action === "to-invoice") {
      loadIntoForm(doc, "invoice");
      return;
    }

    if (action === "delete" && !confirm(`Delete ${label}? This can't be undone.`)) return;

    btn.disabled = true;
    try {
      const res = await fetch(`/api/admin/documents?id=${encodeURIComponent(doc.id)}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined
          : JSON.stringify(action === "share" ? { share: true } : { paid: action === "pay" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "server error");
      }
      if (action === "delete") {
        allDocuments = allDocuments.filter((d) => d.id !== doc.id);
        tr.remove();
        if (allDocuments.length === 0) renderHistory([]);
      } else {
        const updated = (await res.json()).document;
        Object.assign(doc, updated);
        tr.innerHTML = historyRowHtml(doc);
      }
    } catch (err) {
      alert(`Could not update ${label}: ${err.message}`);
      btn.disabled = false;
    }
  });

  function renderHistory(documents) {
    if (!documents || documents.length === 0) {
      historyBody.dataset.empty = "true";
      historyBody.innerHTML = `<tr><td colspan="7" class="muted">No documents yet.</td></tr>`;
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
      historyBody.innerHTML = `<tr><td colspan="7" class="form-error">Could not load history: ${escapeHtml(err.error || "server error")}</td></tr>`;
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

  addJobBtn.addEventListener("click", () => {
    const card = jobCard();
    jobsEl.appendChild(card);
    updatePreview();
    card.querySelector(".job-date").focus();
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
    state.jobs = state.jobs.filter((j) => j.tasks.length);

    if (!state.clientName || state.jobs.length === 0) {
      formError.textContent = "Please enter a client name and at least one job with work listed.";
      formError.classList.remove("hidden");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";

    try {
      // Save to the database for a number + history. If the database is
      // unreachable (e.g. paused), still produce the PDF without a number.
      let doc = null;
      let saveError = null;
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
        doc = (await res.json()).document;
      } catch (err) {
        saveError = err;
      }

      let filename;
      if (doc) {
        renderPreview(state, doc);
        addHistoryRow(doc);
        allDocuments.unshift(doc);
        filename = `${doc.type}-${doc.number}.pdf`;
      } else {
        renderPreview(state, null);
        const safeName = state.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        filename = `${state.docType}-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
      }
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

      if (saveError) {
        formError.textContent = `PDF downloaded, but it was not saved to History (no number assigned): ${saveError.message}`;
        formError.classList.remove("hidden");
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
  jobsEl.appendChild(jobCard());
  updatePreview();
  checkSession();
})();
