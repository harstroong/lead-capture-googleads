import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { CS_LIST, findCsById, normalizeEmail } from "./cs.js";
import { auth, db, isFirebaseConfigured, leadsCollectionName } from "./firebase.js";

const ADMIN_ROLE = "admin";
const CS_ROLE = "cs";
const USERS_COLLECTION = "users";

const statusLabels = {
  new: "New",
  follow_up: "Follow Up",
  closing: "Closing",
  cancel: "Cancel",
};

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const authMessage = document.querySelector("#authMessage");
const loginButton = document.querySelector("#loginButton");
const loginButtonText = loginButton.querySelector(".button-text");
const logoutButton = document.querySelector("#logoutButton");
const generatorMenuButton = document.querySelector("#generatorMenuButton");
const formGeneratorPanel = document.querySelector("#formGeneratorPanel");
const formGeneratorForm = document.querySelector("#formGeneratorForm");
const formNameInput = document.querySelector("#formName");
const generatorCsSelect = document.querySelector("#generatorCsSelect");
const generatorWhatsappSelect = document.querySelector("#generatorWhatsappSelect");
const generatorMessage = document.querySelector("#generatorMessage");
const embedCodeOutput = document.querySelector("#embedCodeOutput");
const userEmail = document.querySelector("#userEmail");
const dashboardMessage = document.querySelector("#dashboardMessage");
const leadsTableBody = document.querySelector("#leadsTableBody");
const emptyState = document.querySelector("#emptyState");
const totalLeads = document.querySelector("#totalLeads");
const followUpLeads = document.querySelector("#followUpLeads");
const closingLeads = document.querySelector("#closingLeads");
const cancelLeads = document.querySelector("#cancelLeads");

let unsubscribeLeads = null;
let currentUserProfile = null;

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `form-message is-visible is-${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "form-message";
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.classList.toggle("is-loading", isLoading);
  loginButtonText.textContent = isLoading ? "Memproses..." : "Login";
}

function formatFirebaseDate(value) {
  if (!value) {
    return "-";
  }

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

function getLeadCsWhatsapp(lead) {
  return lead.csWhatsapp || lead.csWa || "";
}

function getWhatsAppUrl(lead) {
  const whatsapp = lead.whatsapp;
  const normalizedNumber = normalizeWhatsAppNumber(whatsapp);
  const assignedCsName = lead.csNama || "CS";
  const assignedCsWa = getLeadCsWhatsapp(lead) ? ` (${getLeadCsWhatsapp(lead)})` : "";
  const message = `Halo ${lead.nama || ""}, saya ${assignedCsName}${assignedCsWa}. Saya ingin follow up pesanan Anda.`;

  return normalizedNumber
    ? `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`
    : "";
}

function pushGtmEvent(eventData) {
  if (typeof window.pushGtmEvent === "function") {
    window.pushGtmEvent(eventData);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventData);
}

function getDateValue(lead) {
  const value = lead.tanggal;

  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function getUserProfile(user) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, user.uid));
  return userSnapshot.data() || {};
}

function setDashboardVisibility(user, profile = null) {
  const isLoggedIn = Boolean(user);
  const currentUserEmail = normalizeEmail(user?.email);
  const role = profile?.role || "";
  const accessText =
    role === ADMIN_ROLE
      ? "Admin melihat semua lead"
      : role === CS_ROLE && profile?.csId
        ? `Menampilkan lead untuk ${profile.csNama || profile.csId}`
        : "Akun belum punya akses dashboard CS";

  authView.hidden = isLoggedIn;
  dashboardView.hidden = !isLoggedIn;
  generatorMenuButton.hidden = role !== ADMIN_ROLE;
  formGeneratorPanel.hidden = true;
  userEmail.textContent = currentUserEmail
    ? `Login sebagai ${currentUserEmail} - ${accessText}`
    : "";
}

function populateGeneratorOptions() {
  generatorCsSelect.innerHTML = "";
  generatorWhatsappSelect.innerHTML = "";

  CS_LIST.forEach((cs) => {
    const csOption = document.createElement("option");
    csOption.value = cs.id;
    csOption.textContent = cs.nama;
    generatorCsSelect.append(csOption);

    const waOption = document.createElement("option");
    waOption.value = cs.wa;
    waOption.textContent = `${cs.nama} - ${cs.wa}`;
    waOption.dataset.csId = cs.id;
    generatorWhatsappSelect.append(waOption);
  });

  syncWhatsappSelectWithCs();
}

function syncWhatsappSelectWithCs() {
  const selectedCs = findCsById(generatorCsSelect.value);
  generatorWhatsappSelect.value = selectedCs?.wa || "";
}

function syncCsSelectWithWhatsapp() {
  const selectedOption = generatorWhatsappSelect.selectedOptions[0];
  const selectedCsId = selectedOption?.dataset.csId || "";

  if (selectedCsId) {
    generatorCsSelect.value = selectedCsId;
  }
}

function getEmbedUrl(csId) {
  const embedUrl = new URL("./embed.html", window.location.href);
  embedUrl.search = new URLSearchParams({ csId }).toString();
  return embedUrl.href;
}

function buildEmbedCode(csId) {
  return `<iframe
