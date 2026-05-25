import {
  collection,
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { CS_LIST } from "./cs.js";
import {
  db,
  getTanggalServer,
  isFirebaseConfigured,
  leadsCollectionName,
} from "./firebase.js";

const REDIRECT_WHATSAPP_URL = "https://wa.me/6281234567890";
const STATUS_BARU = "new";
const ROTATION_COLLECTION = "settings";
const ROTATION_DOC_ID = "csRoundRobin";

const form = document.querySelector("#leadForm");
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

function getTrackingData() {
  const urlParams = new URLSearchParams(window.location.search);

  return trackingParams.reduce((data, param) => {
    data[param] = urlParams.get(param) || "";
    return data;
  }, {});
}

function getProductId() {
  return new URLSearchParams(window.location.search).get("productId") || "";
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

function buildLeadPayload(formData, assignedCs) {
  return {
    nama: formData.nama,
    whatsapp: formData.whatsapp,
    tanggal: getTanggalServer(),
    ...getTrackingData(),
    productId: getProductId(),
    csId: assignedCs.id,
    csNama: assignedCs.nama,
    csWa: assignedCs.wa,
    csWhatsapp: assignedCs.wa,
    csEmail: assignedCs.email.toLowerCase(),
    status: STATUS_BARU,
  };
}

async function saveLeadWithAssignedCs(formData) {
  const leadRef = doc(collection(db, leadsCollectionName));
  const rotationRef = doc(db, ROTATION_COLLECTION, ROTATION_DOC_ID);
  let selectedCs = null;

  await runTransaction(db, async (transaction) => {
    const rotationSnapshot = await transaction.get(rotationRef);
    const savedIndex = Number(rotationSnapshot.data()?.nextIndex || 0);
    const currentIndex =
      Number.isFinite(savedIndex) && savedIndex >= 0 ? Math.floor(savedIndex) : 0;
    const assignedCs = CS_LIST[currentIndex % CS_LIST.length];
    const nextIndex = (currentIndex + 1) % CS_LIST.length;
    selectedCs = assignedCs;

    transaction.set(leadRef, buildLeadPayload(formData, assignedCs));
    transaction.set(
      rotationRef,
      {
        nextIndex,
        lastAssignedCsId: assignedCs.id,
        lastAssignedCsNama: assignedCs.nama,
        lastAssignedCsWa: assignedCs.wa,
        lastAssignedCsWhatsapp: assignedCs.wa,
        lastAssignedCsEmail: assignedCs.email.toLowerCase(),
        updatedAt: getTanggalServer(),
      },
      { merge: true }
    );
  });

  return selectedCs;
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

  const validation = validateForm();

  if (!validation.isValid) {
    showMessage(validation.message);
    return;
  }

  if (!isFirebaseConfigured) {
    showMessage("Konfigurasi Firebase belum diisi. Lengkapi firebase.js terlebih dahulu.");
    return;
  }

  if (CS_LIST.length === 0 || CS_LIST.some((cs) => !cs.id || !cs.email || !cs.wa)) {
    showMessage("Daftar CS belum tersedia. Lengkapi CS_LIST terlebih dahulu.");
    return;
  }

  pushGtmEvent({
    event: "lead_submit",
    nama: validation.data.nama,
    whatsapp: validation.data.whatsapp,
    productId: getProductId(),
  });

  setLoading(true);

  try {
    const assignedCs = await saveLeadWithAssignedCs(validation.data);

    showMessage("Data berhasil disimpan. Mengarahkan ke WhatsApp...", "success");
    pushGtmEvent({
      event: "whatsapp_click",
      csId: assignedCs?.id || "",
      productId: getProductId(),
    });
    window.location.href = REDIRECT_WHATSAPP_URL;
  } catch (error) {
    console.error("Gagal menyimpan lead:", error);
    showMessage(
      "Maaf, data belum berhasil disimpan. Periksa koneksi atau konfigurasi Firebase, lalu coba lagi."
    );
    setLoading(false);
  }
});
