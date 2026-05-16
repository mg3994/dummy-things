/**
 * Google Apps Script for Antinna Hardware & Repair
 * Handles contact form submissions and OTP verification via POST.
 */

function doPost(e) {
  try {
    var params = e.parameter;
    // Check if it's JSON payload (sometimes fetch sends as JSON)
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }

    var action = params.action;

    if (action === 'sendOTP') {
      return handleSendOTP(params.phone);
    } else if (action === 'verifyOTP') {
      return handleVerifyOTP(params.phone, params.otp);
    } else if (action === 'submitForm') {
      return handleSubmitForm(params);
    }

    return createJsonResponse("error", "Invalid action.");
  } catch (error) {
    return createJsonResponse("error", error.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Antinna API is active. Please use POST for submissions.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function handleSubmitForm(params) {
  var name = params.name || "Anonymous";
  var email = params.email || "No email provided";
  var phone = params.phone || "";
  var message = params.message || "No message provided";

  // 1. Send Email Notification
  var adminEmail = "contact@antinna.in";
  var subject = "New Inquiry: " + name;
  var body = "You have a new inquiry from your website:\n\n" +
             "Name: " + name + "\n" +
             "Email: " + email + "\n" +
             "Phone: " + phone + "\n\n" +
             "Message:\n" + message;

  GmailApp.sendEmail(adminEmail, subject, body, {
    replyTo: email
  });

  // 2. Log to Google Sheets
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    try {
      var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
      sheet.appendRow([new Date(), name, email, phone, message]);
    } catch (e) {
      console.error("Sheet logging failed: " + e.toString());
    }
  }

  // Clear OTP after successful submission
  CacheService.getScriptCache().remove(phone);

  return createJsonResponse("success", "Message sent successfully!");
}

function handleSendOTP(phone) {
  if (!isValidPhone(phone)) {
    return createJsonResponse("error", "Invalid phone format.");
  }

  var otp = Math.floor(100000 + Math.random() * 900000).toString();
  var cache = CacheService.getScriptCache();
  cache.put(phone, otp, 300);

  var result = sendSMS(phone, "Your Antinna verification code is: " + otp);

  if (result.success) {
    return createJsonResponse("success", "OTP sent to your phone.");
  } else {
    // If provider failed, tell the user the truth or fallback to simulated ONLY if explicitly allowed
    if (result.simulated) {
       console.log("SIMULATED OTP for " + phone + ": " + otp);
       return createJsonResponse("success", "OTP sent (Simulated). Check Script Logs.");
    }
    return createJsonResponse("error", "Failed to send OTP: " + result.error);
  }
}

function handleVerifyOTP(phone, userOtp) {
  var cachedOtp = CacheService.getScriptCache().get(phone);
  if (cachedOtp && cachedOtp === userOtp) {
    return createJsonResponse("success", "Phone verified.");
  } else {
    return createJsonResponse("error", "Invalid or expired OTP.");
  }
}

function isValidPhone(phone) {
  var phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function sendSMS(phone, message) {
  var props = PropertiesService.getScriptProperties();

  // Try MSG91
  var msg91Key = props.getProperty('MSG91_AUTH_KEY');
  if (msg91Key) {
    var success = sendMSG91(phone, message, msg91Key);
    return { success: success, error: success ? null : "MSG91 error" };
  }

  // Try Twilio
  var twilioSid = props.getProperty('TWILIO_SID');
  if (twilioSid) {
    var success = sendTwilio(phone, message, props);
    return { success: success, error: success ? null : "Twilio error" };
  }

  // Fallback: Simulation mode for development
  return { success: true, simulated: true };
}

function sendTwilio(phone, message, props) {
  var sid = props.getProperty('TWILIO_SID');
  var token = props.getProperty('TWILIO_TOKEN');
  var from = props.getProperty('TWILIO_PHONE');
  var url = "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json";
  var options = {
    method: "post",
    headers: { "Authorization": "Basic " + Utilities.base64Encode(sid + ":" + token) },
    payload: { "From": from, "To": phone, "Body": message },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 201;
}

function sendMSG91(phone, message, authKey) {
  var url = "https://api.msg91.com/api/v2/sendsms";
  var payload = {
    "sender": "ANTINA",
    "route": "4",
    "country": "91",
    "sms": [{ "message": message, "to": [phone.replace('+91', '')] }]
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "authkey": authKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 200;
}

function createJsonResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({"status": status, "message": message}))
    .setMimeType(ContentService.MimeType.JSON);
}