src="${getEmbedUrl(csId)}"
width="100%"
height="650"
style="border:none;">
</iframe>`;
}

function updateStats(leads) {
  totalLeads.textContent = leads.length;
  followUpLeads.textContent = leads.filter((lead) => lead.status === "follow_up").length;
  closingLeads.textContent = leads.filter((lead) => lead.status === "closing").length;
  cancelLeads.textContent = leads.filter((lead) => lead.status === "cancel").length;
}

function createStatusChip(status) {
  const normalizedStatus = statusLabels[status] ? status : "new";
  const chip = document.createElement("span");
  chip.className = `status-chip status-${normalizedStatus}`;
  chip.textContent = statusLabels[normalizedStatus];
  return chip;
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `table-action ${className}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function updateLeadStatus(leadId, status, button) {
  const originalText = button.textContent;
  const actions = button.closest(".action-row")?.querySelectorAll("button") || [];

  actions.forEach((actionButton) => {
    actionButton.disabled = true;
  });
  button.textContent = "Proses...";
  clearMessage(dashboardMessage);

  try {
    await updateDoc(doc(db, leadsCollectionName, leadId), { status });
    showMessage(dashboardMessage, "Status lead berhasil diperbarui.", "success");
  } catch (error) {
    console.error("Gagal update status lead:", error);
    showMessage(dashboardMessage, "Gagal memperbarui status lead. Coba lagi.");
  } finally {
    actions.forEach((actionButton) => {
      actionButton.disabled = false;
    });
    button.textContent = originalText;
  }
}

function renderLeads(leads) {
  leadsTableBody.innerHTML = "";
  emptyState.hidden = leads.length > 0;
  updateStats(leads);

  leads.forEach((lead) => {
    const row = document.createElement("tr");
    const whatsappUrl = getWhatsAppUrl(lead);

    const nameCell = document.createElement("td");
    nameCell.dataset.label = "Nama";
    nameCell.textContent = lead.nama || "-";

    const whatsappCell = document.createElement("td");
    whatsappCell.dataset.label = "WhatsApp";
    whatsappCell.textContent = lead.whatsapp || "-";

    const dateCell = document.createElement("td");
    dateCell.dataset.label = "Tanggal";
    dateCell.textContent = formatFirebaseDate(lead.tanggal);

    const csCell = document.createElement("td");
    csCell.dataset.label = "CS";
    csCell.textContent = lead.csNama
      ? `${lead.csNama}${getLeadCsWhatsapp(lead) ? ` (${getLeadCsWhatsapp(lead)})` : ""}`
      : "-";

    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Status";
    statusCell.append(createStatusChip(lead.status));

    const actionsCell = document.createElement("td");
    actionsCell.dataset.label = "Aksi";

    const actionRow = document.createElement("div");
    actionRow.className = "action-row";

    const followUpButton = createActionButton("Follow Up", "action-follow", async (event) => {
      if (whatsappUrl) {
        pushGtmEvent({
          event: "whatsapp_click",
          csId: lead.csId || "",
          productId: lead.productId || "",
        });
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }

      await updateLeadStatus(lead.id, "follow_up", event.currentTarget);
    });

    const closingButton = createActionButton("Closing", "action-closing", (event) =>
      updateLeadStatus(lead.id, "closing", event.currentTarget)
    );

    const cancelButton = createActionButton("Cancel", "action-cancel", (event) =>
      updateLeadStatus(lead.id, "cancel", event.currentTarget)
    );

    followUpButton.disabled = !whatsappUrl;
    actionRow.append(followUpButton, closingButton, cancelButton);
    actionsCell.append(actionRow);

    row.append(nameCell, whatsappCell, dateCell, csCell, statusCell, actionsCell);
    leadsTableBody.append(row);
  });
}

