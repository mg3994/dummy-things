/**
 * Google Apps Script for Antinna Hardware & Repair
 * Handles contact form submissions from the Blogger template.
 */

function doPost(e) {
  try {
    var params = e.parameter;
    var action = params.action; // 'sendOTP', 'verifyOTP', or 'submitForm'

    if (action === 'sendOTP') {
      return handleSendOTP(params.phone);
    } else if (action === 'verifyOTP') {
      return handleVerifyOTP(params.phone, params.otp);
    }

    // Extract form data
    var name = params.name || "Anonymous";
    var email = params.email || "No email provided";
    var phone = params.phone || "";
    var message = params.message || "No message provided";

    // Phone format validation (Simple regex for international format)
    if (phone && !isValidPhone(phone)) {
       return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Invalid phone number format. Please include country code (e.g., +91...)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

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

    // 2. Log to Google Sheets (if a Spreadsheet ID is provided in script properties)
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (spreadsheetId) {
      var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
      sheet.appendRow([new Date(), name, email, phone, message]);
    }

    // Clear OTP after successful submission
    CacheService.getScriptCache().remove(phone);

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Message sent successfully!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Antinna API is active and ready to receive submissions.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Validates phone number format.
 */
function isValidPhone(phone) {
  var phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Generates and sends an OTP to the provided phone number.
 */
function handleSendOTP(phone) {
  if (!isValidPhone(phone)) {
    return createJsonResponse("error", "Invalid phone format.");
  }

  var otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in Cache for 5 minutes
  var cache = CacheService.getScriptCache();
  cache.put(phone, otp, 300);

  // Simulate sending SMS (Integration with Twilio/SMS provider goes here)
  var success = sendSMS(phone, "Your Antinna verification code is: " + otp);

  if (success) {
    return createJsonResponse("success", "OTP sent to your phone.");
  } else {
    // For demo purposes, we'll return success even if SMS fails, but log the OTP
    console.log("MOCK SMS to " + phone + ": " + otp);
    return createJsonResponse("success", "OTP sent (Simulated). Check logs.");
  }
}

/**
 * Verifies the provided OTP against the cached value.
 */
function handleVerifyOTP(phone, userOtp) {
  var cache = CacheService.getScriptCache();
  var cachedOtp = cache.get(phone);

  if (cachedOtp && cachedOtp === userOtp) {
    return createJsonResponse("success", "Phone verified successfully.");
  } else {
    return createJsonResponse("error", "Invalid or expired OTP.");
  }
}

/**
 * Mock function for sending SMS.
 */
function sendSMS(phone, message) {
  var sid = PropertiesService.getScriptProperties().getProperty('TWILIO_SID');
  var token = PropertiesService.getScriptProperties().getProperty('TWILIO_TOKEN');
  var from = PropertiesService.getScriptProperties().getProperty('TWILIO_PHONE');

  if (!sid || !token || !from) return false;

  var url = "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json";
  var options = {
    method: "post",
    headers: {
      "Authorization": "Basic " + Utilities.base64Encode(sid + ":" + token)
    },
    payload: {
      "From": from,
      "To": phone,
      "Body": message
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 201;
}

function createJsonResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({
    "status": status,
    "message": message
  })).setMimeType(ContentService.MimeType.JSON);
}
