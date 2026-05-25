import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase.js";

const TRACKING_COLLECTION = "settings";
const TRACKING_DOC_ID = "tracking";

window.GTM_ID = "";
window.GOOGLE_ADS_ID = "";
window.GOOGLE_ADS_CONVERSION_LABEL = "";
window.dataLayer = window.dataLayer || [];

window.pushGtmEvent = function pushGtmEvent(eventData) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventData);
};

window.pushGtmEvent({
  event: "page_view",
  page: window.location.pathname,
});

function loadGtm(gtmId) {
  if (!gtmId) {
    return;
  }

  if (document.querySelector(`script[data-gtm-id="${gtmId}"]`)) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js",
  });

  const firstScript = document.getElementsByTagName("script")[0];
  const gtmScript = document.createElement("script");

  gtmScript.async = true;
  gtmScript.dataset.gtmId = gtmId;
  gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
  firstScript.parentNode.insertBefore(gtmScript, firstScript);
}

window.applyTrackingSettings = function applyTrackingSettings(tracking = {}) {
  const gtmId = String(tracking.gtmId || "").trim();

  window.GTM_ID = gtmId;
  window.GOOGLE_ADS_ID = String(tracking.googleAdsId || "").trim();
  window.GOOGLE_ADS_CONVERSION_LABEL = String(tracking.conversionLabel || "").trim();
  window.trackingSettings = {
    gtmId: window.GTM_ID,
    googleAdsId: window.GOOGLE_ADS_ID,
    conversionLabel: window.GOOGLE_ADS_CONVERSION_LABEL,
  };

  loadGtm(gtmId);
};

async function initializeTracking() {
  try {
    const trackingSnapshot = await getDoc(doc(db, TRACKING_COLLECTION, TRACKING_DOC_ID));
    const tracking = trackingSnapshot.exists() ? trackingSnapshot.data() : {};
    window.applyTrackingSettings(tracking);
  } catch (error) {
    console.warn("Gagal memuat setting GTM:", error);
  }
}

initializeTracking();
