
import { app, auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

// ========================================
// CONFIGURATION
// ========================================

const ADMIN_UID = "tKI11GXB78UU78x3sIEPsiqKpHZ2";

const VAPID_KEY =
  "BB46DdV-yDMkLc9fQgpDsGYeIZHEZfKFGbk49yg4SRBtjGDl6jNj4nuN45qkGUNXBioysBnsVg85vTHBK22P6jw";

const SIGNATURE =
  "Eng.Avijit Das Apon | Senior Software Engineer";

const birthdaysRef = collection(db, "birthdays");
const publicWishesRef = collection(db, "publicWishes");

let currentUser = null;
let currentPublicWish = null;
let birthdayRecords = [];
let messaging = null;
let foregroundMessageListenerReady = false;

const $ = (id) => document.getElementById(id);

// ========================================
// HTML ELEMENTS
// ========================================

const authPanel = $("authPanel");
const appPanel = $("appPanel");
const publicWishPanel = $("publicWishPanel");

const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const signupBtn = $("signupBtn");
const authMessage = $("authMessage");

const birthdayList = $("birthdayList");
const emptyState = $("emptyState");

const birthdayDialog = $("birthdayDialog");
const birthdayForm = $("birthdayForm");

const nameInput = $("personName");
const birthDateInput = $("birthDate");
const relationInput = $("relation");
const emailInput = $("personEmail");
const phoneInput = $("personPhone");
const photoInput = $("personPhoto");
const noteInput = $("personNote");

const editIdInput = $("editId");
const dialogTitle = $("dialogTitle");
const formMessage = $("formMessage");

const addBtn = $("addBtn");
const emptyAddBtn = $("emptyAddBtn");
const closeDialog = $("closeDialog");
const cancelDialog = $("cancelDialog");

const totalCount = $("totalCount");
const monthCount = $("monthCount");
const nextName = $("nextName");

const publicWishTitle = $("publicWishTitle");
const publicWishMessage = $("publicWishMessage");
const publicWishDate = $("publicWishDate");

const enablePushBtn = $("enablePushBtn");
const pushStatus = $("pushStatus");

const notifyBtn = $("notifyBtn");
const toast = $("toast");

// ========================================
// GENERAL FUNCTIONS
// ========================================

function showToast(message) {
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

function showMessage(element, message, color = "red") {
  if (!element) return;

  element.textContent = message;
  element.style.color = color;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString + "T00:00:00");

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getTodayString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};

  parts.forEach(part => {
    values[part.type] = part.value;
  });

  return `${values.year}-${values.month}-${values.day}`;
}

function getNextBirthday(birthDate) {
  if (!birthDate) return "9999-12-31";

  const today = getTodayString();
  const [, month, day] = birthDate.split("-");

  let year = Number(today.slice(0, 4));
  let nextDate = `${year}-${month}-${day}`;

  if (nextDate < today) {
    year++;
    nextDate = `${year}-${month}-${day}`;
  }

  return nextDate;
}

function getDaysLeft(dateString) {
  const today = new Date(getTodayString() + "T00:00:00");
  const target = new Date(dateString + "T00:00:00");

  return Math.round((target - today) / 86400000);
}

function isAdmin(user) {
  return Boolean(
    user &&
    user.uid === ADMIN_UID &&
    !user.isAnonymous
  );
}

// ========================================
// AUTHENTICATION
// ========================================

loginBtn?.addEventListener("click", async () => {
  const email = $("emailInput")?.value.trim();
  const password = $("passwordInput")?.value;

  if (!email || !password) {
    showMessage(authMessage, "Email এবং Password লিখুন।");
    return;
  }

  try {
    loginBtn.disabled = true;

    showMessage(authMessage, "Login হচ্ছে...", "blue");

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (!isAdmin(result.user)) {
      await signOut(auth);

      throw new Error(
        "এই Account-এর Admin UID সঠিক নয়।"
      );
    }

    showMessage(authMessage, "Login successful!", "green");

  } catch (error) {
    console.error("Login error:", error);

    showMessage(
      authMessage,
      "Login failed: " + error.message
    );

  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Logged out successfully!");
  } catch (error) {
    console.error(error);
    showToast("Logout failed: " + error.message);
  }
});

