/** Falcon SST Manager - Web App v1.3 **/
/** Falcon EDU © 2023-2025 All Rights Reserved **/
/** Created by: Nick Zagorin **/

//////////////////////
// GLOBAL CONSTANTS //
//////////////////////

const ACTIVE_STUDENT_DATA_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Active Student Data');
const ARCHIVE_STUDENT_DATA_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Archive Student Data');
const MEETING_DATA_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meeting Data');

///////////////////////////
// PAGE RENDER FUNCTIONS //
///////////////////////////

/** Render the web app in the browser **/
function doGet(e) {
  const userSettings = getUserSettings();
  const page = e.parameter.page || "dashboard";
  const htmlTemplate = HtmlService.createTemplateFromFile(page);
  
  // Inject the user properties into the HTML
  htmlTemplate.userSettings = JSON.stringify(userSettings);

  return HtmlService.createHtmlOutput(htmlTemplate.evaluate().getContent())
    .setContent(htmlTemplate.evaluate().getContent().replace("{{NAVBAR}}", getNavbar(page)))
    .setFaviconUrl("https://meesterzee.github.io/FalconEDU/images/Falcon%20EDU%20Favicon%2032x32.png")
    .setTitle("Falcon SST Manager");
}

/** Create navigation/menu bar **/
function getNavbar(activePage) {
  const dashboardURL = getScriptURL();
  const settingsURL = getScriptURL("page=settings");
  
  // Set the app header
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentYear = new Date().getFullYear();
  const schoolYear = scriptProperties.getProperty('schoolYear') || (currentYear + '-' + (currentYear + 1));
  const headerText = "Falcon SST Manager - " + schoolYear;

  let navbar = 
    `<div class="menu-bar">
      <button class="menu-button" onclick="showNav()">
        <div id="menu-icon">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      <h1 id="header-text">` + headerText + `</h1>
    </div>
    <div class="nav-bar" id="nav-bar-links">
      <a href="${dashboardURL}" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
        <i class="bi bi-person-circle"></i>Dashboard
      </a>
      <a href="${settingsURL}" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
        <i class="bi bi-gear-wide-connected"></i>Settings
      </a>
      <button class="nav-button" onclick="showAbout()">
        <i class="bi bi-info-circle"></i>About
      </button>
    </div>
    <div class="javascript-code">
    <script>
      function showNav() {
        const icon = document.getElementById('menu-icon');
        const navbar = document.querySelector('.nav-bar');
        icon.classList.toggle('open');
        navbar.classList.toggle('show');
      }

      function showAbout() {
        const title = "<i class='bi bi-info-circle'></i>About Falcon SST Manager";
        const message = "Web App Version: 1.3<br>Build: 11110724<br><br>Created by: Nick Zagorin<br>© 2024-2025 - All rights reserved";
        showModal(title, message, "Close");
      }
    </script>
    </div>`;

  return navbar;
}

/** Get URL of the Google Apps Script web app **/
function getScriptURL(qs = null) {
  let url = ScriptApp.getService().getUrl();
  if(qs){
    if (qs.indexOf("?") === -1) {
      qs = "?" + qs;
    }
    url = url + qs;
  }

  return url;
}

/** Include additional files in HTML **/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/////////////////////////
// DASHBOARD FUNCTIONS //
/////////////////////////

/** Get active data **/
function getActiveData() {
  return getSheetData(ACTIVE_STUDENT_DATA_SHEET);
}

/** Get archive data **/
function getArchiveData() {
  return getSheetData(ARCHIVE_STUDENT_DATA_SHEET);
}

/** Get meeting data **/
function getMeetingData() {
  return getSheetData(MEETING_DATA_SHEET);
}

/** Get sheet data **/
function getSheetData(sheet) {
  const lastRow = sheet.getLastRow();
  
  // Return empty array if there are no data rows
  if (lastRow <= 1) {
    return [];
  }

  // Get all headers and data in just two API calls
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  
  // Map the data to objects using array methods
  return data.map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

/** Get ID cache **/
function getIDCache() {
  const sheets = [
    ACTIVE_STUDENT_DATA_SHEET,
    ARCHIVE_STUDENT_DATA_SHEET,
    MEETING_DATA_SHEET
  ];
  
  const ids = sheets.reduce((acc, sheet) => {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const rangeValues = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      acc.push(...rangeValues.flat());
    }
    return acc;
  }, []);

  return ids;
}

