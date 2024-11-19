<script type="text/javascript">
  // Global constants
  const STUDENT_KEY_MAPPINGS = {
    'gender': 'Gender', 'dateOfBirth': 'Date Of Birth', 'grade': 'Grade', 'classroom': 'Classroom', 'allergies': 'Allergies', 'medications': 'Medications', 'dietaryRestrictions':'Dietary Restrictions', 'diagnoses': 'Diagnoses', 'servicesPrograms': 'Services/Programs', 'specializedInstruction': 'Specialized Instruction', 'caseManager': 'Case Manager', 'roi1': 'ROI Organization 1', 'roi2': 'ROI Organization 2', 'roi3': 'ROI Organization 3', 'parentGuardianName1': 'Parent/Guardian Name 1', 'parentGuardianPhone1': 'Parent/Guardian Phone 1', 'parentGuardianEmail1': 'Parent/Guardian Email 1', 'parentGuardianName2': 'Parent/Guardian Name 2', 'parentGuardianPhone2': 'Parent/Guardian Phone 2', 'parentGuardianEmail2': 'Parent/Guardian Email 2', 'notes': 'Notes'
  };

  const MEETING_KEY_MAPPINGS = {
    'meetingDate': 'Date', 'meetingType': 'Type', 'attendees': 'Attendees', 'facilitator': 'Facilitator', 'scribe': 'Scribe', 'strengthsInput': 'Areas Of Strength', 'concernsInput': 'Areas Of Concern', 'actionPlanInput': 'Action Plan', 'nextDate': 'Next Date', 'nextTime': 'Next Time'
  };

  // Global variables
  let STUDENT_DATA;
  let MEETING_DATA;
  let APP_SETTINGS;
  
  // Global IDs
  let previousStudentID;
  let previousMeetingID;
  let cachedID = null;
  
  // Global flags
  let dataFlag = "active"; // Active for active data sheet, archive for archive data sheet
  let saveFlag = true; // True if all changes saved, false if unsaved changes
  let busyFlag = false; // True if backup in progress, false if backup not in progress

  // Initialize application
  window.onload = async function() {
    console.log("Initializing dashboard...");

    // Get main elements
    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
      // Show loading indicator and hide page elements
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      // Fetch data in parallel
      const [studentData, meetingData, appSettings] = await Promise.all([
        new Promise((resolve, reject) => {
          if (dataFlag === "archive") {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getArchiveData();
          } else {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getActiveData();
          }
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getMeetingData();
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
        })
      ]);

      // Assign data to global variables
      STUDENT_DATA = studentData;
      MEETING_DATA = meetingData;
      APP_SETTINGS = appSettings;

      // Initialize the dashboard
      setEventListeners();
      populateDashboard();

      console.log("Initialization complete!");

    } catch (error) {
      console.error("Error during initialization:", error);
    
    } finally {
      // Hide loading indicator and show page elements
      loadingIndicator.style.display = 'none';
      toolbar.style.display = 'block';
      page.style.display = 'flex';
    }
  };
    
  function setEventListeners() {
    console.log("Setting event listeners...")
    
    // Check for unsaved changes or busy state before closing the window
    window.addEventListener('beforeunload', function (e) {
      if (!saveFlag || busyFlag) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    
    // Add event listeners for tool bar buttons
    document.getElementById('saveChangesButton').addEventListener('click', saveProfile);
    document.getElementById('addStudentButton').addEventListener('click', addStudent);
    document.getElementById('removeStudentButton').addEventListener('click', removeStudent);
    document.getElementById('renameStudentButton').addEventListener('click', renameStudent);
    document.getElementById('restoreStudentButton').addEventListener('click', restoreStudent);
    document.getElementById('deleteStudentButton').addEventListener('click', deleteStudent);
    document.getElementById('addMeetingButton').addEventListener('click', addMeeting);
    document.getElementById('deleteMeetingButton').addEventListener('click', deleteMeeting);
    document.getElementById('emailButton').addEventListener('click', composeEmail);
    document.getElementById('exportMeetingButton').addEventListener('click', exportMeeting);
    document.getElementById('exportDataButton').addEventListener('click', exportData);
    document.getElementById('archiveButton').addEventListener('click', toggleDataView);
    document.getElementById('backButton').addEventListener('click', toggleDataView);
    
    // Dropdown event listeners
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      const dropdownContent = dropdown.querySelector('.dropdown-content');

      dropdown.addEventListener('mouseenter', () => {
        dropdown.classList.add('active');
      });

      dropdown.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!dropdown.matches(':hover')) {
            dropdown.classList.remove('active');
          }
        }); // Small delay to prevent flickering
      });
    });
    
    // Add event listener for student name select box
    const studentNameSelectBox = document.getElementById('studentName');
    studentNameSelectBox.addEventListener('change', function() {
      const currentStudent = studentNameSelectBox.value;
      if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        studentNameSelectBox.value = previousStudentID;
      }
      else {
        updateStudentData(currentStudent);
      }
    });

    // Add event listener for meeting name select box
    const meetingNameSelectBox = document.getElementById('meetingName');
    meetingNameSelectBox.addEventListener('change', function() {
      const currentMeeting = meetingNameSelectBox.value;
      if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        meetingNameSelectBox.value = previousMeetingID;
      }
      else {
        updateMeetingData(currentMeeting);
      }
    });

    // Add event listeners for color dashboard fields
    const selectColorElements = document.querySelectorAll('#gender, #dateOfBirth, #grade, #classroom, #specializedInstruction');
    const inputColorElements = document.querySelectorAll('#allergies, #medications, #dietaryRestrictions, #diagnoses, #servicesPrograms, #caseManager, #roi1, #roi2, #roi3, #parentGuardianName1, #parentGuardianPhone1, #parentGuardianEmail1, #parentGuardianName2, #parentGuardianPhone2, #parentGuardianEmail2');
    const noColorElements = document.querySelectorAll('#notes, #meetingDate, #meetingType, #attendees, #facilitator, #scribe, #strengthsInput, #concernsInput, #actionPlan, #nextDate, #nextTime');

    selectColorElements.forEach(element => {
      element.addEventListener('change', () => {
        saveAlert();
        element.style.backgroundColor = getColor(element);
      });
    });

    inputColorElements.forEach(element => {
      element.addEventListener('input', () => {
        saveAlert();
        element.style.backgroundColor = getColor(element);
        if (element.id === 'parentGuardianPhone1' || element.id === 'parentGuardianPhone2') {
          formatPhoneNumber(element);
        }
      });
    });

    noColorElements.forEach(element => {
      const eventType = element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventType, () => {
        saveAlert();
      });
    });
    
    // Add event listener to allow deletion of select box entry with exceptions
    document.querySelectorAll("select:not(#studentName, #meetingName)").forEach(function(select) {
      select.addEventListener("keydown", function(event) {
        if (event.key === "Backspace" || event.key === "Delete") {
          if (!select.closest("#addStudentModal")) {
            saveAlert();
          }
          select.value = '';
          select.style.backgroundColor = '';
        }
      });
    });

    // Add event listener for phone number inputs in Add Student modal
    const addPhoneInputIds = document.querySelectorAll('#addParentGuardianPhone1, #addParentGuardianPhone2')
    addPhoneInputIds.forEach(input => {
      input.addEventListener('input', function(event) {
        formatPhoneNumber(this);
      });
    });

    // Add event listener for email template selection on Email modal
    const templateSelect = document.getElementById('templateSelect');
    templateSelect.addEventListener('change', function() {
      getEmailTemplate();
    });

    // Profile search event listener
    const profileSearchInput = document.getElementById('profileSearch');

    profileSearchInput.addEventListener('keyup', () => {
      const filter = profileSearchInput.value.toLowerCase();

      // Clear the current options in the studentNameSelectBox
      while (studentNameSelectBox.firstChild) {
        studentNameSelectBox.removeChild(studentNameSelectBox.firstChild);
      }

      // Filter the STUDENT_DATA based on the search input
      const filteredStudents = STUDENT_DATA.filter(student => {
        return Object.keys(student).some(key => {
          if ([
            'Student Name',
            'Gender', 
            'Date Of Birth', 
            'Grade', 
            'Classroom',
            'Allergies', 
            'Medications', 
            'Dietary Restrictions',
            'Diagnoses',
            'Services/Programs',
            'Specialized Instruction',
            'Case Manager', 
            'ROI Organization 1',
            'ROI Organization 2', 
            'ROI Organization 3', 
            'Parent/Guardian Name 1',
            'Parent/Guardian Phone 1', 
            'Parent/Guardian Email 1',
            'Parent/Guardian Name 2',
            'Parent/Guardian Phone 2', 
            'Parent/Guardian Email 2',
            'Notes'
          ].includes(key)) {
            const value = student[key] ? student[key].toString().toLowerCase() : '';
            const isMatch = value.includes(filter);
        
            // Log the key being checked and whether it matches
            return isMatch;
          }
          return false;
        });
      });

    // Populate the studentNameSelectBox with the filtered results
    filteredStudents.forEach(student => {
      const option = document.createElement('option');
      option.value = student['Student ID'];
      option.textContent = student['Student Name'];
      studentNameSelectBox.appendChild(option);
    });

    if (filteredStudents.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '';
      studentNameSelectBox.appendChild(option);
      updateStudentData("");
    }
    else {
      updateStudentData(filteredStudents[0]['Student ID']);
    }
  });
    
    console.log("Complete!");
  }

  function populateDashboard() {
    console.log("Populating dashboard...");

    const classroomSelect = document.getElementById('classroom');
    const addClassroomSelect = document.getElementById('addClassroom');
    classroomSelect.innerHTML = '';
    addClassroomSelect.innerHTML = '';

    // Populate classroom selects
    APP_SETTINGS.classroomSettings.forEach(classroom => {
      const className = classroom.classroom;
      const teacherName = classroom.teacher;
      if (className) {
        const option1 = document.createElement('option');
        option1.value = `${className} - ${teacherName}`;
        option1.textContent = `${className} - ${teacherName}`;
        classroomSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = `${className} - ${teacherName}`;
        option2.textContent = `${className} - ${teacherName}`;
        addClassroomSelect.appendChild(option2);
      }
    });

    // Set initial values for Add Student modal select boxes
    addStudentModal.querySelectorAll('select').forEach(function(select) {
      select.value = '';
    });

    // Set initial values for Add Student modal select boxes
    addMeetingModal.querySelectorAll('select').forEach(function(select) {
      select.value = '';
    });
    
    updateStudentNames();
    
    console.log("Complete!");
  }

  /////////////////////
  // MODAL FUNCTIONS //
  /////////////////////

  function resetModal() {
    const modalInputs = document.querySelectorAll('#addStudentModal input, #addStudentModal select, #renameStudentModal input, #addMeetingModal input, #addMeetingModal select, #emailModal input, #emailModal select, #emailBody, #exportMeetingModal select, #exportDataModal input, #exportDataModal select');
    
    modalInputs.forEach(function(input) {
      if (input.id === 'emailBody') {
        input.innerHTML = '';
      } else if (input.id === 'templateSelect' || input.id === 'exportMeetingSelect' || input.id === 'dataTypeSelect' || input.id === 'fileTypeSelect') {
        input.selectedIndex = 0; // Reset to the first option
      } else {
        input.value = '';
      }
    });

    // Reset the scroll position of all modal bodies
    const modalBodies = document.querySelectorAll('.modal-htmlbody');
    modalBodies.forEach(modalBody => {
      modalBody.scrollTop = 0;
    });
  }

  //////////////////
  // SAVE PROFILE //
  //////////////////

  function saveProfile() {
    if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
    }

    const studentNameSelectBox = document.getElementById('studentName');
    const meetingNameSelectBox = document.getElementById('meetingName');

    if (studentNameSelectBox.options.length === 0) {
        showError("Error: MISSING_STUDENT_DATA");
        return;
    }

    const selectedStudentID = studentNameSelectBox.value;
    const selectedMeetingID = meetingNameSelectBox.value;

    // Create working copies
    const tempStudentData = [...STUDENT_DATA];
    const tempMeetingData = [...MEETING_DATA];
    
    const student = tempStudentData.find(item => item['Student ID'] === selectedStudentID);

    // Update student data
    Object.entries(STUDENT_KEY_MAPPINGS).forEach(([elementId, dataKey]) => {
        const element = document.getElementById(elementId);
        if (element) {
            student[dataKey] = element.value;
        }
    });

    const studentDataArray = [[
        student['Student ID'],
        student['Student Name'],
        ...Object.keys(STUDENT_KEY_MAPPINGS).map(key => student[STUDENT_KEY_MAPPINGS[key]])
    ]];

    // Update meeting data if exists
    let meetingDataArray = [];
    if (selectedMeetingID?.trim()) {
        const meeting = tempMeetingData.find(item => item['Meeting ID'] === selectedMeetingID);
        if (meeting) {
            Object.entries(MEETING_KEY_MAPPINGS).forEach(([elementId, dataKey]) => {
                const element = document.getElementById(elementId);
                if (element) {
                    meeting[dataKey] = element.value;
                }
            });

            meetingDataArray = [[
                meeting['Meeting ID'],
                student['Student ID'],
                student['Student Name'],
                ...Object.keys(MEETING_KEY_MAPPINGS).map(key => meeting[MEETING_KEY_MAPPINGS[key]])
            ]];
        }
    }
    
    busyFlag = true;
    showToast("", "Saving changes...", 5000);

    google.script.run
      .withSuccessHandler(() => {
        STUDENT_DATA = tempStudentData;
        MEETING_DATA = tempMeetingData;
        document.getElementById('saveChangesButton').classList.remove('tool-bar-button-unsaved');
               
        showToast("", `'${student['Student Name']}' saved successfully!`, 5000);
        playNotificationSound("success");

        saveFlag = true;
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError("Error: DATABASE_FAILURE");
        }
        saveFlag = false;
        busyFlag = false;
      })
    .saveStudentData(dataFlag, studentDataArray, meetingDataArray);
  }

  /////////////////
  // ADD STUDENT //
  /////////////////
  
  async function addStudent() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    showHtmlModal("addStudentModal");

    const addStudentModalButton = document.getElementById("addStudentModalButton");

    addStudentModalButton.onclick = async function() {
      if (addStudentErrorCheck()) {
        return;
      }

      busyFlag = true;
      
      // Get the form data
      const firstName = document.getElementById('addFirstName').value;
      const lastName = document.getElementById('addLastName').value;
      const studentName = lastName + ", " + firstName;

      // Create temporary student object
      const tempStudent = {
        'Student Name': studentName,
        'Gender': document.getElementById('addGender').value,
        'Date Of Birth': document.getElementById('addDateOfBirth').value,
        'Grade': document.getElementById('addGrade').value,
        'Classroom': document.getElementById('addClassroom').value,
        'Allergies': document.getElementById('addAllergies').value,
        'Medications': document.getElementById('addMedications').value,
        'Dietary Restrictions': document.getElementById('addDietaryRestrictions').value,
        'Diagnoses': document.getElementById('addDiagnoses').value,
        'Services/Programs': document.getElementById('addServicesPrograms').value,
        'Specialized Instruction': document.getElementById('addSpecializedInstruction').value,
        'Case Manager': document.getElementById('addCaseManager').value,
        'ROI Organization 1': document.getElementById('addROI1').value,
        'ROI Organization 2': document.getElementById('addROI2').value,
        'ROI Organization 3': document.getElementById('addROI3').value,
        'Parent/Guardian Name 1': document.getElementById('addParentGuardianName1').value,
        'Parent/Guardian Phone 1': document.getElementById('addParentGuardianPhone1').value,
        'Parent/Guardian Email 1': document.getElementById('addParentGuardianEmail1').value,
        'Parent/Guardian Name 2': document.getElementById('addParentGuardianName2').value,
        'Parent/Guardian Phone 2': document.getElementById('addParentGuardianPhone2').value,
        'Parent/Guardian Email 2': document.getElementById('addParentGuardianEmail2').value,
      };

      closeHtmlModal("addStudentModal");
      showToast("", "Adding student...", 5000);

      await getAvailableID();
      tempStudent['Student ID'] = cachedID;

      const newStudentArray = [
        tempStudent['Student ID'],
        tempStudent['Student Name'],
        tempStudent['Gender'],
        tempStudent['Date Of Birth'],
        tempStudent['Grade'],
        tempStudent['Classroom'],
        tempStudent['Allergies'],
        tempStudent['Medications'],
        tempStudent['Dietary Restrictions'],
        tempStudent['Diagnoses'],
        tempStudent['Services/Programs'],
        tempStudent['Specialized Instruction'],
        tempStudent['Case Manager'],
        tempStudent['ROI Organization 1'],
        tempStudent['ROI Organization 2'],
        tempStudent['ROI Organization 3'],
        tempStudent['Parent/Guardian Name 1'],
        tempStudent['Parent/Guardian Phone 1'],
        tempStudent['Parent/Guardian Email 1'],
        tempStudent['Parent/Guardian Name 2'],
        tempStudent['Parent/Guardian Phone 2'],
        tempStudent['Parent/Guardian Email 2'],
        '' // notes
      ];

      google.script.run
        .withSuccessHandler(() => {
          console.log('success');
          STUDENT_DATA.push(tempStudent);
          updateStudentNames();
                    
          const studentNameSelectBox = document.getElementById('studentName');
          studentNameSelectBox.value = tempStudent['Student ID'];
          studentNameSelectBox.dispatchEvent(new Event('change'));
                    
          showToast("", `${tempStudent['Student Name']} added successfully!`, 5000);
          playNotificationSound("success");
          busyFlag = false;
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
          
          if (errorString.includes("401")) {
            sessionError();
          } else {
            showError(error.message);
          }
          busyFlag = false;
        })
      .addStudentData(newStudentArray);
    }
  }

  function addStudentErrorCheck() {
    const firstName = document.getElementById('addFirstName').value;
    const lastName = document.getElementById('addLastName').value;
    const gender = document.getElementById('addGender').value;
    const dateOfBirth = document.getElementById('addDateOfBirth').value;
    const grade = document.getElementById('addGrade').value;
    const classroom = document.getElementById('addClassroom').value;
    const specializedInstruction = document.getElementById('addSpecializedInstruction').value;
    const caseManager = document.getElementById('addCaseManager').value;
    const parentGuardianName1 = document.getElementById('addParentGuardianName1').value;
    const parentGuardianPhone1 = document.getElementById('addParentGuardianPhone1').value;
    const parentGuardianEmail1 = document.getElementById('addParentGuardianEmail1').value;
    const parentGuardianName2 = document.getElementById('addParentGuardianName2').value;
    const parentGuardianPhone2 = document.getElementById('addParentGuardianPhone2').value;
    const parentGuardianEmail2 = document.getElementById('addParentGuardianEmail2').value;

    const parent1Valid = parentGuardianName1 && parentGuardianPhone1 && parentGuardianEmail1;
    const parent2Valid = parentGuardianName2 && parentGuardianPhone2 && parentGuardianEmail2;

    // Define regular expression patterns for error handling
    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!firstName) {
      showError("Error: MISSING_FIRST_NAME");
      return true;
    }
    
    if (!lastName) {
      showError("Error: MISSING_LAST_NAME");
      return true;
    }

    if (!gender) {
      showError("Error: MISSING_GENDER");
      return true;
    }
    
    if (!dateOfBirth) {
      showError("Error: MISSING_DOB");
      return true;
    }

    if (!grade) {
      showError("Error: MISSING_GRADE");
      return true;
    }

    if (!classroom) {
      showError("Error: MISSING_CLASSROOM");
      return true;
    }

    if (!caseManager) {
      showError("Error: MISSING_CASE_MANAGER");
      return true;
    }

    // If neither Parent 1 nor Parent 2 is fully valid, show an error
    if (!parent1Valid && !parent2Valid) {
      showError("Error: MISSING_CONTACT");
      return true;
    }
    
    // Validate phone numbers
    if (parentGuardianPhone1 && !phonePattern.test(parentGuardianPhone1)) {
      showError("Error: INVALID_PHONE");
      return true;
    }
    if (parentGuardianPhone2 && !phonePattern.test(parentGuardianPhone2)) {
      showError("Error: INVALID_PHONE");
      return true;
    }

    // Validate emails
    if (parentGuardianEmail1 && !emailPattern.test(parentGuardianEmail1)) {
      showError("Error: INVALID_EMAIL");
      return true;
    }
    if (parentGuardianEmail2 && !emailPattern.test(parentGuardianEmail2)) {
      showError("Error: INVALID_EMAIL");
      return true;
    }

    return false;
  }

  ////////////////////
  // REMOVE STUDENT //
  ////////////////////

  async function removeStudent() {
    if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        return;
    }
    
    if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
    }

    if (removeStudentErrorCheck()) {
        return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
      showError("Error: MISSING_STUDENT_ENTRY");
      return;
    }

    // Show confirmation modal
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to remove and archive the data for '${selectedStudent['Student Name']}'?`;
    const title = `${warningIcon}Remove Student`;
    const buttonText = await showModal(title, message, "Cancel", "Remove");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and create a backup of the student data
    busyFlag = true;
    const selectedIndex = studentNameSelectBox.selectedIndex;

    // Show progress toast
    showToast("", "Removing and archiving student...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        // Update the UI
        if (selectedIndex >= 0) {
          studentNameSelectBox.remove(selectedIndex);
          studentNameSelectBox.selectedIndex = -1;
        }
            
        STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
        updateStudentNames();
            
        const toastMessage = `'${selectedStudent['Student Name']}' removed and archived successfully!`;
        showToast("", toastMessage, 5000);
        playNotificationSound("remove");
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError(error.message);
        }
        busyFlag = false;
      })
      .removeStudentData(selectedStudentID);
  }

  function removeStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  ////////////////////
  // RENAME STUDENT //
  ////////////////////
  
  async function renameStudent() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    const studentNameSelectBox = document.getElementById('studentName');

    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    // Get the selected student ID and data
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
        showError("Error: MISSING_STUDENT_ENTRY");
        return;
    }

    // Store the current name
    const oldStudentName = selectedStudent['Student Name'];

    // Update modal with current name
    document.getElementById('currentStudentName').innerHTML = oldStudentName;

    // Show the rename modal
    showHtmlModal("renameStudentModal");
    const renameStudentModalButton = document.getElementById("renameStudentModalButton");
    
    renameStudentModalButton.onclick = async function() {
        busyFlag = true;

        if (renameStudentErrorCheck()) {
            busyFlag = false;
            return;
        }

        // Get new name data
        const firstName = document.getElementById('renameFirst').value;
        const lastName = document.getElementById('renameLast').value;
        const newStudentName = lastName + ", " + firstName;

        // Close modal immediately
        closeHtmlModal("renameStudentModal");
        
        // Show initial toast
        showToast("", "Renaming student...", 5000);

        // Save to Google Sheets
        google.script.run
          .withSuccessHandler(() => {
            selectedStudent['Student Name'] = newStudentName;
            updateStudentNames();
            
            // Switch to renamed student
            studentNameSelectBox.value = selectedStudentID;
            studentNameSelectBox.dispatchEvent(new Event('change'));
            
            showToast("", `${oldStudentName} renamed to ${newStudentName} successfully!`, 5000);
            playNotificationSound("success");
            busyFlag = false;
          })
          .withFailureHandler((error) => {
            const errorString = String(error);
        
            if (errorString.includes("401")) {
              sessionError();
            } else {
              showError(error.message);
            }
            busyFlag = false;
          })
        .renameStudent(dataFlag, selectedStudentID, newStudentName);
    };
  }

  function renameStudentErrorCheck() {
    const firstNameInput = document.getElementById('renameFirst').value;
    const lastNameInput = document.getElementById('renameLast').value;
    
    if (!firstNameInput) {
      showError("Error: MISSING_FIRST_NAME");
      return true;
    }

    if (!lastNameInput) {
      showError("Error: MISSING_LAST_NAME");
      return true;
    }
    
    return false;
  }

  /////////////////////
  // RESTORE STUDENT //
  /////////////////////

  async function restoreStudent() {
    if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        return;
    }
    
    if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
    }

    if (restoreStudentErrorCheck()) {
        busyFlag = false;
        return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedIndex = studentNameSelectBox.selectedIndex;

    if (selectedIndex < 0) {
        return;
    }

    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudentName = studentNameSelectBox.options[selectedIndex].text;

    // Show confirmation modal with warning icon
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to restore the data for '${selectedStudentName}'?`;
    const title = `${warningIcon}Restore Student`;

    const buttonText = await showModal(title, message, "Cancel", "Restore");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and store backup
    busyFlag = true;

    // Show progress toast
    showToast("", "Restoring student...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
        updateStudentNames();

        showToast("", `'${selectedStudentName}' restored successfully!`, 5000);
        playNotificationSound("success");
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .restoreStudentData(selectedStudentID);
  }

  function restoreStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE STUDENT //
  ////////////////////
  
  async function deleteStudent() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    if (deleteStudentErrorCheck()) {
      busyFlag = false;
      return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudent = studentNameSelectBox.options[studentNameSelectBox.selectedIndex].text;
    const selectedStudentID = studentNameSelectBox.value;

    // Show confirmation modal with warning icon
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to delete the profile and meeting data for '${selectedStudent}'? This action cannot be undone.`;
    const title = `${warningIcon}Delete Student`;

    const buttonText = await showModal(title, message, "Cancel", "Delete");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and store backup
    busyFlag = true;
    const selectedIndex = studentNameSelectBox.selectedIndex;
    const associatedMeetings = MEETING_DATA.filter(meeting => meeting['Student ID'] === selectedStudentID);

    // Show progress toast
    showToast("", "Deleting student and meetings...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        if (selectedIndex >= 0) {
          studentNameSelectBox.remove(selectedIndex);
          studentNameSelectBox.selectedIndex = -1;
        }

        // Remove student with the selected ID from STUDENT_DATA
        STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
                      
        // Remove associated meetings from MEETING_DATA
        MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Student ID'] !== selectedStudentID);

        updateStudentNames();
                  
        const toastMessage = `'${selectedStudent}' and associated meetings deleted successfully!`;
        playNotificationSound("remove");
        showToast("", toastMessage, 5000);
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .deleteStudentData(selectedStudentID);
  }

  function deleteStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  /////////////////
  // ADD MEETING //
  /////////////////

  async function addMeeting() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    // Check if a student is selected
    const studentID = document.getElementById('studentName').value;
    if (!studentID) {
      showError("Error: MISSING_STUDENT_DATA");
      return;
    }

    // Show the Add Meeting modal
    showHtmlModal("addMeetingModal");

    const addMeetingModalButton = document.getElementById("addMeetingModalButton");

    addMeetingModalButton.onclick = async function() {
      busyFlag = true;

      if (addMeetingErrorCheck()) {
        busyFlag = false;
        return;
      }

      // Get student data
      const studentNameSelectBox = document.getElementById('studentName');
      const selectedStudentID = studentNameSelectBox.value;
      const student = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

      // Create the new meeting object
      const newMeeting = {
        'Student ID': student['Student ID'],
        'Student Name': student['Student Name'],
        'Date': document.getElementById('addMeetingDate').value,
        'Type': document.getElementById('addMeetingType').value,
        'Attendees': document.getElementById('addAttendees').value,
        'Facilitator': document.getElementById('addFacilitator').value,
        'Scribe': document.getElementById('addScribe').value,
        'Areas Of Strength': "",
        'Areas Of Concern': "",
        'Action Plan': "",
        'Next Date': "",
        'Next Time': ""
      };

      // Close the modal and show progress toast
      closeHtmlModal("addMeetingModal");
      showToast("", "Adding meeting...", 5000);

      // Get meeting ID
      await getAvailableID();
      const meetingID = cachedID;
      newMeeting['Meeting ID'] = meetingID;

      // Prepare data for Google Sheets
      const newMeetingArray = [
        meetingID,
        newMeeting['Student ID'],
        newMeeting['Student Name'],
        newMeeting['Date'],
        newMeeting['Type'],
        newMeeting['Attendees'],
        newMeeting['Facilitator'],
        newMeeting['Scribe']
      ];

      // Attempt to save to Google Sheets
      google.script.run
        .withSuccessHandler(() => {
          MEETING_DATA.push(newMeeting);
          studentNameSelectBox.value = selectedStudentID;
          studentNameSelectBox.dispatchEvent(new Event('change'));

          showToast("", "Meeting added successfully!", 5000);
          playNotificationSound("success");
          busyFlag = false;
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
        
          if (errorString.includes("401")) {
            sessionError();
          } else {
            showError(error.message);
          }
          busyFlag = false;
        })
      .addMeetingData(newMeetingArray);
    };
  }


  function addMeetingErrorCheck() {
    const meetingDate = document.getElementById('addMeetingDate').value;
    const meetingType = document.getElementById('addMeetingType').value;
    const meetingAttendees = document.getElementById('addAttendees').value;
    const meetingFacilitator = document.getElementById('addFacilitator').value;
    const meetingScribe = document.getElementById('addScribe').value;

    if (!meetingDate) {
      showError("Error: MISSING_MEETING_DATE");
      return true;
    }
    if (!meetingType) {
      showError("Error: MISSING_MEETING_TYPE");
      return true;
    }
    if (!meetingAttendees) {
      showError("Error: MISSING_ATTENDEES");
      return true;
    }
    if (!meetingFacilitator) {
      showError("Error: MISSING_FACILITATOR");
      return true;
    }
    if (!meetingScribe) {
      showError("Error: MISSING_SCRIBE");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE MEETING //
  ////////////////////

  async function deleteMeeting() {
    if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        return;
    }
    
    if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
    }

    if (deleteMeetingErrorCheck()) {
        busyFlag = false;
        return;
    }

    // Get meeting data
    const meetingNameSelectBox = document.getElementById('meetingName');
    const meetingID = meetingNameSelectBox.value;
    const selectedMeeting = MEETING_DATA.find(meeting => meeting['Meeting ID'] === meetingID);

    if (!selectedMeeting) {
      showError("Error: MISSING_MEETING_ENTRY");
      return;
    }

    // Format meeting information for confirmation modal
    const meetingDate = formatDate(selectedMeeting['Date']);
    const meetingName = `${meetingDate} - ${selectedMeeting['Type']}`;
    
    // Show confirmation modal
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to delete the meeting '${meetingName}'? This action cannot be undone.`;
    const title = `${warningIcon}Delete Meeting`;
    const buttonText = await showModal(title, message, "Cancel", "Delete");
    
    if (buttonText === "Cancel") {
        return;
    }

    busyFlag = true;
    showToast("", "Deleting meeting...", 5000);

    google.script.run
      .withSuccessHandler(() => {
        meetingNameSelectBox.remove(meetingNameSelectBox.selectedIndex);
        meetingNameSelectBox.selectedIndex = -1;
        MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Meeting ID'] !== meetingID);
                  
        // Refresh the meeting list for the selected student
        const studentID = document.getElementById('studentName').value;
        updateMeetingNames(studentID);
                
        const toastMessage = `'${meetingName}' deleted successfully!`;
        playNotificationSound("remove");
        showToast("", toastMessage, 5000);
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .deleteMeetingData(meetingID);
  }

  function deleteMeetingErrorCheck() {
    const meetingNameSelectBox = document.getElementById('meetingName');
    
    if (meetingNameSelectBox.options.length === 0) {
      showError("Error: MISSING_MEETING_DATA");
      return true;
    }

    return false;
  }

  ///////////////////
  // COMPOSE EMAIL //
  ///////////////////

  async function composeEmail() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    // Prevent add email modal from being shown if no student selected
    const studentID = document.getElementById('studentName').value;

    if (!studentID) {
      showError("Error: MISSING_STUDENT_DATA");
      return;
    }
    
    // Reset the warning before the modal is opened
    document.getElementById('templateWarning').style.display = 'none';
    showHtmlModal("emailModal");

    const sendEmailModalButton = document.getElementById('sendEmailModalButton');
    sendEmailModalButton.onclick = async function() {
      busyFlag = true;
        
      if (sendEmailErrorCheck()) {
        busyFlag = false;
        return;
      }

      const template = document.getElementById('templateSelect').value;
      const recipient = document.getElementById('emailRecipient').value;
      const subject = document.getElementById('emailSubject').value;
      const body = document.getElementById('emailBody').innerHTML;
      let attachments = [];
        
      closeHtmlModal("emailModal");

      try {
        const toastMessage = template === "summary" 
          ? "Attaching meeting summary and sending email..." 
          : "Sending email...";
        const toastDuration = template === "summary" ? 10000 : 5000;
        
        showToast("", toastMessage, toastDuration);

        if (template === "summary") {
          attachments = await generateMeetingSummaryPDF();
        }

        google.script.run
          .withSuccessHandler(() => {
            playNotificationSound("success");
            showToast("", "Email successfully sent to: " + recipient, 10000);
          })
          .withFailureHandler((error) => {
            const errorString = String(error);
        
            if (errorString.includes("401")) {
              sessionError();
            } else {
              showError(error.message);
            }
          })
        .createEmail(recipient, subject, body, attachments);
      } catch {
        showError("Error: EMAIL_FAILURE");
      } finally {
        busyFlag = false;
      }
    };
  }

  async function generateMeetingSummaryPDF() {
    const docDefinition = createMeetingSummary();
    const blob = await new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob(resolve);
    });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer); 
    return Array.from(uint8Array); // Convert to array for google.script.run
  }

  function getEmailTemplate() {
    // Get references to the selectbox and text areas
    const mergeData = getMergeData();
    const templateType = document.getElementById('templateSelect').value;
    const parentGuardianEmail1 = document.getElementById('parentGuardianEmail1').value;
    const parentGuardianEmail2 = document.getElementById('parentGuardianEmail2').value;
    const recipient = document.getElementById('emailRecipient');
    const subjectTemplate = document.getElementById('emailSubject');
    const bodyTemplate = document.getElementById('emailBody');
    
    // Reset template warning
    document.getElementById('templateWarning').style.display = 'none';

    // Extract email templates from APP_SETTINGS
    const emailTemplates = APP_SETTINGS.emailTemplateSettings;

    // Helper function to find a template by type (e.g., 'Initial', 'Reminder')
    const getTemplate = (type) => emailTemplates[type] || { subject: '', body: '' };

    // Determine the recipient email(s)
    if (parentGuardianEmail1 && parentGuardianEmail2) {
        recipient.value = `${parentGuardianEmail1}, ${parentGuardianEmail2}`;
    } else if (parentGuardianEmail1) {
        recipient.value = parentGuardianEmail1;
    } else if (parentGuardianEmail2) {
        recipient.value = parentGuardianEmail2;
    } else {
        recipient.value = ""; // In case both emails are empty
    }

    // Update the template content based on the selected option
    switch (templateType) {
      case 'referral':
        const referralTemplate = getTemplate('referral');
        subjectTemplate.value = referralTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(referralTemplate.body, mergeData);
        break;

      case 'initial':
        const initialTemplate = getTemplate('initial');
        subjectTemplate.value = initialTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(initialTemplate.body, mergeData);
        break;

      case 'reminder':
        const reminderTemplate = getTemplate('reminder');
        subjectTemplate.value = reminderTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(reminderTemplate.body, mergeData);
        break;

      case 'summary':
        const summaryTemplate = getTemplate('summary');
        subjectTemplate.value = summaryTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(summaryTemplate.body, mergeData);
        break;

      default:
        recipient.value = "";
        subjectTemplate.value = "";
        bodyTemplate.innerHTML = "";
        break;
    }
  }

  function getEmailBody(message, mergeData) {
    // Regular expression to match text within curly braces
    const regex = /{{([^}]+)}}/g;
    const warningIcon = `<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>`;

    // Use replace() to find and replace text within curly braces
    const bodyTemplate = message.replace(regex, (match, variableName) => {
      
      // Check if the variable exists in the provided mapping
      if (mergeData.hasOwnProperty(variableName)) {
        // Replace the variable with its corresponding value
        return mergeData[variableName];
      }
      else {
        // If the variable is not found, leave it unchanged
        return match;
      }
    });

    if (bodyTemplate.includes(warningIcon)) {
      document.getElementById('templateWarning').style.display = '';
    }

    return bodyTemplate;
  }

  function getMergeData() {
    // Split the student name into first and last
    const studentSelect = document.getElementById('studentName');
    const studentName = studentSelect.options[studentSelect.selectedIndex].text;
    let nameParts = studentName.match(/(.+),\s*(.+)/);
    let studentLastName = nameParts[1].trim();
    let studentFirstName = nameParts[2].trim();

    // Format meeting date
    const meetingDate = document.getElementById('meetingDate').value;
    const formattedMeetingDate = formatDate(meetingDate);

    // Format next meeting date
    const nextMeetingDate = document.getElementById('nextDate').value;
    const formattedNextMeetingDate = formatDate(nextMeetingDate);

    // Format screeningTime
    const nextMeetingTime = document.getElementById('nextTime').value;
    const formattedNextMeetingTime = formatTime(nextMeetingTime);

    // Create the mergeData object
    mergeData = {
      schoolYear: APP_SETTINGS.schoolSettings.schoolYear,
      studentLastName: studentLastName,
      studentFirstName: studentFirstName,
      caseManager: document.getElementById('caseManager').value,
      meetingDate: formattedMeetingDate,
      scheduledMeetingDate: formattedNextMeetingDate,
      scheduledMeetingTime: formattedNextMeetingTime
    };

    const warningIcon = `<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>`;

    // Add error icon to missing mergeData data
    Object.keys(mergeData).forEach(key => {
      if (mergeData[key] === "") {
        mergeData[key] = warningIcon;
      }
    });

    return mergeData;
  }

  function sendEmailErrorCheck() {
    const recipient = document.getElementById('emailRecipient').value;
    const body = document.getElementById('emailBody').innerHTML;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const warningIcon = '<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>';
    
    if (!recipient) {
      showError("Error: MISSING_RECIPIENT");
      return true;
    }

    const recipients = recipient.split(',');
    for (let i = 0; i < recipients.length; i++) {
      if (!emailPattern.test(recipients[i].trim())) {
        showError("Error: INVALID_EMAIL");
        return true;
      }
    }

    if (body.includes(warningIcon)) {
      showError("Error: MISSING_TEMPLATE_DATA")
      return true;
    }

    return false;
  }

  //////////////////
  // EXPORT FORMS //
  //////////////////

  function exportMeeting() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    if (exportMeetingSelectBox.options.length === 0) {
      showError("Error: MISSING_MEETING_DATA");
      return;
    }
    
    showHtmlModal("exportMeetingModal");
    const exportFormsModalButton = document.getElementById('exportMeetingModalButton');
    
    exportFormsModalButton.onclick = function() {
      busyFlag = true;
      const formType = document.getElementById('exportMeetingSelect').value;
      
      closeHtmlModal("exportMeetingModal");

      setTimeout(function() {
        pdfMake.createPdf(createMeetingSummary()).download('First Lutheran School - SST Meeting Summary.pdf');
        
        busyFlag = false;
      }, 100); // Short delay to allow UI update to process before PDF generation
    };
  }

  /////////////////
  // EXPORT DATA //
  /////////////////

  function exportData() {
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    showHtmlModal("exportDataModal");
    const exportDataModalButton = document.getElementById('exportDataModalButton');
    
    exportDataModalButton.onclick = function() {
      busyFlag = true;
    
      const dataType = document.getElementById('dataTypeSelect').value;
      const fileType = document.getElementById('fileTypeSelect').value;
      let fileName;

      if (dataType === 'activeData') {
        fileName = 'Active SST Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      } else if (dataType === 'archiveData') {
        fileName = 'Archive SST Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      }
      else {
        fileName = 'SST Meeting Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      }

      switch (fileType) {
        case 'csv':
          google.script.run
            .withSuccessHandler(function(data) {
              let a = document.createElement('a');
              
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(data);
              a.download = fileName + '.csv';
              a.click();
              busyFlag = false;
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getCsv(dataType);
          break;
        case 'xlsx':
          google.script.run
            .withSuccessHandler(function(data) {
              // Convert the raw data into a Uint8Array
              const uint8Array = new Uint8Array(data);
                      
              // Create a Blob from the binary data
              const blob = new Blob([uint8Array], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
              
              const url = URL.createObjectURL(blob);
              let a = document.createElement('a');
              a.href = url;
              a.download = fileName + '.xlsx';
              a.click();
              URL.revokeObjectURL(url);
              busyFlag = false;
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getXlsx(dataType);
          break;
      }
      
      closeHtmlModal("exportDataModal");
    };
  }

  //////////////////////////////
  // ARCHIVE/ACTIVE DATA VIEW //
  //////////////////////////////

  function toggleDataView() {
    if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        return;
    }

    if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
    }
    
    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    toolbar.style.display = 'none';
    page.style.display = 'none';
    loadingIndicator.style.display = 'block';
    
    dataFlag = (dataFlag === "active") ? "archive" : "active";

    let studentDataPromise;
    const header = document.getElementById('header-text');

    // Track if session error has been shown
    let sessionErrorShown = false;

    if (dataFlag === "archive") {
        header.innerText += " - Archive";
        studentDataPromise = new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler((error) => {
                    const errorString = String(error);
                    if (errorString.includes("401") && !sessionErrorShown) {
                        sessionErrorShown = true;
                        sessionError();
                    }
                    reject(error);
                })
                .getArchiveData();
        });
    } else {
        header.innerText = header.innerText.replace(" - Archive", "");
        studentDataPromise = new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler((error) => {
                    const errorString = String(error);
                    if (errorString.includes("401") && !sessionErrorShown) {
                        sessionErrorShown = true;
                        sessionError();
                    }
                    reject(error);
                })
                .getActiveData();
        });
    }

    const meetingDataPromise = new Promise((resolve, reject) => {
        google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler((error) => {
                const errorString = String(error);
                if (errorString.includes("401") && !sessionErrorShown) {
                    sessionErrorShown = true;
                    sessionError();
                }
                reject(error);
            })
            .getMeetingData();
    });

    Promise.all([studentDataPromise, meetingDataPromise])
        .then(([studentData, meetingData]) => {
            STUDENT_DATA = studentData;
            MEETING_DATA = meetingData;
            
            if (dataFlag === "active") {
                document.getElementById('addStudentButton').style.display = "block";
                document.getElementById('removeStudentButton').style.display = "block";
                document.getElementById('restoreStudentButton').style.display = "none";
                document.getElementById('deleteStudentButton').style.display = "none";
                document.getElementById('meetingButton').style.display = 'block';
                document.getElementById('emailButton').style.display = "block";
                document.getElementById('archiveButton').style.display = "block";
                document.getElementById('backButton').style.display = "none";
            } else {
                document.getElementById('addStudentButton').style.display = "none";
                document.getElementById('removeStudentButton').style.display = "none";
                document.getElementById('restoreStudentButton').style.display = "block";
                document.getElementById('deleteStudentButton').style.display = "block";
                document.getElementById('meetingButton').style.display = 'none';
                document.getElementById('emailButton').style.display = "none";
                document.getElementById('archiveButton').style.display = "none";
                document.getElementById('backButton').style.display = "block";
            }

            document.getElementById('profileSearch').value = '';
            updateStudentNames();

            loadingIndicator.style.display = 'none';
            toolbar.style.display = 'block';
            page.style.display = 'flex';
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            // Make sure UI is restored even on error
            loadingIndicator.style.display = 'none';
            toolbar.style.display = 'block';
            page.style.display = 'flex';
            
            // Show generic error if not already handled by sessionError
            if (!sessionErrorShown) {
                showError("Error: DATABASE_FAILURE");
            }
        });
  }
  
  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  // Build the 'studentName' select box with student names
  function updateStudentNames() {
    const studentNameSelectBox = document.getElementById('studentName');
    studentNameSelectBox.innerHTML = ''; // Reset selectbox options
    
    if (Object.keys(STUDENT_DATA).length === 0) {
      console.warn("WARNING: No student data found.");
      document.getElementById('profileDataTable').style.display = 'none';
      document.getElementById('profileWarning').style.display = '';
    } else {
      document.getElementById('profileDataTable').style.display = '';
      document.getElementById('profileWarning').style.display = 'none';
    }

    const sortedStudentData = STUDENT_DATA.sort(function(a, b) {
      return a['Student Name'].localeCompare(b['Student Name']);
    });
    
    sortedStudentData.forEach(function(item) {
      let option = document.createElement('option');
      option.text = item['Student Name'];
      option.value = item['Student ID'];
      studentNameSelectBox.add(option);
    });

    // If there are students, set the first one as selected by default
    if (studentNameSelectBox.options.length > 0) {
      studentNameSelectBox.value = sortedStudentData[0]['Student ID']; // Default to first student
      studentNameSelectBox.dispatchEvent(new Event('change')); // Trigger 'change' event
    } else {
      updateStudentData(); // Clear student data if no options
    }
  }
  
  // Update student profile fields
  function updateStudentData(selectedStudentID) {
    const clearAll = !selectedStudentID || selectedStudentID === "";
    
    let student = clearAll ? {} : STUDENT_DATA.find(function(item) {
      return item['Student ID'] === selectedStudentID;
    });

    Object.keys(STUDENT_KEY_MAPPINGS).forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = clearAll || !student || student[STUDENT_KEY_MAPPINGS[id]] === undefined ? "" : student[STUDENT_KEY_MAPPINGS[id]];
      }
    });

    // Update colors in student profile fields
    updateColors();

    // Update the meetings based on the selected student's student ID
    if (student && student['Student ID']) {
      updateMeetingNames(student['Student ID']);  // Pass the Student ID to update the meetings
    } else {
      updateMeetingNames();
    }
    
    const saveChangesButton = document.getElementById('saveChangesButton');
    saveChangesButton.classList.remove('tool-bar-button-unsaved');
    saveFlag = true;
    previousStudentID = selectedStudentID;
  }

  // Build the 'meetingName' select box with meeting names filtered by student
  function updateMeetingNames(selectedStudentID) {
    const meetingNameSelectBox = document.getElementById('meetingName');
    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    meetingNameSelectBox.innerHTML = '';
    exportMeetingSelectBox.innerHTML = '';

    if (Object.keys(MEETING_DATA).length === 0) {
      console.warn("WARNING: No meeting data found.");
    }

    // Filter meetings by the selected student's Student ID
    const filteredMeetings = MEETING_DATA.filter(function(item) {
      return item['Student ID'] === selectedStudentID;
    }).sort(function(a, b) {
      return b['Date'].localeCompare(a['Date']);
    });

    // Show the warning and hide the meeting input if no meetings are found for the student
    if (filteredMeetings.length === 0) {
      console.warn("WARNING: No meeting data found for this student.");
      document.getElementById('meetingDataTable').style.display = 'none';
      document.getElementById('meetingWarning').style.display = '';
    } 
    else {
      document.getElementById('meetingDataTable').style.display = '';
      document.getElementById('meetingWarning').style.display = 'none';
    }

    // Add the filtered meetings to the meeting select box
    filteredMeetings.forEach(function(item) {
      let option = document.createElement('option');
      option.text = formatDate(item['Date']) + " - " + item['Type'];
      option.value = item['Meeting ID'];
      meetingNameSelectBox.add(option);
    });

    // Add the filtered meetings to the export select box
    filteredMeetings.forEach(function(item) {
      let option = document.createElement('option');
      option.text = formatDate(item['Date']) + " - " + item['Type'];
      option.value = item['Meeting ID'];
      exportMeetingSelectBox.add(option);
    });

    // Update meeting information for the first filtered meeting
    if (meetingNameSelectBox.options.length > 0) {
      let selectedMeeting = meetingNameSelectBox.options[0].value;
      meetingNameSelectBox.dispatchEvent(new Event('change')); // Trigger 'change' event
    } else {
      updateMeetingData();
    }
  }

  // Update meeting fields
  function updateMeetingData(selectedMeeting) {
    const clearAll = !selectedMeeting || selectedMeeting === "";
    
    let meeting = clearAll ? {} : MEETING_DATA.find(function(item) {
      return item['Meeting ID'] === selectedMeeting;
    });

    Object.keys(MEETING_KEY_MAPPINGS).forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
          element.value = clearAll || !meeting || meeting[MEETING_KEY_MAPPINGS[id]] === undefined ? "" : meeting[MEETING_KEY_MAPPINGS[id]];
      }
    });

    const saveChangesButton = document.getElementById('saveChangesButton');
    saveChangesButton.classList.remove('tool-bar-button-unsaved');
    saveFlag = true;
    previousMeetingID = selectedMeeting;

  }

  function getIDCache() {
    return new Promise((resolve, reject) => {  // Add reject parameter
      google.script.run
        .withSuccessHandler((idCache) => {
          // Convert to Set for O(1) lookup and find first missing number
          const idSet = new Set(idCache.map(id => parseInt(id, 10)));
               
          // Start from 1 and find first missing number
          let i = 1;
          while (idSet.has(i)) i++;
                
          // Format and return the result
          resolve(i.toString().padStart(6, '0'));
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
                
          if (errorString.includes("401")) {
            sessionError();
          } else {
            showError("Error: ID_FAILURE");
          }
          busyFlag = false;
          reject(error);  // Reject the promise so the error propagates
        })
      .getIDCache();
    });
  }

  async function getAvailableID() {
    cachedID = await getIDCache();
  }

  function saveAlert() {
    saveFlag = false;
    saveChangesButton.classList.add('tool-bar-button-unsaved');
  }

  ////////////////////
  // ERROR HANDLING //
  ////////////////////

  function showError(errorType, callback = "") {
    const warningIcon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>`;
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "Error: OPERATION_IN_PROGRESS":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;
      
      // Save errors
      case "Error: UNSAVED_CHANGES":
        title = warningIcon + "Unsaved Changes";
        message = "There are unsaved changes. Please save the changes and try again.";
        button1 = "Close";
        break;
      
      // Add student errors
      case "Error: MISSING_FIRST_NAME":
        title = warningIcon + "Missing First Name";
        message = "Please enter a first name and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_LAST_NAME":
        title = warningIcon + "Missing Last Name";
        message = "Please enter a last name and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_GENDER":
        title = warningIcon + "Missing Gender";
        message = "Please select a gender and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_DOB":
        title = warningIcon + "Missing Date Of Birth";
        message = "Please enter a date of birth and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_GRADE":
        title = warningIcon + "Missing Grade";
        message = "Please select a grade and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CLASSROOM":
        title = warningIcon + "Missing Classroom";
        message = "Please select a classroom and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CASE_MANAGER":
        title = warningIcon + "Missing Case Manager";
        message = "Please enter a case manager and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CONTACT":
        title = warningIcon + "Missing Parent/Guardian Contact";
        message = "At least one parent/guardian name, phone, and email must be filled in. Please check the parent/guardian information and try again.";
        button1 = "Close";
        break;

      case "Error: INVALID_PHONE":
        title = warningIcon + "Invalid Phone Number";
        message = "Please check the parent/guardian phone number and try again.";
        button1 = "Close";
        break;

      // Add meeting errors
      case "Error: MISSING_MEETING_DATE":
        title = warningIcon + "Missing Meeting Date";
        message = "Please enter a meeting date and try again.";
        button1 = "Close";
        break;
      
      case "Error: MISSING_MEETING_TYPE":
        title = warningIcon + "Missing Meeting Type";
        message = "Please select a meeting type and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_ATTENDEES":
        title = warningIcon + "Missing Attendees";
        message = "Please enter the meeting attendees and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_FACILITATOR":
        title = warningIcon + "Missing Facilitator";
        message = "Please enter a meeting facilitator and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_SCRIBE":
        title = warningIcon + "Missing Scribe";
         message = "Please enter a meeting scribe and try again.";
        button1 = "Close";
        break;

      // Database errors
      case "Error: MISSING_STUDENT_DATA":
        title = errorIcon + "Data Error";
        message = "No student data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_MEETING_DATA":
        title = errorIcon + "Data Error";
        message = "No meeting data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_STUDENT_ENTRY":
        title = errorIcon + "Data Error";
        message = "The student data could not be found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_MEETING_ENTRY":
        title = errorIcon + "Data Error";
        message = "The meeting data could not be found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: DUPLICATE_ENTRY":
        title = errorIcon + "Data Error";
        message = "Duplicate data was found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      // Email errors
      case "Error: MISSING_RECIPIENT":
        title = warningIcon + "Missing Email Recipient";
        message = "Please enter an email address and try again.";
        button1 = "Close";
        break;
      
      case "Error: INVALID_EMAIL":
        title = warningIcon + "Invalid Email Address";
        message = "Please check the email address and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_TEMPLATE_DATA":
        title = errorIcon + "Email Error";
        message = "Missing email template data. The operation could not be completed.";
        button1 = "Close";
        break; 

      case "Error: QUOTA_LIMIT":
        title = errorIcon + "Email Error";
        message = "The daily email limit has been reached. Please wait 24 hours before sending your email and try again.";
        button1 = "Close";
        break;

      // Unknown errors
      case "Error: EMAIL_FAILURE":
        title = errorIcon + "Email Error";
        message = "An unknown email error occurred. The operation could not be completed.";
        button1 = "Close";
        break;
      
      case "Error: EXPORT_FAILURE":
        title = errorIcon + "Export Error";
        message = "An unknown error occurred while exporting data. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: ID_FAILURE":
        title = errorIcon + "ID Error";
        message = "An unknown error occurred while fetching ID's. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: DATABASE_FAILURE":
        title = errorIcon + "Database Error";
        message = "An unknown error occurred while connecting with the database. The operation could not be completed.";
        button1 = "Close";
        break;
    }
    
    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
  
  async function sessionError() {
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    const title = `${errorIcon}Session Expired`;
    const message = "The current session has expired. Please sign in with Google and try again.";
    
    playNotificationSound("alert");
    const buttonText = await showModal(title, message, "Cancel", "Sign in");
       
    if (buttonText === "Sign in") {
      const signInUrl = "https://accounts.google.com";
      const signInTab = window.open(signInUrl, "_blank");
    }
  }
  
  /////////////////////
  // DATA VALIDATION //
  /////////////////////

  // Function to format phone number inputs
  function formatPhoneNumber(input) {
    // Remove all non-digit characters from the input value
    let inputValue = input.value.replace(/\D/g, "");

    // Limit the input value to 10 digits
    inputValue = inputValue.slice(0, 10);

    // Format the input value as '(XXX) XXX-XXXX'
    let formattedValue = '';
    for (let i = 0; i < inputValue.length; i++) {
      if (i === 0) {
        formattedValue += '(';
      } else if (i === 3) {
        formattedValue += ') ';
      } else if (i === 6) {
        formattedValue += '-';
      }
      formattedValue += inputValue[i];
    }

    // Update the input value with the formatted value
    input.value = formattedValue;
  }

  // Function to format date
  function formatDate(dateString) {
    if (!dateString) {
      return '';
    } else {
      // Split the date string into components
      const [year, month, day] = dateString.split('-').map(Number);

      // Create a date object using the local time zone
      const date = new Date(year, month - 1, day);

      // Format the date as 'MM/DD/YYYY'
      const options = { month: 'numeric', day: 'numeric', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
  }

  // Function to format time
  function formatTime(timeString) {
    if (!timeString) {
      return '';
    } else {
      let hours = parseInt(timeString.split(':')[0]);
      let minutes = timeString.split(':')[1];
      let amPm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; // Convert hours to 12-hour format
      return `${hours}:${minutes} ${amPm}`;
    }
  }

  function updateColors() {
    const selectColorElements = document.querySelectorAll('#gender, #dateOfBirth, #grade, #classroom, #specializedInstruction');
    const inputColorElements = document.querySelectorAll('#allergies, #medications, #dietaryRestrictions, #diagnoses, #servicesPrograms, #caseManager, #roi1, #roi2, #roi3, #parentGuardianName1, #parentGuardianPhone1, #parentGuardianEmail1, #parentGuardianName2, #parentGuardianPhone2, #parentGuardianEmail2');
    const noColorElements = document.querySelectorAll('#notes, #meetingName, #meetingDate, #meetingType, #attendees, #facilitator, #scribe, #strengthsInput, #concernsInput, #actionPlan, #nextDate, #nextTime');

    selectColorElements.forEach(element => {
      element.style.backgroundColor = getColor(element);
    });
    
    inputColorElements.forEach(element => {
      element.style.backgroundColor = getColor(element);
    });
  }

  // Get select box/input box color based on value
  function getColor(element) {
    const value = element.value.trim(); // Trim to remove extra spaces

    if (!value) { // Checks for "", null, undefined, 0, etc.
      return '';
    }

    // Define patterns for phone and email validation
    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validation for phone numbers
    if ((element.id === 'parentGuardianPhone1' || element.id === 'parentGuardianPhone2') && !phonePattern.test(value)) {
      return '';  // No color if phone format is invalid
    }

    // Validation for emails
    if ((element.id === 'parentGuardianEmail1' || element.id === 'parentGuardianEmail2') && !emailPattern.test(value)) {
      return '';  // No color if email format is invalid
    }

    // Check for specific values
    switch (value) {
      case "Male":
        return 'var(--blue)';
      case "Female":
        return 'var(--pink)';
      case "Non-binary":
        return 'var(--gray)';
      case "504":
      case "IEP":
        return 'var(--orange)';
      default:
        // ID-based coloring rules
        if (value && (
          element.id === 'allergies' || 
          element.id === 'medications' || 
          element.id === 'dietaryRestrictions' ||  
          element.id === 'diagnoses' || 
          element.id === 'servicesPrograms' || 
          element.id === 'roi1' || 
          element.id === 'roi2' || 
          element.id === 'roi3')
        ) {
          return 'var(--orange)';
        }
        // Default color for non-specified cases
        return 'var(--green)';
    }
  }

</script>