signupBtn?.addEventListener("click", () => {
  showMessage(
    authMessage,
    "Admin account Firebase Authentication থেকে তৈরি করুন।"
  );
});

// ========================================
// AUTH STATE
// ========================================

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const params = new URLSearchParams(location.search);
  const isPublicPage = params.has("wish");

  if (isPublicPage) {
    authPanel?.classList.add("hidden");
    appPanel?.classList.add("hidden");
    publicWishPanel?.classList.remove("hidden");

    await loadPublicWish();
    return;
  }

  publicWishPanel?.classList.add("hidden");

  if (isAdmin(user)) {
    authPanel?.classList.add("hidden");
    appPanel?.classList.remove("hidden");
    logoutBtn?.classList.remove("hidden");

    await loadBirthdays();

  } else {
    appPanel?.classList.add("hidden");
    authPanel?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");

    if (user) {
      await signOut(auth);
    }
  }
});

// ========================================
// BIRTHDAY DIALOG
// ========================================

function openBirthdayDialog(person = null) {
  if (!birthdayDialog) return;

  birthdayForm?.reset();

  if (editIdInput) editIdInput.value = "";
  if (formMessage) formMessage.textContent = "";

  if (person) {
    if (dialogTitle) {
      dialogTitle.textContent = "Edit Birthday";
    }

    editIdInput.value = person.id;
    nameInput.value = person.name || "";
    birthDateInput.value = person.birthDate || "";
    relationInput.value = person.relation || "পরিবার";
    emailInput.value = person.email || "";
    phoneInput.value = person.phone || "";
    photoInput.value = person.photo || "";
    noteInput.value = person.note || "";

  } else {
    if (dialogTitle) {
      dialogTitle.textContent = "Add Birthday";
    }
  }

  if (!birthdayDialog.open) {
    birthdayDialog.showModal();
  }
}

function closeBirthdayDialog() {
  if (birthdayDialog?.open) {
    birthdayDialog.close();
  }
}

addBtn?.addEventListener("click", () => {
  openBirthdayDialog();
});

emptyAddBtn?.addEventListener("click", () => {
  openBirthdayDialog();
});

closeDialog?.addEventListener("click", closeBirthdayDialog);
cancelDialog?.addEventListener("click", closeBirthdayDialog);

// ========================================
// SAVE / UPDATE BIRTHDAY
// ========================================

birthdayForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin(currentUser)) {
    showMessage(formMessage, "Admin login প্রয়োজন।");
    return;
  }

  const name = nameInput.value.trim();
  const birthDate = birthDateInput.value;

  if (!name || !birthDate) {
    showMessage(formMessage, "নাম এবং জন্মতারিখ দিন।");
    return;
  }

  const editId = editIdInput.value;

  const birthdayData = {
    name,
    birthDate,
    relation: relationInput.value,
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    photo: photoInput.value.trim(),
    note: noteInput.value.trim(),
    ownerUid: ADMIN_UID,
    updatedAt: serverTimestamp()
  };

  const saveButton = birthdayForm.querySelector(
    'button[type="submit"]'
  );

  try {
    if (saveButton) saveButton.disabled = true;

    showMessage(formMessage, "সংরক্ষণ হচ্ছে...", "blue");

    if (editId) {
      await updateDoc(
        doc(db, "birthdays", editId),
        birthdayData
      );

      const existing = birthdayRecords.find(
        item => item.id === editId
      );

      await syncPublicWish({
        ...(existing || {}),
        ...birthdayData,
        id: editId
      });

    } else {
      const newBirthday = await addDoc(
        birthdaysRef,
        {
          ...birthdayData,
          createdAt: serverTimestamp()
        }
      );

      await syncPublicWish({
        ...birthdayData,
        id: newBirthday.id
      });
    }

    closeBirthdayDialog();

    showToast(
      editId
        ? "Birthday updated successfully!"
        : "Birthday saved successfully!"
    );

    await loadBirthdays();

  } catch (error) {
    console.error("Birthday save error:", error);

    showMessage(
      formMessage,
      "Save failed: " + error.message
    );

  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

// ========================================
// PUBLIC WISH SYNCHRONIZATION
// ========================================

async function syncPublicWish(person) {
  let publicWishId = person.publicWishId;

  const wishData = {
    name: person.name,
    birthDate: person.birthDate,
    relation: person.relation || "",
    email: person.email || "",
    phone: person.phone || "",
    photo: person.photo || "",
    note: person.note || "",
    ownerUid: ADMIN_UID,
    signature: SIGNATURE,
    updatedAt: serverTimestamp()
  };

  if (publicWishId) {
    await setDoc(
      doc(db, "publicWishes", publicWishId),
      wishData,
      { merge: true }
    );

  } else {
    const wishDoc = await addDoc(
      publicWishesRef,
      {
        ...wishData,
        createdAt: serverTimestamp()
      }
    );

    publicWishId = wishDoc.id;

    await updateDoc(
      doc(db, "birthdays", person.id),
      { publicWishId }
    );
  }

  return publicWishId;
}

// ========================================
// LOAD BIRTHDAYS
// ========================================

async function loadBirthdays() {
  if (!isAdmin(currentUser)) return;

  try {
    const q = query(
      birthdaysRef,
      where("ownerUid", "==", ADMIN_UID)
    );

    const snapshot = await getDocs(q);

    birthdayRecords = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderBirthdays();
    updateStatistics();

  } catch (error) {
    console.error("Birthday loading error:", error);

    showToast(
      "Birthday data load failed: " + error.message
    );
  }
}

// ========================================
// RENDER BIRTHDAY LIST
// ========================================

function renderBirthdays() {
  if (!birthdayList) return;

  birthdayList.innerHTML = "";

  emptyState?.classList.toggle(
    "hidden",
    birthdayRecords.length > 0
  );

  birthdayRecords.sort((a, b) => {
    return getNextBirthday(a.birthDate).localeCompare(
      getNextBirthday(b.birthDate)
    );
  });

  birthdayRecords.forEach(person => {
    const nextDate = getNextBirthday(person.birthDate);
    const daysLeft = getDaysLeft(nextDate);

    const card = document.createElement("div");
    card.className = "birthday-card";

    if (person.photo) {
      const image = document.createElement("img");

      image.src = person.photo;
      image.alt = person.name;
      image.className = "birthday-photo";
      image.loading = "lazy";

      image.onerror = () => image.remove();

      card.appendChild(image);
    }

    const heading = document.createElement("h3");
    heading.textContent = person.name;

    const relation = document.createElement("p");
    relation.textContent = person.relation || "পরিবার";

    const date = document.createElement("p");
    date.textContent = "🎂 " + formatDate(person.birthDate);

    const countdown = document.createElement("p");

    countdown.textContent =
      daysLeft === 0
        ? "🎉 Birthday Today!"
        : `${daysLeft} days remaining`;

    const note = document.createElement("p");
    note.textContent = person.note || "";

    const actions = document.createElement("div");
    actions.className = "birthday-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      openBirthdayDialog(person);
    });

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.textContent = "Share Wish";

    shareButton.addEventListener("click", async () => {
      await shareBirthday(person);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
      await removeBirthday(person);
    });

    actions.append(editButton, shareButton, deleteButton);

    card.append(
      heading,
      relation,
      date,
      countdown,
      note,
      actions
    );

    birthdayList.appendChild(card);
  });
}

// ========================================
// DASHBOARD STATISTICS
// ========================================

function updateStatistics() {
  const today = getTodayString();

  if (totalCount) {
    totalCount.textContent = birthdayRecords.length;
  }

  if (monthCount) {
    const count = birthdayRecords.filter(person => {
      return person.birthDate?.slice(5, 7) === today.slice(5, 7);
    }).length;

    monthCount.textContent = count;
  }

  if (nextName) {
    const upcoming = [...birthdayRecords].sort((a, b) => {
      return getNextBirthday(a.birthDate).localeCompare(
        getNextBirthday(b.birthDate)
      );
    });

    nextName.textContent =
      upcoming[0]?.name || "No birthdays";
  }
}

// ========================================
// DELETE BIRTHDAY
// ========================================