////////////////////
// DATA FUNCTIONS //
////////////////////

/** Save student data **/
function saveStudentData(dataSet, studentData, meetingData) {
  // Cache frequently used values and references
  const studentID = studentData[0][0];
  const studentDataSheet = dataSet === "active" ? ACTIVE_STUDENT_DATA_SHEET : ARCHIVE_STUDENT_DATA_SHEET;
  
  // Get last row in one call
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  if (studentDataSheetLastRow <= 1) return "missingDatabaseEntry";
  
  // Get all student data at once, including formatted values for dates, times, and IDs
  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentData[0].length).getDisplayValues();
  
  // Find student index - now using formatted values throughout
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  
  // Check for duplicates using the complete formatted dataset
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) return "duplicateDatabaseEntry";
  if (studentIndex === -1) return "missingDatabaseEntry";
  
  // Update student data in one operation
  studentDataSheet.getRange(studentIndex + 2, 1, 1, studentData[0].length).setValues(studentData);
  
  // Process meeting data if provided
  if (meetingData?.length > 0) {
    const meetingID = meetingData[0][0];
    const meetingSheetLastRow = MEETING_DATA_SHEET.getLastRow();
    
    if (meetingSheetLastRow > 1) {
      // Get all meeting data at once with formatted values
      const allMeetingData = MEETING_DATA_SHEET.getRange(2, 1, meetingSheetLastRow - 1, meetingData[0].length).getDisplayValues();
      
      const meetingIndex = allMeetingData.findIndex(row => row[0] === meetingID);
      if (meetingIndex === -1) return "missingDatabaseEntry";
      
      // Update meeting data in one operation
      MEETING_DATA_SHEET.getRange(meetingIndex + 2, 1, 1, meetingData[0].length).setValues(meetingData);
    }
  }
  
  return "saveChangesSuccess";
}

/** Add student data **/
function addStudentData(studentData) {
  // Cache sheet properties
  const sheet = ACTIVE_STUDENT_DATA_SHEET;
  const studentID = studentData[0];
  const studentLastRow = sheet.getLastRow();
  const studentlastColumn = sheet.getLastColumn();
  
  // Check for duplicates only if there's existing data
  if (studentLastRow > 1) {
    // Batch read all Student IDs in one operation and convert to 1D array for faster searching
    const studentIDs = sheet.getRange(2, 1, studentLastRow - 1, 1).getDisplayValues().flat(); 
      
    // Use indexOf for efficient duplicate checking
    if (studentIDs.indexOf(studentID) !== -1) {
      return "duplicateDatabaseEntry";
    }
  }

  // Add student data to the sheet
  sheet.appendRow(studentData);
  
  // Perform formatting
  sheet.getRange('A:A').setNumberFormat('000000');
  
  // Sort only if there's more than one row of data
  if (studentLastRow > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, studentlastColumn).sort({ column: 2, ascending: true });
  }

  return true;
}

/** Add meeting data **/
function addMeetingData(meetingData) {
  // Cache sheet properties
  const meetingSheet = MEETING_DATA_SHEET;
  const studentSheet = ACTIVE_STUDENT_DATA_SHEET;  // Add reference to student sheet
  const meetingID = meetingData[0];
  const studentID = meetingData[1];  // Assuming student ID is second element
  const meetingLastRow = meetingSheet.getLastRow();
  
  // First, validate that the student exists
  const studentLastRow = studentSheet.getLastRow();
  if (studentLastRow > 1) {
    const studentIDs = studentSheet.getRange(2, 1, studentLastRow - 1, 1).getDisplayValues().flat();
    if (studentIDs.indexOf(studentID) === -1) {
      return "missingDatabaseEntry";
    }
  } else {
    return "missingDatabaseEntry"; // If no students exist in the sheet
  }
  
  // Check for duplicates only if there's existing data
  if (meetingLastRow > 1) {
    // Batch read all Meeting IDs in one operation and convert to 1D array for faster searching
    const meetingIDs = meetingSheet.getRange(2, 1, meetingLastRow - 1, 1).getDisplayValues().flat();
      
    // Use indexOf for efficient duplicate checking
    if (meetingIDs.indexOf(meetingID) !== -1) {
      return "duplicateDatabaseEntry";
    }
  }

  // Batch all formatting operations into a single transaction
  const formatRanges = [
    { range: 'A:A', format: '000000' }, // Meeting ID
    { range: 'B:B', format: '000000' }, // Student ID
    { range: 'D:D', format: 'yyyy-mm-dd' } // Meeting Date
  ];

  // Add the meeting data to the sheet
  meetingSheet.appendRow(meetingData);
  
  // Create a single transaction for all formatting operations
  const formatTransaction = formatRanges.map(({ range, format }) => {
    return () => meetingSheet.getRange(range).setNumberFormat(format);
  });
  
  // Execute all formatting operations
  formatTransaction.forEach(operation => operation());

  // Sort only if there's more than one row of data
  if (meetingLastRow > 1) {
    const lastRow = meetingSheet.getLastRow();
    const lastCol = meetingSheet.getLastColumn();
    
    // Sort in a single operation
    meetingSheet.getRange(2, 1, lastRow - 1, lastCol).sort({ column: 4, ascending: true });
  }

  return true;
}

