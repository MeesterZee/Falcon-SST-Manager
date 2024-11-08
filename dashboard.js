<script type="text/javascript">
  // Global constants
  const STUDENT_KEY_MAPPINGS = {
    // Basic information
    'gender': 'Gender', 'dateOfBirth': 'Date Of Birth', 'grade': 'Grade', 'classroom': 'Classroom', 'allergies': 'Allergies', 'medications': 'Medications', 'dietaryRestrictions':'Dietary Restrictions', 'servicesPrograms': 'Services/Programs', 'specializedInstruction': 'Specialized Instruction', 'caseManager': 'Case Manager', 'roi1': 'ROI Organization 1', 'roi2': 'ROI Organization 2', 'roi3': 'ROI Organization 3', 'parentGuardianName1': 'Parent/Guardian Name 1', 'parentGuardianPhone1': 'Parent/Guardian Phone 1', 'parentGuardianEmail1': 'Parent/Guardian Email 1', 'parentGuardianName2': 'Parent/Guardian Name 2', 'parentGuardianPhone2': 'Parent/Guardian Phone 2', 'parentGuardianEmail2': 'Parent/Guardian Email 2', 'notes': 'Notes'
  };

  const MEETING_KEY_MAPPINGS = {
    'meetingDate': 'Date', 'meetingType': 'Type', 'attendees': 'Attendees', 'facilitator': 'Facilitator', 'scribe': 'Scribe', 'strengthsInput': 'Areas Of Strength', 'concernsInput': 'Areas Of Concern', 'actionPlanInput': 'Action Plan', 'nextDate': 'Next Date', 'nextTime': 'Next Time'
  };

  // Global variables
  let STUDENT_DATA;
  let MEETING_DATA;
  let APP_SETTINGS;
  let previousStudentID;
  let previousMeetingID;
  let cachedID = null;
  
  // Global flags
  let dataFlag = "active";
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
        showError("unsavedChanges");
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
        showError("unsavedChanges");
        meetingNameSelectBox.value = previousMeetingID;
      }
      else {
        updateMeetingData(currentMeeting);
      }
    });

    // Add event listeners for select boxes
    const selectIds = document.querySelectorAll('#gender, #grade, #classroom, #meetingType');

    selectIds.forEach(selectBox => {
      selectBox.addEventListener('change', () => {
        saveAlert();
      });
    });
    
    // Add event listeners for input boxes
    const inputIds = document.querySelectorAll('#dateOfBirth, #allergies, #medications, #dietaryRestrictions, #servicesPrograms, #specializedInstruction, #caseManager, #roi1, #roi2, #roi3, #parentGuardianName1, #parentGuardianPhone1, #parentGuardianEmail1, #parentGuardianName2, #parentGuardianPhone2, #parentGuardianEmail2, #notes, #meetingDate, #attendees, #facilitator, #scribe, #strengthsInput, #strengthsReporter, #concernsInput, #concernsReporter, #actionPlanInput, #nextDate, #nextTime');
    
    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    inputIds.forEach(input => {
      input.addEventListener('input', () => {
        saveAlert();
        if (input.id === 'parentGuardianPhone1' || input.id === 'parentGuardianPhone2') {
          saveAlert();
          formatPhoneNumber(input);
        } 
        else {
          saveAlert();
        }
      });
    });

    // Allow deletion of select box entry, except for Student Name and modal selects
    document.querySelectorAll("select:not(#studentName, #meetingName)").forEach(function(select) {
      select.addEventListener("keydown", function(event) {
        if (event.key === "Backspace" || event.key === "Delete") {
          if (!select.closest("#addStudentModal")) {
            saveAlert();
          }
          select.value = '';
        }
      });
    });

    // Add event listener for phone number inputs
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
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    if (studentNameSelectBox.options.length === 0) {
      showError("missingStudentData");
      return true;
    }
    
    const selectedStudentID = studentNameSelectBox.value;
    const selectedMeetingID = meetingName.value;

    let toastMessage;
    busyFlag = true;

    // Build the student data
    let student = STUDENT_DATA.find(item => item['Student ID'] === selectedStudentID);

    // Update STUDENT_DATA object with dashboard data
    STUDENT_DATA.forEach((item) => {
      if (item['Student ID'] === selectedStudentID) {
        Object.keys(STUDENT_KEY_MAPPINGS).forEach((id) => {
          const element = document.getElementById(id);
          if (element) {
            item[STUDENT_KEY_MAPPINGS[id]] = element.value;
          }
        });
      }
    });

    const studentDataArray = [[
      student['Student ID'],
      student['Student Name'],
      ...Object.keys(STUDENT_KEY_MAPPINGS).map(key => student[STUDENT_KEY_MAPPINGS[key]])
    ]];

    // Build the meeting data
    let meetingDataArray = [];

    // Check if the student has an associated meeting and if selectedMeetingID is valid
    if (selectedMeetingID && selectedMeetingID.trim() !== "") {
      let meeting = MEETING_DATA.find(item => item['Meeting ID'] === selectedMeetingID);

      // Only process meeting data if found
      if (meeting) {
        // Update MEETING_DATA object with dashboard data
        MEETING_DATA.forEach((item) => {
          if (item['Meeting ID'] === selectedMeetingID) {
            Object.keys(MEETING_KEY_MAPPINGS).forEach((id) => {
              const element = document.getElementById(id);
              if (element) {
                item[MEETING_KEY_MAPPINGS[id]] = element.value;
              } 
            });
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
    
    // Update the state of 'Save Changes' button
    const saveChangesButton = document.getElementById('saveChangesButton');
    saveChangesButton.classList.remove('tool-bar-button-unsaved');
    saveFlag = true;

    toastMessage = "Saving changes...";
    showToast("", toastMessage, 5000);
    
    // Show save confirmation toast
    google.script.run.withSuccessHandler(function(response) {
      if (response === "duplicateDatabaseEntry") {
        showError("duplicateDatabaseEntry");
      } 
      else if (response === "missingDatabaseEntry") {
        showError("missingDatabaseEntry");
      }
      else {
        toastMessage = "'" + student['Student Name'] + "' saved successfully!";
        playNotificationSound("success");
        showToast("", toastMessage, 5000);
      }
      busyFlag = false;
    }).saveStudentData(dataFlag, studentDataArray, meetingDataArray);
  }

  /////////////////
  // ADD STUDENT //
  /////////////////
  
  async function addStudent() {
    if (!saveFlag) {
        showError("unsavedChanges");
        return;
    }

    if (busyFlag) {
        showError("operationInProgress");
        return;
    }

    // Show the Add Student modal
    showHtmlModal("addStudentModal");

    const addStudentModalButton = document.getElementById("addStudentModalButton");

    addStudentModalButton.onclick = async function() {
        busyFlag = true;

        if (addStudentErrorCheck()) {
            busyFlag = false;
            return;
        }

        // Get the form data
        const firstName = document.getElementById('addFirstName').value;
        const lastName = document.getElementById('addLastName').value;
        const studentName = lastName + ", " + firstName;

        // Create student object without ID first
        const newStudent = {
            'Student Name': studentName,
            'Gender': document.getElementById('addGender').value,
            'Date Of Birth': document.getElementById('addDateOfBirth').value,
            'Grade': document.getElementById('addGrade').value,
            'Classroom': document.getElementById('addClassroom').value,
            'Allergies': document.getElementById('addAllergies').value,
            'Medications': document.getElementById('addMedications').value,
            'Dietary Restrictions': document.getElementById('addDietaryRestrictions').value,
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

        // Close the modal immediately
        closeHtmlModal("addStudentModal");
        
        // Show initial toast
        showToast("", "Adding student...", 5000);

        try {
            // Get student ID
            await getAvailableID();
            const studentID = cachedID;

            // Update student object with ID
            newStudent['Student ID'] = studentID;

            // Add to local data structure
            STUDENT_DATA.push(newStudent);

            // Prepare data for Google Sheets
            const newStudentArray = [
                studentID,
                newStudent['Student Name'],
                newStudent['Gender'],
                newStudent['Date Of Birth'],
                newStudent['Grade'],
                newStudent['Classroom'],
                newStudent['Allergies'],
                newStudent['Medications'],
                newStudent['Dietary Restrictions'],
                newStudent['Services/Programs'],
                newStudent['Specialized Instruction'],
                newStudent['Case Manager'],
                newStudent['ROI Organization 1'],
                newStudent['ROI Organization 2'],
                newStudent['ROI Organization 3'],
                newStudent['Parent/Guardian Name 1'],
                newStudent['Parent/Guardian Phone 1'],
                newStudent['Parent/Guardian Email 1'],
                newStudent['Parent/Guardian Name 2'],
                newStudent['Parent/Guardian Phone 2'],
                newStudent['Parent/Guardian Email 2'],
                '' // notes
            ];

            // Update UI before server operation
            updateStudentNames();
            const studentNameSelectBox = document.getElementById('studentName');
            studentNameSelectBox.value = studentID;
            studentNameSelectBox.dispatchEvent(new Event('change'));

            // Save to Google Sheets
            const response = await new Promise((resolve) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .addStudentData(newStudentArray);
            });

            if (!response) {
                // Remove from local data if save failed
                const index = STUDENT_DATA.findIndex(s => s['Student ID'] === studentID);
                if (index !== -1) {
                    STUDENT_DATA.splice(index, 1);
                    updateStudentNames();
                }
                showError("duplicateDatabaseEntry");
                busyFlag = false;
                return;
            }

            // Success handling
            showToast("", `${newStudent['Student Name']} added successfully!`, 5000);
            playNotificationSound("success");

        } catch (error) {
            console.error('Error adding student:', error);
            
            // Remove from local data if needed
            const index = STUDENT_DATA.findIndex(s => s['Student Name'] === newStudent['Student Name']);
            if (index !== -1) {
                STUDENT_DATA.splice(index, 1);
                updateStudentNames();
            }
            
            showError("addStudentError");
        } finally {
            busyFlag = false;
        }
    };
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
      showError("missingFirstName");
      return true;
    }
    
    if (!lastName) {
      showError("missingLastName");
      return true;
    }

    if (!gender) {
      showError("missingGender");
      return true;
    }
    
    if (!dateOfBirth) {
      showError("missingDateOfBirth");
      return true;
    }

    if (!grade) {
      showError("missingGrade");
      return true;
    }

    if (!classroom) {
      showError("missingClassroom");
      return true;
    }

    if (!specializedInstruction) {
      showError("missingSpecializedInstruction");
      return true;
    }

    if (!caseManager) {
      showError("missingCaseManager");
      return true;
    }

    // If neither Parent 1 nor Parent 2 is fully valid, show an error
    if (!parent1Valid && !parent2Valid) {
      showError("missingParentGuardianContact");
      return true;
    }
    
    // Validate phone numbers
    if (parentGuardianPhone1 && !phonePattern.test(parentGuardianPhone1)) {
      showError("invalidParentGuardianPhone");
      return true;
    }
    if (parentGuardianPhone2 && !phonePattern.test(parentGuardianPhone2)) {
      showError("invalidParentGuardianPhone");
      return true;
    }

    // Validate emails
    if (parentGuardianEmail1 && !emailPattern.test(parentGuardianEmail1)) {
      showError("invalidParentGuardianEmail");
      return true;
    }
    if (parentGuardianEmail2 && !emailPattern.test(parentGuardianEmail2)) {
      showError("invalidParentGuardianEmail");
      return true;
    }

    return false;
  }

  ////////////////////
  // REMOVE STUDENT //
  ////////////////////

  async function removeStudent() {
    // Guard clauses
    if (busyFlag) {
        showError("operationInProgress");
        return;
    }

    if (removeStudentErrorCheck()) {
        busyFlag = false;
        return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
        showError("missingStudentEntry");
        return;
    }

    try {
        // Show confirmation modal
        const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
        const message = `Are you sure you want to remove and archive the data for '${selectedStudent['Student Name']}'?`;
        const title = `${warningIcon}Remove Student`;
        const buttonText = await showModal(title, message, "Cancel", "Remove");
        
        if (buttonText === "Cancel") {
            return;
        }

        // Set busy flag and store backup
        busyFlag = true;
        const selectedIndex = studentNameSelectBox.selectedIndex;
        const removedStudent = { ...selectedStudent }; // Create a copy of the student data

        // Update UI
        if (selectedIndex >= 0) {
            studentNameSelectBox.remove(selectedIndex);
            studentNameSelectBox.selectedIndex = -1;
        }

        // Update data
        STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
        updateStudentNames();

        // Show progress toast
        showToast("", "Removing and archiving student...", 5000);

        // Server operation
        const response = await new Promise((resolve) => {
            google.script.run.withSuccessHandler(resolve).removeStudentData(selectedStudentID);
        });

        // Handle response
        if (response === "duplicateDatabaseEntry" || response === "missingDatabaseEntry") {
            // Rollback changes on error
            STUDENT_DATA.push(removedStudent);
            updateStudentNames();
            showError(response);
        } else {
            // Success notification
            const successMessage = `'${selectedStudent['Student Name']}' removed and archived successfully!`;
            playNotificationSound("remove");
            showToast("", successMessage, 5000);
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error('Error removing student:', error);
        showError("unexpectedError");
        
        // Attempt to restore state
        if (removedStudent) {
            STUDENT_DATA.push(removedStudent);
            updateStudentNames();
        }
    } finally {
        busyFlag = false;
    }
  }

  function removeStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("missingStudentData");
      return true;
    }

    return false;
  }

  ////////////////////
  // RENAME STUDENT //
  ////////////////////

  async function renameStudent() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    // Initial checks
    if (!saveFlag) {
        showError("unsavedChanges");
        return;
    }

    if (busyFlag) {
        showError("operationInProgress");
        return;
    }

    if (studentNameSelectBox.options.length === 0) {
        showError("missingStudentData");
        return;
    }

    // Get the selected student ID and data
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
        showError("missingStudentEntry");
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

        try {
            // Update local data first
            selectedStudent['Student Name'] = newStudentName;
            
            // Update UI immediately
            updateStudentNames();
            studentNameSelectBox.value = selectedStudentID;
            studentNameSelectBox.dispatchEvent(new Event('change'));
            updateStudentData(selectedStudentID);

            // Save to Google Sheets
            const response = await new Promise((resolve) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .renameStudent(dataFlag, selectedStudentID, newStudentName);
            });

            // Handle server response
            if (response === "duplicateDatabaseEntry" || response === "missingDatabaseEntry") {
                // Revert changes if server operation failed
                selectedStudent['Student Name'] = oldStudentName;
                updateStudentNames();
                studentNameSelectBox.value = selectedStudentID;
                studentNameSelectBox.dispatchEvent(new Event('change'));
                updateStudentData(selectedStudentID);
                
                showError(response);
                return;
            }

            // Success handling
            showToast("", `${oldStudentName} renamed to ${newStudentName} successfully!`, 5000);
            playNotificationSound("success");

        } catch (error) {
            console.error('Error renaming student:', error);
            
            // Revert changes
            selectedStudent['Student Name'] = oldStudentName;
            updateStudentNames();
            studentNameSelectBox.value = selectedStudentID;
            studentNameSelectBox.dispatchEvent(new Event('change'));
            updateStudentData(selectedStudentID);
            
            showError("renameStudentError");
        } finally {
            busyFlag = false;
        }
    };
  }

  function renameStudentErrorCheck() {
    const firstNameInput = document.getElementById('renameFirst').value;
    const lastNameInput = document.getElementById('renameLast').value;
    
    if (!firstNameInput) {
      showError("missingFirstName");
      return true;
    }

    if (!lastNameInput) {
      showError("missingLastName");
      return true;
    }
    
    return false;
  }

  /////////////////////
  // RESTORE STUDENT //
  /////////////////////

  async function restoreStudent() {
    // Guard clauses
    if (busyFlag) {
        showError("operationInProgress");
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

    try {
        const selectedStudentID = studentNameSelectBox.value;
        const selectedStudentName = studentNameSelectBox.options[selectedIndex].text;

        // Show confirmation modal with warning icon
        const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
        const message = `Are you sure you want to restore the data for '${selectedStudentName}'?`;
        const title = `${warningIcon} Restore Student`;
        
        const buttonText = await showModal(title, message, "Cancel", "Restore");
        
        if (buttonText === "Cancel") {
            return;
        }

        // Set busy flag and store backup
        busyFlag = true;
        
        // Update UI
        studentNameSelectBox.remove(selectedIndex);
        studentNameSelectBox.selectedIndex = -1;

        // Store backup and update data
        const removedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);
        
        if (removedStudent) {
            STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
        }

        updateStudentNames();

        // Show progress toast
        showToast("", "Restoring student...", 5000);

        // Server operation
        const response = await new Promise((resolve) => {
            google.script.run
                .withSuccessHandler(resolve)
                .restoreStudentData(selectedStudentID);
        });

        // Handle response
        if (response === "duplicateDatabaseEntry" || response === "missingDatabaseEntry") {
            // Rollback changes on error
            if (removedStudent) {
                STUDENT_DATA.push(removedStudent);
                updateStudentNames();
            }
            showError(response);
        } else {
            // Success notification
            const successMessage = `'${selectedStudentName}' restored successfully!`;
            playNotificationSound("success");
            showToast("", successMessage, 5000);
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error('Error restoring student:', error);
        showError("unexpectedError");
        
        // Attempt to restore state
        if (removedStudent) {
            STUDENT_DATA.push(removedStudent);
            updateStudentNames();
        }
    } finally {
        busyFlag = false;
    }
  }

  function restoreStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("missingStudentData");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE STUDENT //
  ////////////////////
  
  async function deleteStudent() {
    if (busyFlag) {
        showError("operationInProgress");
        return;
    }

    if (deleteStudentErrorCheck()) {
        busyFlag = false;
        return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
        showError("missingStudentEntry");
        return;
    }

    try {
      // Show confirmation modal with warning icon
      const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
      const message = `Are you sure you want to delete the profile and meeting data for '${selectedStudent['Student Name']}'? This action cannot be undone.`;
      const title = `${warningIcon} Delete Student`;
      const buttonText = await showModal(title, message, "Cancel", "Delete");
        
        if (buttonText === "Cancel") {
            return;
        }

        // Set busy flag and store backup
        busyFlag = true;
        const selectedIndex = studentNameSelectBox.selectedIndex;
        const removedStudent = { ...selectedStudent }; // Create a copy of the student data
        const associatedMeetings = MEETING_DATA.filter(meeting => meeting['Student ID'] === selectedStudentID);
        const removedMeetings = [...associatedMeetings]; // Create a copy of the associated meetings

        // Update UI
        if (selectedIndex >= 0) {
          studentNameSelectBox.remove(selectedIndex);
          studentNameSelectBox.selectedIndex = -1;
            
          // Update data
          STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
          MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Student ID'] !== selectedStudentID);
          updateStudentNames();

          // Show progress toast
          showToast("", "Deleting student and meetings...", 5000);

          // Server operation
          const response = await new Promise((resolve) => {
            google.script.run.withSuccessHandler(resolve).deleteStudentData(selectedStudentID);
          });

          // Handle response
          if (response === "duplicateDatabaseEntry" || response === "missingDatabaseEntry") {
            // Rollback changes on error
            STUDENT_DATA.push(removedStudent);
            MEETING_DATA = MEETING_DATA.concat(removedMeetings);
            updateStudentNames();
            showError(response);
          } else {
            // Success notification
            const successMessage = `'${selectedStudent['Student Name']}' and associated meetings deleted successfully!`;
            playNotificationSound("remove");
            showToast("", successMessage, 5000);
          }
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error('Error deleting student:', error);
        showError("unexpectedError");
        
        // Attempt to restore state
        if (removedStudent) {
            STUDENT_DATA.push(removedStudent);
        }
        if (removedMeetings.length > 0) {
            MEETING_DATA = MEETING_DATA.concat(removedMeetings);
        }
        updateStudentNames();
    } finally {
        busyFlag = false;
    }
  }

  function deleteStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("missingStudentData");
      return true;
    }

    return false;
  }

  /////////////////
  // ADD MEETING //
  /////////////////

  async function addMeeting() {
    if (!saveFlag) {
        showError("unsavedChanges");
        return;
    }

    if (busyFlag) {
        showError("operationInProgress");
        return;
    }

    // Prevent add meeting modal from being shown if no student selected
    const studentID = document.getElementById('studentName').value;

    if (!studentID) {
        showError("missingStudentData");
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

        // Get the student data
        const studentNameSelectBox = document.getElementById('studentName');
        const selectedStudent = studentNameSelectBox.value;
        const student = STUDENT_DATA.find(student => student['Student ID'] === selectedStudent);

        // Create meeting object without ID first
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

        // Close the modal immediately
        closeHtmlModal("addMeetingModal");
        
        // Show initial toast
        showToast("", "Adding meeting...", 5000);

        try {
            // Get meeting ID
            await getAvailableID();
            const meetingID = cachedID;

            // Update meeting object with ID
            newMeeting['Meeting ID'] = meetingID;

            // Add to local data structure
            MEETING_DATA.push(newMeeting);

            // Update UI before server operation
            updateMeetingNames(selectedStudent);

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

            // Save to Google Sheets
            const response = await new Promise((resolve) => {
              google.script.run.withSuccessHandler(resolve).addMeetingData(newMeetingArray);
            });

            if (response === "duplicateDatabaseEntry" || response === "missingDatabaseEntry") {
                // Remove from local data if save failed
                const index = MEETING_DATA.findIndex(m => m['Meeting ID'] === meetingID);
                if (index !== -1) {
                    MEETING_DATA.splice(index, 1);
                    updateMeetingNames(selectedStudent);
                }
                
                // Show appropriate error message
                if (response === "missingDatabaseEntry") {
                    showError("missingDatabaseEntry");
                } else {
                    showError("duplicateDatabaseEntry");
                }
                
                busyFlag = false;
                return;
            }

            // Success handling
            showToast("", "Meeting added successfully!", 5000);
            playNotificationSound("success");

        } catch (error) {
            console.error('Error adding meeting:', error);
            
            // Remove from local data if needed
            const index = MEETING_DATA.findIndex(m => m['Student ID'] === student['Student ID'] && m['Date'] === newMeeting['Date']);
            if (index !== -1) {
                MEETING_DATA.splice(index, 1);
                updateMeetingNames(selectedStudent);
            }
            
            showError("addMeetingError");
        } finally {
            busyFlag = false;
        }
    };
  }

  function addMeetingErrorCheck() {
    const meetingDate = document.getElementById('addMeetingDate').value;
    const meetingType = document.getElementById('addMeetingType').value;
    const meetingAttendees = document.getElementById('addAttendees').value;
    const meetingFacilitator = document.getElementById('addFacilitator').value;
    const meetingScribe = document.getElementById('addScribe').value;

    if (!meetingDate) {
      showError("missingMeetingDate");
      return true;
    }
    if (!meetingType) {
      showError("missingMeetingType");
      return true;
    }
    if (!meetingAttendees) {
      showError("missingAttendees");
      return true;
    }
    if (!meetingFacilitator) {
      showError("missingFacilitator");
      return true;
    }
    if (!meetingScribe) {
      showError("missingScribe");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE MEETING //
  ////////////////////

  async function deleteMeeting() {
    if (busyFlag) {
        showError("operationInProgress");
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
        showError("missingMeetingEntry");
        return;
    }

    try {
        // Format meeting information
        const meetingDate = formatDate(selectedMeeting['Date']);
        const meetingName = `${meetingDate} - ${selectedMeeting['Type']}`;
        
        // Show confirmation modal with warning icon
        const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
        const message = `Are you sure you want to delete the meeting '${meetingName}'? This action cannot be undone.`;
        const title = `${warningIcon}Delete Meeting`;
        
        const buttonText = await showModal(title, message, "Cancel", "Delete");
        
        if (buttonText === "Cancel") {
            return;
        }

        // Set busy flag and store backup
        busyFlag = true;
        const selectedIndex = meetingNameSelectBox.selectedIndex;
        const removedMeeting = { ...selectedMeeting }; // Create a copy of the meeting data

        // Update UI
        if (selectedIndex >= 0) {
            // Update UI elements
            meetingNameSelectBox.remove(selectedIndex);
            meetingNameSelectBox.selectedIndex = -1;
            
            // Update data
            MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Meeting ID'] !== meetingID);
            
            // Rebuild meeting list
            const studentID = document.getElementById('studentName').value;
            updateMeetingNames(studentID);

            // Show progress toast
            showToast("", "Deleting meeting...", 5000);

            // Server operation
            const response = await new Promise((resolve) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .deleteMeetingData(meetingID);
            });

            // Handle response
            if (response === "missingMeetingEntry") {
                // Rollback changes on error
                MEETING_DATA.push(removedMeeting);
                updateMeetingNames(studentID);
                showError(response);
            } else {
                // Success notification
                const successMessage = `'${meetingName}' deleted successfully!`;
                playNotificationSound("remove");
                showToast("", successMessage, 5000);
            }
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error('Error deleting meeting:', error);
        showError("unexpectedError");
        
        // Attempt to restore state
        if (removedMeeting) {
            const studentID = document.getElementById('studentName').value;
            MEETING_DATA.push(removedMeeting);
            updateMeetingNames(studentID);
        }
    } finally {
        busyFlag = false;
    }
  }

  function deleteMeetingErrorCheck() {
    const meetingNameSelectBox = document.getElementById('meetingName');
    
    if (meetingNameSelectBox.options.length === 0) {
      showError("missingMeetingData");
      return true;
    }

    return false;
  }

  ///////////////////
  // COMPOSE EMAIL //
  ///////////////////

  async function composeEmail() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    // Prevent add email modal from being shown if no student selected
    const studentID = document.getElementById('studentName').value;

    if (!studentID) {
      showError("missingStudentData");
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
        
      closeHtmlModal("emailModal");

      try {
        const toastMessage = template === "summary" 
          ? "Attaching meeting summary and sending email..." 
          : "Sending email...";
        const toastDuration = template === "summary" ? 10000 : 5000;
            
        showToast("", toastMessage, toastDuration);

        // Small delay for summary template to allow UI update
        if (template === "summary") {
          await new Promise(resolve => setTimeout(resolve, 100));
          await generateMeetingSummaryPDF(recipient, subject, body);
        } else {
          await sendEmail(recipient, subject, body);
        }
      } catch (error) {
        console.error("Error sending email: ", error);
        showError("emailFailure");
      } finally {
          busyFlag = false;
      }
    }
  }

  async function generateMeetingSummaryPDF(recipient, subject, body) {
    const docDefinition = createMeetingSummary();

    // Use async/await for PDF generation and sending the email
    return new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob((blob) => {
        blob.arrayBuffer().then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);
          const byteArray = Array.from(uint8Array);
          sendEmail(recipient, subject, body, byteArray)
          .then(resolve)  // Resolve the promise when done
          .catch(reject);  // Reject if there's an error
        });
      });
    });
  }

  function sendEmail(recipient, subject, body, attachments) {
    return new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(function(response) {
        if (response === "emailQuotaLimit") {
          showError("emailQuotaLimit");
          reject("emailQuotaLimit");
        } 
        else if (response === "emailFailure") {
          showError("emailFailure");
          reject("emailFailure");
        } 
        else {
          playNotificationSound("success");
          showToast("", "Email successfully sent to: " + recipient, 10000);
          resolve(response);
        }
        busyFlag = false;
      }).createEmail(recipient, subject, body, attachments);
    });
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
      showError("missingEmailRecipient");
      return true;
    }

    const recipients = recipient.split(',');
    for (let i = 0; i < recipients.length; i++) {
      if (!emailPattern.test(recipients[i].trim())) {
        showError("invalidEmail");
        return true;
      }
    }

    if (body.includes(warningIcon)) {
      showError("missingEmailTemplateData")
      return true;
    }

    return false;
  }

  //////////////////
  // EXPORT FORMS //
  //////////////////

  function exportMeeting() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    if (exportMeetingSelectBox.options.length === 0) {
      showError("missingMeetingData");
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
    if (busyFlag) {
      showError("operationInProgress");
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
          google.script.run.withSuccessHandler(function(data) {
            let a = document.createElement('a');
            
            a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(data);
            a.download = fileName + '.csv';
            a.click();
            busyFlag = false;
          }).getCsv(dataType);
          break;
        case 'xlsx':
          google.script.run.withSuccessHandler(function(data) {
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
          }).getXlsx(dataType);
          break;
      }
      
      closeHtmlModal("exportDataModal");
    };
  }

  //////////////////////////////
  // ARCHIVE/ACTIVE DATA VIEW //
  //////////////////////////////

  function toggleDataView() {
    // Show error and prevent Add Student if there are unsaved changes
    if (!saveFlag) {
      showError("unsavedChanges");
      return;
    }

    if (busyFlag) {
      showError("operationInProgress");
      return;
    }
    
    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Show the loading indicator and hide the page
    toolbar.style.display = 'none';
    page.style.display = 'none';
    loadingIndicator.style.display = 'block';
    
    dataFlag = (dataFlag === "active") ? "archive" : "active";

    let studentDataPromise;
    const header = document.getElementById('header-text');

    if (dataFlag === "archive") {
      document.getElementById('header-text').innerText += " - Archive";
      studentDataPromise = new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getArchiveData();
      });
    } else {
      header.innerText = header.innerText.replace(" - Archive", "");
      studentDataPromise = new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getActiveData();
      });
    }

    const meetingDataPromise = new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getMeetingData();
    });

    Promise.all([studentDataPromise, meetingDataPromise]).then(([studentData, meetingData]) => {
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

      updateStudentNames();

      // Hide loading indicator and show dashboard page
      loadingIndicator.style.display = 'none';
      toolbar.style.display = 'block';
      page.style.display = 'flex';
    })
    .catch(error => {
      console.error("Error fetching data:", error);
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
    return new Promise((resolve) => {
      google.script.run
        .withSuccessHandler((idCache) => {
          // Convert to Set for O(1) lookup and find first missing number
          const idSet = new Set(idCache.map(id => parseInt(id, 10)));
          
          // Start from 1 and find first missing number
          let i = 1;
          while (idSet.has(i)) i++;
          
          // Format and return the result
          resolve(i.toString().padStart(6, '0'));
        }).getIDCache();
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
      case "operationInProgress":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;
      
      // Save errors
      case "unsavedChanges":
        title = warningIcon + "Unsaved Changes";
        message = "There are unsaved changes. Please save the changes and try again.";
        button1 = "Close";
        break;
      
      // Add student errors
      case "missingFirstName":
        title = warningIcon + "Missing First Name";
        message = "Please enter a first name and try again.";
        button1 = "Close";
        break;

      case "missingLastName":
        title = warningIcon + "Missing Last Name";
        message = "Please enter a last name and try again.";
        button1 = "Close";
        break;

      case "missingGender":
        title = warningIcon + "Missing Gender";
        message = "Please select a gender and try again.";
        button1 = "Close";
        break;

      case "missingDateOfBirth":
        title = warningIcon + "Missing Date Of Birth";
        message = "Please enter a date of birth and try again.";
        button1 = "Close";
        break;

      case "missingGrade":
        title = warningIcon + "Missing Grade";
        message = "Please select a grade and try again.";
        button1 = "Close";
        break;

      case "missingClassroom":
        title = warningIcon + "Missing Classroom";
        message = "Please select a classroom and try again.";
        button1 = "Close";
        break;

      case "missingTeacher":
        title = warningIcon + "Missing Teacher";
        message = "Please select a teacher and try again.";
        button1 = "Close";
        break;

      case "missingSpecializedInstruction":
        title = warningIcon + "Missing Specialized Instruction";
        message = "Please select a specialized instruction type and try again.";
        button1 = "Close";
        break;
      
      case "missingCaseManager":
        title = warningIcon + "Missing Case Manager";
        message = "Please enter a case manager and try again.";
        button1 = "Close";
        break;

      case "missingParentGuardianContact":
        title = warningIcon + "Missing Parent/Guardian Contact";
        message = "At least one parent/guardian name, phone, and email must be filled in. Please check the parent/guardian information and try again.";
        button1 = "Close";
        break;

      case "invalidParentGuardianPhone":
        title = warningIcon + "Invalid Phone Number";
        message = "Please check the parent/guardian phone number and try again.";
        button1 = "Close";
        break;

      case "invalidParentGuardianEmail":
        title = warningIcon + "Invalid Email Address";
        message = "Please check the parent/guardian email address and try again.";
        button1 = "Close";
        break;

      // Add meeting errors
      case "missingMeetingDate":
        title = warningIcon + "Missing Meeting Date";
        message = "Please enter a meeting date and try again.";
        button1 = "Close";
        break;
      
      case "missingMeetingType":
        title = warningIcon + "Missing Meeting Type";
        message = "Please select a meeting type and try again.";
        button1 = "Close";
        break;

      case "missingAttendees":
        title = warningIcon + "Missing Attendees";
        message = "Please enter the meeting attendees and try again.";
        button1 = "Close";
        break;

      case "missingFacilitator":
        title = warningIcon + "Missing Facilitator";
        message = "Please enter a meeting facilitator and try again.";
        button1 = "Close";
        break;

      case "missingScribe":
        title = warningIcon + "Missing Scribe";
         message = "Please enter a meeting scribe and try again.";
        button1 = "Close";
        break;

      // Database errors
      case "missingStudentData":
        title = errorIcon + "Data Error";
        message = "No student data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "missingMeetingData":
        title = errorIcon + "Data Error";
        message = "No meeting data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "missingDatabaseEntry":
        title = errorIcon + "Data Error";
        message = "The student data could not be found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "duplicateDatabaseEntry":
        title = errorIcon + "Data Error";
        message = "Duplicate data was found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      // Email errors
      case "missingEmailRecipient":
        title = warningIcon + "Missing Email Recipient";
        message = "Please enter an email address and try again.";
        button1 = "Close";
        break;
      
      case "invalidEmail":
        title = warningIcon + "Invalid Email Address";
        message = "Please check the email address and try again.";
        button1 = "Close";
        break;

      case "missingEmailTemplateData":
        title = errorIcon + "Email Error";
        message = "Missing email template data. The operation could not be completed.";
        button1 = "Close";
        break; 

      case "emailQuotaLimit":
        title = errorIcon + "Email Error";
        message = "The daily email limit has been reached. Please wait 24 hours before sending your email and try again.";
        button1 = "Close";
        break;

      case "emailFailure":
        title = errorIcon + "Email Error";
        message = "An unknown error occurred. The operation could not be completed.";
        button1 = "Close";
        break;
      
      // Backup errors
      case "backupFailure":
        title = errorIcon + "Backup Error";
        message = "An unknown error occurred. The operation could not be completed.";
        button1 = "Close";
        break;
    }
    
    playNotificationSound("alert");
    showModal(title, message, button1, button2);
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

</script>
