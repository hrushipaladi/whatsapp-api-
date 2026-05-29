import express from "express";
import {
  sendReferralNotification,
  sendJdApprovedNotification,
  sendWhatsappMessage,
  sendPreferencesReminderNotification,
  sendProfileUpdatedNotification
} from "../controllers/whatsappController.js";

const router = express.Router();

router.post("/send-whatsapp", sendWhatsappMessage);
router.post("/send-jd-approved", sendJdApprovedNotification);
router.post("/send-referral", sendReferralNotification);
router.post("/send-preferences-reminder", sendPreferencesReminderNotification);
router.post("/send-profile-updated", sendProfileUpdatedNotification);

export default router;