/** Remove student from active data and add to archive data **/
function removeStudentData(studentID) {
  // Cache sheet references and properties
  const activeSheet = ACTIVE_STUDENT_DATA_SHEET;
  const archiveSheet = ARCHIVE_STUDENT_DATA_SHEET;
  const activeLastRow = activeSheet.getLastRow();
  const archiveLastRow = archiveSheet.getLastRow();
  const lastColumn = activeSheet.getLastColumn();

  // Early return if active data is empty
  if (activeLastRow <= 1) {
    return "missingDatabaseEntry";
  }

  // Check for duplicate in archive if it has data
  if (archiveLastRow > 1) {
    const archiveIDs = archiveSheet
      .getRange(2, 1, archiveLastRow - 1, 1)
      .getDisplayValues()
      .flat();

    if (archiveIDs.indexOf(studentID) !== -1) {
      return "duplicateDatabaseEntry";
    }
  }

  // Get all active data in one batch operation
  const activeData = activeSheet
    .getRange(2, 1, activeLastRow - 1, lastColumn)
    .getDisplayValues();

  // Find student index using more efficient find method
  const studentIndex = activeData.findIndex(row => row[0] === studentID);

  if (studentIndex === -1) {
    return "missingDatabaseEntry";
  }

  // Cache the student data before removal
  const studentData = activeData[studentIndex];
  const studentRowIndex = studentIndex + 2; // Account for header row

  // Batch process operations
  // 1. Remove from active sheet
  activeSheet.deleteRow(studentRowIndex);

  // 2. Add to archive sheet and format
  archiveSheet.appendRow(studentData);
  archiveSheet.getRange('A:A').setNumberFormat('000000');

  // 3. Sort archive sheet if needed
  const newArchiveLastRow = archiveSheet.getLastRow();
  
  if (newArchiveLastRow > 2) {
    archiveSheet
      .getRange(2, 1, newArchiveLastRow - 1, lastColumn)
      .sort({ column: 2, ascending: true }); // Sort by Student Name (column 2)
  }

  return "archiveSuccess";
}

/** Rename student in data **/
function renameStudent(dataSet, studentID, newStudentName) {
  const sheet = dataSet === "active" ? ACTIVE_STUDENT_DATA_SHEET : ARCHIVE_STUDENT_DATA_SHEET;
  const sheetLastRow = sheet.getLastRow();
  
  if (sheetLastRow <= 1) return "missingDatabaseEntry";

  // Load all student data at once
  const studentDataRange = sheet.getRange(2, 1, sheetLastRow - 1, 2);
  const studentData = studentDataRange.getValues();
  
  // Use find() instead of for loop
  const foundStudentIndex = studentData.findIndex(row => row[0] == studentID);
  
  if (foundStudentIndex === -1) return "missingDatabaseEntry";

  // Batch our writes into a single operation
  const operations = [];
  
  // Update student name in student sheet
  operations.push(() => {
    sheet.getRange(foundStudentIndex + 2, 2).setValue(newStudentName);
    // Sort after update
    sheet.getRange(2, 1, sheetLastRow - 1, sheet.getLastColumn())
         .sort({ column: 2, ascending: true });
  });

  // Update meeting data sheet
  const meetingSheet = MEETING_DATA_SHEET;
  const meetingLastRow = meetingSheet.getLastRow();

  if (meetingLastRow > 1) {
    // Load all meeting data at once
    const meetingRange = meetingSheet.getRange(2, 2, meetingLastRow - 1, 2);
    const meetingData = meetingRange.getValues();
    
    // Find all rows that need updating
    const rowsToUpdate = meetingData.reduce((acc, row, index) => {
      if (row[0] == studentID) acc.push(index + 2);
      return acc;
    }, []);

    // Batch update meeting sheet if needed
    if (rowsToUpdate.length > 0) {
      operations.push(() => {
        const ranges = rowsToUpdate.map(row => 
          meetingSheet.getRange(row, 3)
        );
        
        // Use batch setValue for all matching rows
        meetingSheet.getRangeList(ranges.map(r => r.getA1Notation()))
                   .setValue(newStudentName);
      });
    }
  }

  // Execute all operations
  operations.forEach(op => op());
  
  return "renameSuccess";
}