async function removeBirthday(person) {
  if (!isAdmin(currentUser)) {
    showToast("Admin login প্রয়োজন।");
    return;
  }

  const confirmed = confirm(
    `আপনি কি ${person.name}-এর Birthday Delete করতে চান?`
  );

  if (!confirmed) return;

  try {
    if (person.publicWishId) {
      await deleteDoc(
        doc(db, "publicWishes", person.publicWishId)
      );
    }

    await deleteDoc(
      doc(db, "birthdays", person.id)
    );

    await loadBirthdays();

    showToast("Birthday deleted successfully!");

  } catch (error) {
    console.error("Delete error:", error);

    showToast("Delete failed: " + error.message);
  }
}

// ========================================
// BIRTHDAY SHARE
// ========================================

function makeWishURL(person) {
  if (!person.publicWishId) return "";

  const url = new URL(location.href);

  url.search = "";
  url.hash = "";

  url.searchParams.set("wish", person.publicWishId);

  return url.toString();
}

async function shareBirthday(person) {
  try {
    if (!person.publicWishId) {
      showToast("Birthday Wish Link তৈরি হচ্ছে...");

      const wishId = await syncPublicWish(person);

      person.publicWishId = wishId;

      const index = birthdayRecords.findIndex(
        item => item.id === person.id
      );

      if (index !== -1) {
        birthdayRecords[index].publicWishId = wishId;
      }
    }

    const url = makeWishURL(person);

    if (!url) {
      throw new Error("Birthday Wish Link তৈরি করা যায়নি।");
    }

    const message =
      `🎂 ${person.name}-এর জন্য একটি বিশেষ Birthday Wish! ❤️\n\n` +
      `${url}\n\nFrom: ${SIGNATURE}`;

    if (navigator.share) {
      await navigator.share({
        title: "Birthday Bloom",
        text: message
      });

      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);

      showToast(
        "Birthday Message ও Link কপি হয়েছে! WhatsApp-এ Paste করুন।"
      );

      return;
    }

    window.prompt(
      "Birthday Message কপি করে WhatsApp-এ পাঠান:",
      message
    );

  } catch (error) {
    if (error.name === "AbortError") return;

    console.error("Share error:", error);

    showToast("Share failed: " + error.message);
  }
}

// ========================================
// PUBLIC BIRTHDAY WISH PAGE
// ========================================

async function loadPublicWish() {
  const wishId = new URLSearchParams(
    location.search
  ).get("wish");

  if (!wishId) return;

  try {
    const wishSnapshot = await getDoc(
      doc(db, "publicWishes", wishId)
    );

    if (!wishSnapshot.exists()) {
      if (publicWishTitle) {
        publicWishTitle.textContent = "Birthday Wish Not Found";
      }

      currentPublicWish = null;
      return;
    }

    currentPublicWish = {
      id: wishSnapshot.id,
      ...wishSnapshot.data()
    };

    const person = currentPublicWish;

    if (publicWishTitle) {
      publicWishTitle.textContent =
        `🎂 Happy Birthday ${person.name}!`;
    }

    if (publicWishMessage) {
      publicWishMessage.textContent =
        person.note ||
        "Wishing you a beautiful birthday filled with happiness, love and success! ❤️";
    }

    if (publicWishDate) {
      publicWishDate.textContent =
        formatDate(person.birthDate);
    }

    let signature = $("birthdaySignature");

    if (!signature && publicWishPanel) {
      signature = document.createElement("p");
      signature.id = "birthdaySignature";
      signature.className = "birthday-signature";

      publicWishPanel.appendChild(signature);
    }

    if (signature) {
      signature.textContent =
        person.signature || SIGNATURE;
    }

    if (person.photo) {
      let image = $("publicWishPhoto");

      if (!image && publicWishPanel) {
        image = document.createElement("img");
        image.id = "publicWishPhoto";
        image.className = "birthday-photo";

        publicWishPanel.querySelector(".wish-page")?.insertBefore(
          image,
          publicWishTitle
        );
      }

      if (image) {
        image.src = person.photo;
        image.alt = person.name;
      }
    }

  } catch (error) {
    console.error("Public wish error:", error);

    showToast(
      "Birthday Wish load failed: " + error.message
    );
  }
}

// ========================================
// FIREBASE MESSAGING INITIALIZATION
// ========================================

