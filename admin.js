import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  auth,
  db,
  getTanggalServer,
  isFirebaseConfigured,
  leadsCollectionName,
} from "./firebase.js";

const ADMIN_ROLE = "admin";
const CS_COLLECTION = "cs";
const PRODUCTS_COLLECTION = "products";
const SETTINGS_COLLECTION = "settings";
const TRACKING_DOC_ID = "tracking";
const USERS_COLLECTION = "users";

const adminAuthView = document.querySelector("#adminAuthView");
const adminView = document.querySelector("#adminView");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminEmailInput = document.querySelector("#adminEmail");
const adminPasswordInput = document.querySelector("#adminPassword");
const adminAuthMessage = document.querySelector("#adminAuthMessage");
const adminLoginButton = document.querySelector("#adminLoginButton");
const adminLoginButtonText = adminLoginButton.querySelector(".button-text");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const adminUserEmail = document.querySelector("#adminUserEmail");

const productForm = document.querySelector("#productForm");
const productEditId = document.querySelector("#productEditId");
const productName = document.querySelector("#productName");
const productCsSelect = document.querySelector("#productCsSelect");
const productMessage = document.querySelector("#productMessage");
const resetProductButton = document.querySelector("#resetProductButton");
const productsTableBody = document.querySelector("#productsTableBody");
const productsEmptyState = document.querySelector("#productsEmptyState");

const csForm = document.querySelector("#csForm");
const csEditId = document.querySelector("#csEditId");
const csName = document.querySelector("#csName");
const csWhatsapp = document.querySelector("#csWhatsapp");
const csEmail = document.querySelector("#csEmail");
const csMessage = document.querySelector("#csMessage");
const resetCsButton = document.querySelector("#resetCsButton");
const csTableBody = document.querySelector("#csTableBody");
const csEmptyState = document.querySelector("#csEmptyState");

const adminEmbedForm = document.querySelector("#adminEmbedForm");
const embedProductSelect = document.querySelector("#embedProductSelect");
const adminEmbedMessage = document.querySelector("#adminEmbedMessage");
const adminEmbedOutput = document.querySelector("#adminEmbedOutput");

const adminLeadsTableBody = document.querySelector("#adminLeadsTableBody");
const adminLeadsEmptyState = document.querySelector("#adminLeadsEmptyState");
const adminTotalLeads = document.querySelector("#adminTotalLeads");
const adminFollowUpLeads = document.querySelector("#adminFollowUpLeads");
const adminClosingLeads = document.querySelector("#adminClosingLeads");
const trackingForm = document.querySelector("#trackingForm");
const trackingGtmId = document.querySelector("#trackingGtmId");
const trackingGoogleAdsId = document.querySelector("#trackingGoogleAdsId");
const trackingConversionLabel = document.querySelector("#trackingConversionLabel");
const trackingMessage = document.querySelector("#trackingMessage");
const gtmStatus = document.querySelector("#gtmStatus");
const saveTrackingButton = document.querySelector("#saveTrackingButton");
const testGtmButton = document.querySelector("#testGtmButton");

let csList = [];
let productList = [];
let unsubscribeCs = null;
let unsubscribeProducts = null;
let unsubscribeLeads = null;
let unsubscribeTracking = null;

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `form-message is-visible is-${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "form-message";
}

function setLoginLoading(isLoading) {
  adminLoginButton.disabled = isLoading;
  adminLoginButton.classList.toggle("is-loading", isLoading);
  adminLoginButtonText.textContent = isLoading ? "Memproses..." : "Login";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

function getDateValue(item) {
  const value = item.tanggal || item.createdAt;

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

function getStatusLabel(status) {
  const labels = {
    new: "New",
    follow_up: "Follow Up",
    closing: "Closing",
    cancel: "Cancel",
  };

  return labels[status] || "New";
}

function getStatusClass(status) {
  return ["new", "follow_up", "closing", "cancel"].includes(status) ? status : "new";
}

function createStatusChip(status) {
  const chip = document.createElement("span");
  chip.className = `status-chip status-${getStatusClass(status)}`;
  chip.textContent = getStatusLabel(status);
  return chip;
}

function createTableButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `table-action ${className}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function setAdminVisibility(isVisible, email = "") {
  adminAuthView.hidden = isVisible;
  adminView.hidden = !isVisible;
  adminUserEmail.textContent = email ? `Login sebagai ${email}` : "";
}

async function getUserRole(user) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, user.uid));
  return userSnapshot.data()?.role || "";
}

