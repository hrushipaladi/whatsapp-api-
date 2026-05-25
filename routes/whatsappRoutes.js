import express from "express";
import {
  sendJdApprovedNotification,
  sendWhatsappMessage
} from "../controllers/whatsappController.js";

const router = express.Router();

router.post("/send-whatsapp", sendWhatsappMessage);
router.post("/send-jd-approved", sendJdApprovedNotification);

export default router;