function listenToLeads(user) {
  if (unsubscribeLeads) {
    unsubscribeLeads();
  }

  const currentUserEmail = normalizeEmail(user?.email);

  if (!currentUserEmail) {
    showMessage(dashboardMessage, "Email user login tidak ditemukan.");
    return;
  }

  if (currentUserProfile?.role !== ADMIN_ROLE && !currentUserProfile?.csId) {
    renderLeads([]);
    showMessage(dashboardMessage, "Akun ini belum punya csId.");
    return;
  }

  const leadsRef = collection(db, leadsCollectionName);
  const leadsQuery =
    currentUserProfile?.role === ADMIN_ROLE
      ? query(leadsRef)
      : query(leadsRef, where("csId", "==", currentUserProfile.csId));

  unsubscribeLeads = onSnapshot(
    leadsQuery,
    (snapshot) => {
      const leads = snapshot.docs
        .map((leadDoc) => ({
          id: leadDoc.id,
          ...leadDoc.data(),
        }))
        .sort((leadA, leadB) => getDateValue(leadB) - getDateValue(leadA));

      renderLeads(leads);
    },
    (error) => {
      console.error("Gagal mengambil data leads:", error);
      showMessage(dashboardMessage, "Gagal mengambil data leads dari Firebase.");
    }
  );
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(authMessage);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage(authMessage, "Email dan password wajib diisi.");
    return;
  }

  if (!isFirebaseConfigured) {
    showMessage(authMessage, "Konfigurasi Firebase belum lengkap.");
    return;
  }

  setLoginLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (error) {
    console.error("Gagal login:", error);
    showMessage(authMessage, "Login gagal. Periksa email dan password.");
  } finally {
    setLoginLoading(false);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Gagal logout:", error);
    showMessage(dashboardMessage, "Logout gagal. Coba lagi.");
  }
});

generatorMenuButton.addEventListener("click", () => {
  formGeneratorPanel.hidden = !formGeneratorPanel.hidden;

  if (!formGeneratorPanel.hidden) {
    formGeneratorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

generatorCsSelect.addEventListener("change", () => {
  syncWhatsappSelectWithCs();
  clearMessage(generatorMessage);
});

generatorWhatsappSelect.addEventListener("change", () => {
  syncCsSelectWithWhatsapp();
  clearMessage(generatorMessage);
});

formGeneratorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessage(generatorMessage);

  const formName = formNameInput.value.trim();
  const selectedCs = findCsById(generatorCsSelect.value);

  if (!formName || !selectedCs || generatorWhatsappSelect.value !== selectedCs.wa) {
    showMessage(generatorMessage, "Nama form, CS, dan nomor WhatsApp wajib dipilih.");
    return;
  }

  embedCodeOutput.value = buildEmbedCode(selectedCs.id);
  showMessage(generatorMessage, "Kode embed berhasil dibuat.", "success");
});

onAuthStateChanged(auth, async (user) => {
  currentUserProfile = null;

  if (user) {
    try {
      currentUserProfile = await getUserProfile(user);
    } catch (error) {
      console.error("Gagal memeriksa akses dashboard:", error);
      currentUserProfile = {};
      showMessage(dashboardMessage, "Gagal memeriksa akses dashboard.");
    }

    setDashboardVisibility(user, currentUserProfile);

    if (currentUserProfile.role === ADMIN_ROLE) {
      populateGeneratorOptions();
    }

    listenToLeads(user);
    return;
  }

  if (unsubscribeLeads) {
    unsubscribeLeads();
    unsubscribeLeads = null;
  }

  setDashboardVisibility(null);
  leadsTableBody.innerHTML = "";
  embedCodeOutput.value = "";
  formGeneratorForm.reset();
  updateStats([]);
});