/** Restore student from archive data and add to active data **/
function restoreStudentData(studentID) {
  // Cache sheet references and properties
  const activeSheet = ACTIVE_STUDENT_DATA_SHEET;
  const archiveSheet = ARCHIVE_STUDENT_DATA_SHEET;
  const activeLastRow = activeSheet.getLastRow();
  const archiveLastRow = archiveSheet.getLastRow();
  const lastColumn = archiveSheet.getLastColumn();

  // Early return if archive data is empty
  if (archiveLastRow <= 1) {
    return "missingDatabaseEntry";
  }

  // Check for duplicate in active data if it has data
  if (activeLastRow > 1) {
    const activeIDs = activeSheet
      .getRange(2, 1, activeLastRow - 1, 1)
      .getDisplayValues()
      .flat();

    if (activeIDs.indexOf(studentID) !== -1) {
      return "duplicateDatabaseEntry";
    }
  }

  // Get all archive data in one batch operation
  const archiveData = archiveSheet
    .getRange(2, 1, archiveLastRow - 1, lastColumn)
    .getDisplayValues();

  // Find student index using more efficient find method
  const studentIndex = archiveData.findIndex(row => row[0] === studentID);

  if (studentIndex === -1) {
    return "missingDatabaseEntry";
  }

  // Cache the student data before removal
  const studentData = archiveData[studentIndex];
  const studentRowIndex = studentIndex + 2; // Account for header row

  // Batch process operations
  // 1. Remove from archive sheet
  archiveSheet.deleteRow(studentRowIndex);

  // 2. Add to active sheet and format
  activeSheet.appendRow(studentData);
  activeSheet.getRange('A:A').setNumberFormat('000000');

  // 3. Sort active sheet if needed
  const newActiveLastRow = activeSheet.getLastRow();
  
  if (newActiveLastRow > 2) {
    activeSheet
      .getRange(2, 1, newActiveLastRow - 1, lastColumn)
      .sort({ column: 2, ascending: true }); // Sort by Student Name (column 2)
  }

  return "restoreSuccess";
}

/** Delete student and associated meetings from data **/
function deleteStudentData(studentID) {
  // Cache sheet references and properties
  const archiveSheet = ARCHIVE_STUDENT_DATA_SHEET;
  const meetingSheet = MEETING_DATA_SHEET;
  const archiveLastRow = archiveSheet.getLastRow();
  
  // Early return if archive is empty
  if (archiveLastRow <= 1) {
    return "missingDatabaseEntry";
  }
  
  // Get all archive IDs in one batch operation
  const archiveIDs = archiveSheet
    .getRange(2, 1, archiveLastRow - 1, 1)
    .getDisplayValues()
    .flat();

  // Check for duplicate entries
  const duplicateCount = archiveIDs.filter(id => id === studentID).length;
  if (duplicateCount > 1) {
    return "duplicateDatabaseEntry";
  }

  // Find student index
  const studentIndex = archiveIDs.indexOf(studentID);
  if (studentIndex === -1) {
    return "missingDatabaseEntry";
  }

  // Delete student from archive (adding 2 to account for header row and 0-based index)
  const studentRowIndex = studentIndex + 2;
  archiveSheet.deleteRow(studentRowIndex);

  // Handle associated meetings
  const meetingLastRow = meetingSheet.getLastRow();
  if (meetingLastRow > 1) {
    // Get all meeting data in one batch
    const meetingData = meetingSheet
      .getRange(2, 2, meetingLastRow - 1, 1)
      .getDisplayValues();

    // Find all rows to delete (in reverse order to maintain integrity)
    const rowsToDelete = meetingData
      .map((row, index) => row[0] === studentID ? index + 2 : null)
      .filter(row => row !== null)
      .reverse();

    // Delete meeting rows
    rowsToDelete.forEach(rowIndex => {
      meetingSheet.deleteRow(rowIndex);
    });
  }

  return "deleteSuccess";
}

