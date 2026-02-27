const { initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");

// Initialize Firebase Admin (required for Firestore and Storage access)
initializeApp();

// Set global options, like max concurrency per container
setGlobalOptions({
    maxInstances: 10,
    region: 'nam5'
});

// Import and export individual AI functions
const { aiClassify } = require("./aiClassify");
const { aiParsePdf } = require("./aiParsePdf");
const { aiDeviceDoc } = require("./aiDeviceDoc");
const { aiDoeTemplate } = require("./aiDoeTemplate");
const { aiDuplicateCheck } = require("./aiDuplicateCheck");
const { aiMonthlyReport } = require("./aiMonthlyReport");

exports.aiClassify = aiClassify;
exports.aiParsePdf = aiParsePdf;
exports.aiDeviceDoc = aiDeviceDoc;
exports.aiDoeTemplate = aiDoeTemplate;
exports.aiDuplicateCheck = aiDuplicateCheck;
exports.aiMonthlyReport = aiMonthlyReport;