async function initializeMessaging() {
  try {
    const supported = await isSupported();

    if (!supported) {
      console.warn("Firebase Messaging is not supported.");
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    if (!foregroundMessageListenerReady) {
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);

        const title =
          payload.data?.title ||
          payload.notification?.title ||
          "🎂 Birthday Bloom";

        const body =
          payload.data?.body ||
          payload.notification?.body ||
          "আপনার জন্য একটি বিশেষ Birthday Wish অপেক্ষা করছে! ❤️";

        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon: "./icons/icon-192.png"
          });
        } else {
          showToast(title + " — " + body);
        }
      });

      foregroundMessageListenerReady = true;
    }

    return messaging;

  } catch (error) {
    console.error("Messaging initialization error:", error);
    return null;
  }
}

// ========================================
// ENABLE PUSH NOTIFICATION
// ========================================

enablePushBtn?.addEventListener("click", async () => {
  if (!currentPublicWish) {
    showMessage(
      pushStatus,
      "Birthday Wish পাওয়া যায়নি।"
    );
    return;
  }

  try {
    enablePushBtn.disabled = true;

    showMessage(
      pushStatus,
      "Notification permission চাওয়া হচ্ছে...",
      "blue"
    );

    if (!("Notification" in window)) {
      throw new Error(
        "এই Browser Notification support করে না।"
      );
    }

    if (!("serviceWorker" in navigator)) {
      throw new Error(
        "এই Browser Service Worker support করে না।"
      );
    }

    if (!window.isSecureContext) {
      throw new Error(
        "HTTPS Website প্রয়োজন।"
      );
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error(
        "Notification permission দেওয়া হয়নি।"
      );
    }

    const messagingInstance = await initializeMessaging();

    if (!messagingInstance) {
      throw new Error(
        "Firebase Messaging চালু করা যায়নি।"
      );
    }

    showMessage(
      pushStatus,
      "Anonymous Authentication হচ্ছে...",
      "blue"
    );

    let recipient = auth.currentUser;

    if (!recipient || !recipient.isAnonymous) {
      if (recipient) {
        await signOut(auth);
      }

      const result = await signInAnonymously(auth);
      recipient = result.user;
    }

    showMessage(
      pushStatus,
      "Service Worker Register হচ্ছে...",
      "blue"
    );

    // Use only this service worker in this project.
    const registration =
      await navigator.serviceWorker.register(
        "./service-worker.js",
        { scope: "./" }
      );

    await navigator.serviceWorker.ready;

    showMessage(
      pushStatus,
      "FCM Token তৈরি হচ্ছে...",
      "blue"
    );

    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error(
        "FCM Token তৈরি হয়নি। VAPID Key পরীক্ষা করুন।"
      );
    }

    console.log("FCM Token created:", token);

    const subscriptionId =
      `${currentPublicWish.id}_${recipient.uid}`;

    showMessage(
      pushStatus,
      "Firestore-এ Subscription Save হচ্ছে...",
      "blue"
    );

    await setDoc(
      doc(db, "pushSubscriptions", subscriptionId),
      {
        ownerUid: recipient.uid,
        birthdayId: currentPublicWish.id,
        token: token,
        active: true,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    showMessage(
      pushStatus,
      "✅ Birthday Notification সফলভাবে চালু হয়েছে!",
      "green"
    );

    enablePushBtn.textContent =
      "✅ Notification Enabled";

    showToast(
      "Push Subscription Firestore-এ Save হয়েছে!"
    );

  } catch (error) {
    console.error("Push registration error:", error);

    showMessage(
      pushStatus,
      "Notification চালু হয়নি: " + error.message
    );

    showToast("Push Error: " + error.message);

  } finally {
    enablePushBtn.disabled = false;
  }
});

// ========================================
// LOCAL TEST NOTIFICATION
// ========================================

notifyBtn?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast(
      "এই Browser Notification support করে না।"
    );
    return;
  }

  let permission = Notification.permission;

  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    new Notification("🎂 Birthday Bloom", {
      body: `Birthday reminder system is ready! ${SIGNATURE}`,
      icon: "./icons/icon-192.png"
    });

    showToast("Test notification sent!");

  } else {
    showToast(
      "Notification permission পাওয়া যায়নি।"
    );
  }
});