function cleanupListeners() {
  [unsubscribeCs, unsubscribeProducts, unsubscribeLeads, unsubscribeTracking].forEach((unsubscribe) => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  unsubscribeCs = null;
  unsubscribeProducts = null;
  unsubscribeLeads = null;
  unsubscribeTracking = null;
}

function pushGtmEvent(eventData) {
  if (typeof window.pushGtmEvent === "function") {
    window.pushGtmEvent(eventData);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventData);
}

function getCsById(csId) {
  return csList.find((cs) => cs.id === csId) || null;
}

function getProductById(productId) {
  return productList.find((product) => product.id === productId) || null;
}

function populateProductCsSelect() {
  productCsSelect.innerHTML = "";

  if (csList.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Tambahkan CS terlebih dahulu";
    productCsSelect.append(option);
    return;
  }

  csList.forEach((cs) => {
    const option = document.createElement("option");
    option.value = cs.id;
    option.textContent = `${cs.nama} - ${cs.wa}`;
    productCsSelect.append(option);
  });
}

function populateEmbedProductSelect() {
  embedProductSelect.innerHTML = "";

  if (productList.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Tambahkan produk terlebih dahulu";
    embedProductSelect.append(option);
    return;
  }

  productList.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.nama} - ${product.csNama || "CS belum dipilih"}`;
    embedProductSelect.append(option);
  });
}

function setTrackingStatus(gtmId) {
  const hasGtmId = Boolean(String(gtmId || "").trim());

  gtmStatus.textContent = hasGtmId ? "🟢 GTM Aktif" : "🔴 GTM Belum diisi";
  gtmStatus.classList.toggle("tracking-active", hasGtmId);
  gtmStatus.classList.toggle("tracking-inactive", !hasGtmId);
}

function renderTrackingForm(tracking = {}) {
  trackingGtmId.value = tracking.gtmId || "";
  trackingGoogleAdsId.value = tracking.googleAdsId || "";
  trackingConversionLabel.value = tracking.conversionLabel || "";
  setTrackingStatus(tracking.gtmId);
}

function getEmbedUrl(productId) {
  const embedUrl = new URL("./embed.html", window.location.href);
  embedUrl.search = new URLSearchParams({ productId }).toString();
  return embedUrl.href;
}

function buildEmbedCode(productId) {
  return `<iframe
src="${getEmbedUrl(productId)}"
width="100%"
height="650"
style="border:none;">
</iframe>`;
}

function renderCsTable() {
  csTableBody.innerHTML = "";
  csEmptyState.hidden = csList.length > 0;

  csList.forEach((cs) => {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.dataset.label = "CS ID";
    idCell.textContent = cs.id;

    const nameCell = document.createElement("td");
    nameCell.dataset.label = "Nama";
    nameCell.textContent = cs.nama || "-";

    const waCell = document.createElement("td");
    waCell.dataset.label = "WhatsApp";
    waCell.textContent = cs.wa || "-";

    const emailCell = document.createElement("td");
    emailCell.dataset.label = "Email";
    emailCell.textContent = cs.email || "-";

    const actionCell = document.createElement("td");
    actionCell.dataset.label = "Aksi";
    const actionRow = document.createElement("div");
    actionRow.className = "action-row";
    actionRow.append(
      createTableButton("Edit", "action-follow", () => editCs(cs)),
      createTableButton("Hapus", "action-cancel", () => deleteCs(cs))
    );
    actionCell.append(actionRow);

    row.append(idCell, nameCell, waCell, emailCell, actionCell);
    csTableBody.append(row);
  });
}

function renderProductsTable() {
  productsTableBody.innerHTML = "";
  productsEmptyState.hidden = productList.length > 0;

  productList.forEach((product) => {
    const row = document.createElement("tr");

    const productCell = document.createElement("td");
    productCell.dataset.label = "Produk";
    productCell.textContent = product.nama || "-";

    const csCell = document.createElement("td");
    csCell.dataset.label = "CS";
    csCell.textContent = product.csNama
      ? `${product.csNama}${product.csWhatsapp ? ` (${product.csWhatsapp})` : ""}`
      : "-";

    const embedCell = document.createElement("td");
    embedCell.dataset.label = "Embed";
    const embedButton = createTableButton("Generate", "action-closing", () => {
      embedProductSelect.value = product.id;
      adminEmbedOutput.value = buildEmbedCode(product.id);
      showMessage(adminEmbedMessage, "Kode embed produk berhasil dibuat.", "success");
    });
    embedCell.append(embedButton);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = "Aksi";
    const actionRow = document.createElement("div");
    actionRow.className = "action-row";
    actionRow.append(
      createTableButton("Edit", "action-follow", () => editProduct(product)),
      createTableButton("Hapus", "action-cancel", () => deleteProduct(product))
    );
    actionCell.append(actionRow);

    row.append(productCell, csCell, embedCell, actionCell);
    productsTableBody.append(row);
  });
}

function updateLeadStats(leads) {
  adminTotalLeads.textContent = leads.length;
  adminFollowUpLeads.textContent = leads.filter((lead) => lead.status === "follow_up").length;
  adminClosingLeads.textContent = leads.filter((lead) => lead.status === "closing").length;
}

function renderLeadsTable(leads) {
  adminLeadsTableBody.innerHTML = "";
  adminLeadsEmptyState.hidden = leads.length > 0;
  updateLeadStats(leads);

  leads.forEach((lead) => {
    const row = document.createElement("tr");

    const productCell = document.createElement("td");
    productCell.dataset.label = "Produk";
    productCell.textContent = lead.productNama || lead.productName || "-";

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
      ? `${lead.csNama}${lead.csWhatsapp || lead.csWa ? ` (${lead.csWhatsapp || lead.csWa})` : ""}`
      : "-";

    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Status";
    statusCell.append(createStatusChip(lead.status));

    row.append(productCell, nameCell, whatsappCell, dateCell, csCell, statusCell);
    adminLeadsTableBody.append(row);
  });
}

function listenToAdminData() {
  cleanupListeners();

  unsubscribeTracking = onSnapshot(doc(db, SETTINGS_COLLECTION, TRACKING_DOC_ID), (snapshot) => {
    renderTrackingForm(snapshot.exists() ? snapshot.data() : {});
  });

  unsubscribeCs = onSnapshot(collection(db, CS_COLLECTION), (snapshot) => {
    csList = snapshot.docs
      .map((csDoc) => ({ id: csDoc.id, ...csDoc.data() }))
      .sort((csA, csB) => String(csA.nama || "").localeCompare(String(csB.nama || "")));

    populateProductCsSelect();
    renderCsTable();
    renderProductsTable();
    populateEmbedProductSelect();
  });

  unsubscribeProducts = onSnapshot(collection(db, PRODUCTS_COLLECTION), (snapshot) => {
    productList = snapshot.docs
      .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
      .sort((productA, productB) =>
        String(productA.nama || "").localeCompare(String(productB.nama || ""))
      );

    renderProductsTable();
    populateEmbedProductSelect();
  });

  unsubscribeLeads = onSnapshot(collection(db, leadsCollectionName), (snapshot) => {
    const leads = snapshot.docs
      .map((leadDoc) => ({ id: leadDoc.id, ...leadDoc.data() }))
      .sort((leadA, leadB) => getDateValue(leadB) - getDateValue(leadA));

    renderLeadsTable(leads);
  });
}

function resetProductForm() {
  productForm.reset();
  productEditId.value = "";
  clearMessage(productMessage);
}

function resetCsForm() {
  csForm.reset();
  csEditId.value = "";
  clearMessage(csMessage);
}

function editProduct(product) {
  productEditId.value = product.id;
  productName.value = product.nama || "";
  productCsSelect.value = product.csId || "";
  clearMessage(productMessage);
  productName.focus();
}

async function deleteProduct(product) {
  if (!window.confirm(`Hapus produk ${product.nama || "ini"}?`)) {
    return;
  }

  await deleteDoc(doc(db, PRODUCTS_COLLECTION, product.id));
  showMessage(productMessage, "Produk berhasil dihapus.", "success");
}

function editCs(cs) {
  csEditId.value = cs.id;
  csName.value = cs.nama || "";
  csWhatsapp.value = cs.wa || "";
  csEmail.value = cs.email || "";
  clearMessage(csMessage);
  csName.focus();
}

async function deleteCs(cs) {
  if (!window.confirm(`Hapus CS ${cs.nama || "ini"}?`)) {
    return;
  }

  await deleteDoc(doc(db, CS_COLLECTION, cs.id));
  showMessage(csMessage, "CS berhasil dihapus.", "success");
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(adminAuthMessage);

  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email || !password) {
    showMessage(adminAuthMessage, "Email dan password wajib diisi.");
    return;
  }

  if (!isFirebaseConfigured) {
    showMessage(adminAuthMessage, "Konfigurasi Firebase belum lengkap.");
    return;
  }

  setLoginLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    adminLoginForm.reset();
  } catch (error) {
    console.error("Gagal login admin:", error);
    showMessage(adminAuthMessage, "Login gagal. Periksa email dan password.");
  } finally {
    setLoginLoading(false);
  }
});

adminLogoutButton.addEventListener("click", async () => {
  cleanupListeners();
  await signOut(auth);
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(productMessage);

  const nama = productName.value.trim();
  const selectedCs = getCsById(productCsSelect.value);

  if (!nama || !selectedCs) {
    showMessage(productMessage, "Nama produk dan CS wajib diisi.");
    return;
  }

  const payload = {
    nama,
    csId: selectedCs.id,
    csNama: selectedCs.nama,
    csWhatsapp: selectedCs.wa,
    csWa: selectedCs.wa,
    csEmail: normalizeEmail(selectedCs.email),
    updatedAt: getTanggalServer(),
  };

  if (productEditId.value) {
    await updateDoc(doc(db, PRODUCTS_COLLECTION, productEditId.value), payload);
    showMessage(productMessage, "Produk berhasil diperbarui.", "success");
  } else {
    await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...payload,
      createdAt: getTanggalServer(),
    });
    showMessage(productMessage, "Produk berhasil ditambahkan.", "success");
  }

  resetProductForm();
});

csForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(csMessage);

  const nama = csName.value.trim();
  const wa = normalizeWhatsapp(csWhatsapp.value);
  const email = normalizeEmail(csEmail.value);

  if (!nama || !wa || !email) {
    showMessage(csMessage, "Nama, WhatsApp, dan email CS wajib diisi.");
    return;
  }

  const payload = {
    nama,
    wa,
    email,
    updatedAt: getTanggalServer(),
  };

  if (csEditId.value) {
    await updateDoc(doc(db, CS_COLLECTION, csEditId.value), payload);
    showMessage(csMessage, "CS berhasil diperbarui.", "success");
  } else {
    const csRef = doc(collection(db, CS_COLLECTION));
    await setDoc(csRef, {
      ...payload,
      createdAt: getTanggalServer(),
    });
    showMessage(csMessage, "CS berhasil ditambahkan.", "success");
  }

  resetCsForm();
});

adminEmbedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessage(adminEmbedMessage);

  const selectedProduct = getProductById(embedProductSelect.value);

  if (!selectedProduct) {
    showMessage(adminEmbedMessage, "Pilih produk terlebih dahulu.");
    return;
  }

  adminEmbedOutput.value = buildEmbedCode(selectedProduct.id);
  showMessage(adminEmbedMessage, "Kode embed berhasil dibuat.", "success");
});

trackingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(trackingMessage);
  saveTrackingButton.disabled = true;

  const payload = {
    gtmId: trackingGtmId.value.trim(),
    googleAdsId: trackingGoogleAdsId.value.trim(),
    conversionLabel: trackingConversionLabel.value.trim(),
  };

  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, TRACKING_DOC_ID), payload, { merge: true });

    if (typeof window.applyTrackingSettings === "function") {
      window.applyTrackingSettings(payload);
    }

    showMessage(trackingMessage, "Tracking berhasil disimpan.", "success");
    setTrackingStatus(payload.gtmId);
  } catch (error) {
    console.error("Gagal menyimpan tracking:", error);
    showMessage(trackingMessage, "Tracking belum berhasil disimpan. Coba lagi.");
  } finally {
    saveTrackingButton.disabled = false;
  }
});

testGtmButton.addEventListener("click", () => {
  pushGtmEvent({
    event: "gtm_test",
  });
  showMessage(trackingMessage, "Event gtm_test dikirim ke dataLayer.", "success");
});

resetProductButton.addEventListener("click", resetProductForm);
resetCsButton.addEventListener("click", resetCsForm);

onAuthStateChanged(auth, async (user) => {
  cleanupListeners();

  if (!user) {
    setAdminVisibility(false);
    return;
  }

  try {
    const role = await getUserRole(user);

    if (role !== ADMIN_ROLE) {
      await signOut(auth);
      setAdminVisibility(false);
      showMessage(adminAuthMessage, "Akses ditolak. Akun ini bukan admin.");
      return;
    }

    setAdminVisibility(true, user.email || "");
    listenToAdminData();
  } catch (error) {
    console.error("Gagal memeriksa role admin:", error);
    await signOut(auth);
    setAdminVisibility(false);
    showMessage(adminAuthMessage, "Gagal memeriksa akses admin.");
  }
});
