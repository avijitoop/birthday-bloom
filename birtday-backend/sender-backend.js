
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

const SITE_URL = process.env.SITE_URL;

const SIGNATURE =
  "Eng.Avijit Das Apon | Senior Software Engineer";

function getBangladeshDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    date: `${values.year}-${values.month}-${values.day}`
  };
}

async function sendBirthdayNotifications() {
  if (!SITE_URL) {
    throw new Error("SITE_URL secret is missing.");
  }

  const today = getBangladeshDate();

  console.log("Birthday checking date:", today.date);

  const birthdaySnapshot = await db
    .collection("birthdays")
    .get();

  let totalSent = 0;

  for (const birthdayDoc of birthdaySnapshot.docs) {
    const birthday = birthdayDoc.data();

    if (!birthday.birthDate || !birthday.publicWishId) {
      continue;
    }

    const [, birthMonth, birthDay] =
      birthday.birthDate.split("-");

    if (
      birthMonth !== today.month ||
      birthDay !== today.day
    ) {
      continue;
    }

    const logId = `${birthdayDoc.id}_${today.date}`;

    const logRef = db
      .collection("notificationLogs")
      .doc(logId);

    // Prevent duplicate notifications on the same birthday.
    const existingLog = await logRef.get();

    if (existingLog.exists) {
      console.log("Already processed:", birthday.name);
      continue;
    }

    // IMPORTANT:
    // app.js saves publicWish document ID in birthdayId.
    const subscriptionsSnapshot = await db
      .collection("pushSubscriptions")
      .where("birthdayId", "==", birthday.publicWishId)
      .where("active", "==", true)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log("No subscribers for:", birthday.name);
      continue;
    }

    const wishUrl = new URL("/", SITE_URL);

    wishUrl.searchParams.set("wish", birthday.publicWishId);

    const title = `🎂 Happy Birthday ${birthday.name}!`;

    const body =
      `A special birthday wish from ${SIGNATURE} ❤️`;

    const subscriptions = subscriptionsSnapshot.docs;

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < subscriptions.length; i += 500) {
      const batch = subscriptions.slice(i, i + 500);

      const tokens = batch.map(
        subscription => subscription.data().token
      );

      const response = await messaging.sendEachForMulticast({
        tokens,

        data: {
          title,
          body,
          url: wishUrl.toString()
        },

        webpush: {
          headers: {
            Urgency: "high"
          }
        }
      });

      for (let j = 0; j < response.responses.length; j++) {
        const result = response.responses[j];

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;

          const errorCode = result.error?.code;

          console.error(
            "Push failed:",
            errorCode,
            batch[j].id
          );

          if (
            errorCode ===
              "messaging/registration-token-not-registered" ||
            errorCode ===
              "messaging/invalid-registration-token"
          ) {
            await batch[j].ref.update({
              active: false
            });
          }
        }
      }
    }

    // Write a log only if at least one notification was sent.
    // This allows another run to retry when every send fails.
    if (sentCount > 0) {
      await logRef.set({
        birthdayId: birthdayDoc.id,
        publicWishId: birthday.publicWishId,
        name: birthday.name,
        date: today.date,
        status: "completed",
        sentCount,
        failedCount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      totalSent += sentCount;

      console.log(
        `Sent ${sentCount} notification(s) for ${birthday.name}`
      );
    } else {
      console.log(
        `No notifications successfully sent for ${birthday.name}`
      );
    }
  }

  console.log("Total notifications sent:", totalSent);
}

sendBirthdayNotifications()
  .then(() => {
    console.log("Birthday notification job completed.");
    process.exit(0);
  })
  .catch(error => {
    console.error("Birthday notification job failed:", error);
    process.exit(1);
  });
