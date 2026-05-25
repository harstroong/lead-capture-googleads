import {
  addDoc,
  collection,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { findCsById } from "./cs.js";
import {
  db,
  getTanggalServer,
  isFirebaseConfigured,
  leadsCollectionName,
} from "./firebase.js";

const STATUS_BARU = "new";
const PRODUCTS_COLLECTION = "products";

const form = document.querySelector("#embedLeadForm");
const namaInput = document.querySelector("#nama");
const whatsappInput = document.querySelector("#whatsapp");
const submitButton = document.querySelector("#submitButton");
const buttonText = submitButton.querySelector(".button-text");
const formMessage = document.querySelector("#formMessage");

const trackingParams = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "gclid",
];

const urlParams = new URLSearchParams(window.location.search);
let selectedAssignment = null;

function getTrackingData() {
  return trackingParams.reduce((data, param) => {
    data[param] = urlParams.get(param) || "";
    return data;
  }, {});
}

function getProductId() {
  return urlParams.get("productId") || "";
}

function pushGtmEvent(eventData) {
  if (typeof window.pushGtmEvent === "function") {
    window.pushGtmEvent(eventData);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventData);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  buttonText.textContent = isLoading ? "Memproses..." : "Beli Sekarang";
}

function showMessage(message, type = "error") {
  formMessage.textContent = message;
  formMessage.className = `form-message is-visible is-${type}`;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function setFieldError(input, hasError) {
  input.classList.toggle("input-error", hasError);
  input.setAttribute("aria-invalid", hasError ? "true" : "false");
}

function validateForm() {
  const nama = namaInput.value.trim();
  const whatsapp = whatsappInput.value.trim();
  const isNamaEmpty = nama.length === 0;
  const isWhatsappEmpty = whatsapp.length === 0;

  setFieldError(namaInput, isNamaEmpty);
  setFieldError(whatsappInput, isWhatsappEmpty);

  if (isNamaEmpty || isWhatsappEmpty) {
    return {
      isValid: false,
      message: "Nama dan No WhatsApp wajib diisi.",
    };
  }

  return {
    isValid: true,
    data: { nama, whatsapp },
  };
}

function buildLeadPayload(formData) {
  return {
    nama: formData.nama,
    whatsapp: formData.whatsapp,
    tanggal: getTanggalServer(),
    ...getTrackingData(),
    productId: selectedAssignment.productId || "",
    productNama: selectedAssignment.productNama || "",
    csId: selectedAssignment.csId,
    csNama: selectedAssignment.csNama,
    csWa: selectedAssignment.csWhatsapp,
    csWhatsapp: selectedAssignment.csWhatsapp,
    csEmail: selectedAssignment.csEmail,
    status: STATUS_BARU,
  };
}

function redirectToAssignedCs() {
  const whatsappUrl = `https://wa.me/${selectedAssignment.csWhatsapp}`;

  pushGtmEvent({
    event: "whatsapp_click",
    csId: selectedAssignment.csId,
    productId: selectedAssignment.productId || getProductId(),
  });

  try {
    window.top.location.href = whatsappUrl;
  } catch (error) {
    window.location.href = whatsappUrl;
  }
}

async function loadProductAssignment(productId) {
  const productSnapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId));

  if (!productSnapshot.exists()) {
    return null;
  }

  const product = productSnapshot.data();

  if (!product.csId || !product.csNama || !product.csWhatsapp) {
    return null;
  }

  return {
    productId: productSnapshot.id,
    productNama: product.nama || "",
    csId: product.csId,
    csNama: product.csNama,
    csWhatsapp: product.csWhatsapp,
    csEmail: String(product.csEmail || "").toLowerCase(),
  };
}

function loadStaticCsAssignment(csId) {
  const selectedCs = findCsById(csId);

  if (!selectedCs) {
    return null;
  }

  return {
    productId: "",
    productNama: "",
    csId: selectedCs.id,
    csNama: selectedCs.nama,
    csWhatsapp: selectedCs.wa,
    csEmail: selectedCs.email.toLowerCase(),
  };
}

async function initializeEmbedForm() {
  const productId = urlParams.get("productId");
  const csId = urlParams.get("csId");

  setLoading(true);

  try {
    selectedAssignment = productId
      ? await loadProductAssignment(productId)
      : loadStaticCsAssignment(csId);

    if (!selectedAssignment) {
      showMessage("Form belum terhubung ke produk atau CS. Periksa kembali kode embed.");
      setLoading(false);
      submitButton.disabled = true;
      return;
    }

    clearMessage();
  } catch (error) {
    console.error("Gagal memuat konfigurasi embed:", error);
    showMessage("Gagal memuat konfigurasi form embed.");
    setLoading(false);
    submitButton.disabled = true;
  } finally {
    if (selectedAssignment) {
      setLoading(false);
    }
  }
}

namaInput.addEventListener("input", () => {
  setFieldError(namaInput, false);
  clearMessage();
});

whatsappInput.addEventListener("input", () => {
  setFieldError(whatsappInput, false);
  clearMessage();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!selectedAssignment) {
    showMessage("Form belum terhubung ke produk atau CS. Periksa kembali kode embed.");
    return;
  }

  const validation = validateForm();

  if (!validation.isValid) {
    showMessage(validation.message);
    return;
  }

  if (!isFirebaseConfigured) {
    showMessage("Konfigurasi Firebase belum lengkap.");
    return;
  }

  pushGtmEvent({
    event: "lead_submit",
    nama: validation.data.nama,
    whatsapp: validation.data.whatsapp,
    productId: selectedAssignment.productId || getProductId(),
  });

  setLoading(true);

  try {
    await addDoc(collection(db, leadsCollectionName), buildLeadPayload(validation.data));
    showMessage("Data berhasil disimpan. Mengarahkan ke WhatsApp...", "success");
    redirectToAssignedCs();
  } catch (error) {
    console.error("Gagal menyimpan lead embed:", error);
    showMessage("Maaf, data belum berhasil disimpan. Silakan coba lagi.");
    setLoading(false);
  }
});

initializeEmbedForm();