/** Delete a single meeting from data **/
function deleteMeetingData(meetingID) {
  // Cache sheet references and properties
  const meetingSheet = MEETING_DATA_SHEET;
  const lastRow = meetingSheet.getLastRow();
  const lastColumn = meetingSheet.getLastColumn();
  
  // Early return if meetings sheet is empty
  if (lastRow <= 1) {
    return "missingMeetingEntry";
  }
  
  // Get all meeting data in one batch operation
  const meetingData = meetingSheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getDisplayValues();

  // Find meeting index using more efficient find method
  const meetingIndex = meetingData.findIndex(row => row[0] === meetingID);

  // Return early if meeting not found
  if (meetingIndex === -1) {
    return "missingMeetingEntry";
  }

  // Delete meeting (adding 2 to account for header row and 0-based index)
  const meetingRowIndex = meetingIndex + 2;
  meetingSheet.deleteRow(meetingRowIndex);

  return "deleteSuccess";
}

////////////////////////
// SETTINGS FUNCTIONS //
////////////////////////

/** Get user settings from user properties service **/
function getUserSettings() {
  const userProperties = PropertiesService.getUserProperties();

  return {
    theme: userProperties.getProperty('theme') || 'falconLight',
    customThemeType: userProperties.getProperty('customThemeType'),
    customThemePrimaryColor: userProperties.getProperty('customThemePrimaryColor'),
    customThemeAccentColor: userProperties.getProperty('customThemeAccentColor'),
    alertSound: userProperties.getProperty('alertSound') || 'alert01',
    emailSound: userProperties.getProperty('emailSound') || 'email01',
    removeSound: userProperties.getProperty('removeSound') || 'remove01',
    successSound: userProperties.getProperty('successSound') || 'success01',
    silentMode: userProperties.getProperty('silentMode') || 'false'
  };
}

/** Get all settings from User Properties and Script Properties */
function getAppSettings() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentYear = new Date().getFullYear();

  return {
    schoolSettings: {
      schoolName: scriptProperties.getProperty('schoolName') || "",
      schoolYear: scriptProperties.getProperty('schoolYear') || (currentYear + '-' + (currentYear + 1))
    },
    classroomSettings: scriptProperties.getProperty('classroomSettings') ? JSON.parse(scriptProperties.getProperty('classroomSettings')) : [],
    emailTemplateSettings: {
      referral: {
        subject: scriptProperties.getProperty('emailTemplateReferralSubject') || "",
        body: scriptProperties.getProperty('emailTemplateReferralBody') || ""
      },
      initial: {
        subject: scriptProperties.getProperty('emailTemplateInitialSubject') || "",
        body: scriptProperties.getProperty('emailTemplateInitialBody') || ""
      },
      reminder: {
        subject: scriptProperties.getProperty('emailTemplateReminderSubject') || "",
        body: scriptProperties.getProperty('emailTemplateReminderBody') || ""
      },
      summary: {
        subject: scriptProperties.getProperty('emailTemplateSummarySubject') || "",
        body: scriptProperties.getProperty('emailTemplateSummaryBody') || ""
      }
    }
  };
}

/** Write all settings to user and script properties stores **/
function writeSettings(userSettings, appSettings) {
  const userProperties = PropertiesService.getUserProperties();
  const scriptProperties = PropertiesService.getScriptProperties();

  // Store user-specific settings in User Properties and delete unused properties
  userProperties.setProperties({
    theme: userSettings.theme || "falconLight",
    customThemeType: userSettings.customThemeType || null,
    customThemePrimaryColor: userSettings.customThemePrimaryColor || null,
    customThemeAccentColor: userSettings.customThemeAccentColor || null,
    alertSound: userSettings.alertSound || "alert01",
    emailSound: userSettings.emailSound || "email01",
    removeSound: userSettings.removeSound || "remove01",
    successSound: userSettings.successSound || "sucess01",
    silentMode: userSettings.silentMode || "false"
  }, true);
  
  // Store app-wide settings in Script Properties and delete unused properties
  scriptProperties.setProperties({
    schoolName: appSettings.schoolSettings.schoolName,
    schoolYear: appSettings.schoolSettings.schoolYear,
    classroomSettings: JSON.stringify(appSettings.classroomSettings),
    emailTemplateReferralSubject: appSettings.emailTemplateSettings.referral.subject,
    emailTemplateReferralBody: appSettings.emailTemplateSettings.referral.body,
    emailTemplateInitialSubject: appSettings.emailTemplateSettings.initial.subject,
    emailTemplateInitialBody: appSettings.emailTemplateSettings.initial.body,
    emailTemplateReminderSubject: appSettings.emailTemplateSettings.reminder.subject,
    emailTemplateReminderBody: appSettings.emailTemplateSettings.reminder.body,
    emailTemplateSummarySubject: appSettings.emailTemplateSettings.summary.subject,
    emailTemplateSummaryBody: appSettings.emailTemplateSettings.summary.body
  }, true);
}

/////////////////////
// EMAIL FUNCTIONS //
/////////////////////

/** Create and send email */
function createEmail(recipient, subject, body, attachments) {
  const emailQuota = MailApp.getRemainingDailyQuota();

  // Check user's email quota and warn if it's too low to send emails
  if (emailQuota <= 10) {
    return "emailQuotaLimit";
  }

  // Get the current user's email
  const currentUserEmail = Session.getActiveUser().getEmail();
  
  // Create the email message object
  const emailMessage = {
    to: recipient,
    bcc: currentUserEmail,
    replyTo: currentUserEmail,
    subject: subject,
    htmlBody: body,
    name: 'First Lutheran School',
    attachments: []
  };

  // Add attachments if provided
  if (attachments) {
    const uint8Array = new Uint8Array(attachments);
    const blob = Utilities.newBlob(uint8Array, 'application/pdf', 'First Lutheran School - SST Meeting Summary.pdf');
    emailMessage.attachments.push(blob);
  }

  // Send the email
  try {
    MailApp.sendEmail(emailMessage);
    return "emailSuccess";
  }
  catch (e) {
    return "emailFailure";
  }
}

////////////////////
// FILE FUNCTIONS //
////////////////////

/** Export data as a .csv file **/
function getCsv(dataType) {
  let data;
  
  if (dataType === 'activeData') {
    data = ACTIVE_STUDENT_DATA_SHEET.getDataRange().getDisplayValues();
  } else if (dataType === 'archiveData') {
    data = ARCHIVE_STUDENT_DATA_SHEET.getDataRange().getDisplayValues();
  } else {
    data = MEETING_DATA_SHEET.getDataRange().getDisplayValues();
  }

  return data.map(rowArray => {
    return rowArray.map(field => {
      // Convert to string and trim any whitespace
      let stringField = String(field).trim();
      
      // Determine if the field needs to be quoted
      let needsQuoting = false;
      
      // Quote if: contains commas, quotes, line breaks, or is a number with leading zeros
      if (
        stringField.includes(',') || 
        stringField.includes('"') || 
        stringField.includes('\n') || 
        stringField.includes('\r') ||
        (
          // Check for leading zeros in numeric fields
          /^0\d+$/.test(stringField) && 
          !isNaN(stringField)
        )
      ) {
        needsQuoting = true;
      }

      if (needsQuoting) {
        // Escape any existing quotes by doubling them
        stringField = stringField.replace(/"/g, '""');
        // Wrap the field in quotes
        return `"${stringField}"`;
      }
      
      return stringField;
    }).join(',');
  }).join('\r\n');
}

/** Export data as a .xlsx file **/
function getXlsx(dataType) {
  const spreadsheetId = SpreadsheetApp.getActive().getId();
  let sheetId;
  
  if (dataType === 'activeData') {
    sheetId = ACTIVE_STUDENT_DATA_SHEET.getSheetId();
  } else if (dataType === 'archiveData') {
    sheetId = ARCHIVE_STUDENT_DATA_SHEET.getSheetId();
  } else {
    sheetId = MEETING_DATA_SHEET.getSheetId();
  }

  // Construct the export URL
  const url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=xlsx&gid=" + sheetId;
  
  // Fetch the xlsx file as a blob
  const blob = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}}).getBlob();
  
  // Return blob as binary
  return blob.getBytes();
}
