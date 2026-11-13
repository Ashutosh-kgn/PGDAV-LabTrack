import { auth, db, isAuthorizedEmail } from "./app.js";
import { initQrScanner } from "./scanner.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    onSnapshot,
    addDoc,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ==========================================================================
// STATE MANAGEMENT & DOM REFERENCES
// ==========================================================================

let currentStudent = null;
let allEquipment = [];
let myBorrowings = [];
let myRequests = [];

const studentName = document.getElementById("studentName");
const studentAvatar = document.getElementById("studentAvatar");
const toastContainer = document.getElementById("toastContainer");

// ==========================================================================
// DATE FORMATTING & PARSING HELPERS (DD-MM-YYYY ACROSS WHOLE PROJECT)
// ==========================================================================

/**
 * Universal Date Formatter: converts any Date, Firestore Timestamp, or string to DD-MM-YYYY
 */
export function formatDate(val) {
    if (!val) return "N/A";

    if (typeof val.toDate === "function") {
        const d = val.toDate();
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    if (val instanceof Date) {
        if (isNaN(val.getTime())) return "N/A";
        const dd = String(val.getDate()).padStart(2, "0");
        const mm = String(val.getMonth() + 1).padStart(2, "0");
        const yyyy = val.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    if (typeof val === "string") {
        const trimmed = val.trim();
        // Check if already in DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dmyMatch) {
            const dd = dmyMatch[1].padStart(2, "0");
            const mm = dmyMatch[2].padStart(2, "0");
            const yyyy = dmyMatch[3];
            return `${dd}-${mm}-${yyyy}`;
        }

        // Check if in YYYY-MM-DD
        const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (ymdMatch) {
            const yyyy = ymdMatch[1];
            const mm = ymdMatch[2].padStart(2, "0");
            const dd = ymdMatch[3].padStart(2, "0");
            return `${dd}-${mm}-${yyyy}`;
        }

        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const dd = String(parsed.getDate()).padStart(2, "0");
            const mm = String(parsed.getMonth() + 1).padStart(2, "0");
            const yyyy = parsed.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        }
        return trimmed;
    }

    return String(val);
}

/**
 * Universal Date Parser: safely converts DD-MM-YYYY or YYYY-MM-DD to a normalized Date object
 */
export function parseDate(val) {
    if (!val) return new Date();
    if (typeof val.toDate === "function") {
        const d = val.toDate();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (val instanceof Date) {
        const d = new Date(val);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        const dmy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dmy) {
            const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (ymd) {
            const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? new Date() : d;
}

function getTodayDateISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ==========================================================================
// TOAST NOTIFICATIONS & HELPERS
// ==========================================================================

export function showToast(message, type = "info") {
    if (!toastContainer) {
        alert(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const iconMap = {
        success: "✓",
        error: "✕",
        warning: "⚠️",
        info: "ℹ️"
    };

    toast.innerHTML = `
        <span style="font-weight: 700; font-size: 16px;">${iconMap[type] || "ℹ️"}</span>
        <span style="flex: 1;">${escapeHTML(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3600);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================================================
// TAB NAVIGATION
// ==========================================================================

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-content-panel");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetTabId = btn.dataset.tab;

        tabButtons.forEach(b => b.classList.remove("active"));
        tabPanels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const panel = document.getElementById(targetTabId);
        if (panel) panel.classList.add("active");
    });
});

function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
}

// ==========================================================================
// AUTHENTICATION & AUTHORIZATION
// ==========================================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }

    // Verify institutional domain
    if (!isAuthorizedEmail(user.email)) {
        await signOut(auth);
        window.location.replace("index.html");
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        const userData = userDoc.data();

        if (
            userData.role !== "student" ||
            userData.active !== true ||
            userData.status !== "approved"
        ) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        currentStudent = {
            uid: user.uid,
            name: userData.name || "Student",
            email: userData.email || user.email || "",
            rollNo: userData.rollNo || "",
            course: userData.course || ""
        };

        if (studentName) studentName.textContent = currentStudent.name;
        if (studentAvatar) studentAvatar.textContent = currentStudent.name.charAt(0).toUpperCase();

        // Start Live Data Listeners
        startEquipmentCatalogListener();
        startMyBorrowingsListener();
        startMyRequestsListener();

        // Initialize QR Scanner
        initQrScanner(db);

    } catch (error) {
        console.error("Student dashboard auth error:", error);
        if (studentName) studentName.textContent = "Unable to load student profile.";
        showToast("Error authenticating student profile.", "error");
    }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

// ==========================================================================
// STATS CALCULATION
// ==========================================================================

function updateStudentStats() {
    const available = allEquipment.filter(item => item.status === "Available").length;
    const activeLoans = myBorrowings.filter(b => b.status === "Active");
    const todayObj = parseDate(new Date());

    const overdueLoans = activeLoans.filter(b => {
        const dueObj = parseDate(b.dueDate);
        return dueObj < todayObj;
    });

    const pendingReqs = myRequests.filter(r => r.status === "Pending");

    const availEl = document.getElementById("availableEquipment");
    if (availEl) availEl.textContent = available;

    const loansEl = document.getElementById("myActiveLoansCount");
    if (loansEl) loansEl.textContent = activeLoans.length;

    const pendingEl = document.getElementById("myPendingRequestsCount");
    if (pendingEl) pendingEl.textContent = pendingReqs.length;

    const overdueEl = document.getElementById("myOverdueCount");
    if (overdueEl) overdueEl.textContent = overdueLoans.length;

    const loansBadge = document.getElementById("tabLoansBadge");
    if (loansBadge) loansBadge.textContent = activeLoans.length;

    const browseBadge = document.getElementById("tabBrowseBadge");
    if (browseBadge) browseBadge.textContent = available;

    const requestsBadge = document.getElementById("tabRequestsBadge");
    if (requestsBadge) requestsBadge.textContent = pendingReqs.length;

    const overdueCard = document.getElementById("studentOverdueCard");
    if (overdueCard) {
        if (overdueLoans.length > 0) {
            overdueCard.style.borderColor = "var(--danger)";
            overdueCard.style.boxShadow = "0 0 0 2px rgba(220, 38, 38, 0.25)";
        } else {
            overdueCard.style.borderColor = "var(--slate-200)";
            overdueCard.style.boxShadow = "var(--shadow-sm)";
        }
    }
}

// ==========================================================================
// TAB 1: MY ACTIVE BORROWINGS & TAB 4: BORROWING HISTORY (DD-MM-YYYY)
// ==========================================================================

const myActiveBorrowingsTable = document.getElementById("myActiveBorrowingsTable");
const myHistoryTable = document.getElementById("myHistoryTable");

function startMyBorrowingsListener() {
    if (!currentStudent) return;

    const q = query(
        collection(db, "borrowings"),
        where("studentUid", "==", currentStudent.uid)
    );

    onSnapshot(q, (snapshot) => {
        myBorrowings = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        renderMyBorrowings();
        updateStudentStats();
    }, (error) => {
        console.error("My borrowings error:", error);
    });
}

function renderMyBorrowings() {
    const todayObj = parseDate(new Date());
    const active = myBorrowings.filter(b => b.status === "Active");
    const history = myBorrowings.filter(b => b.status === "Returned");

    // 1. Active Borrowings Table
    if (myActiveBorrowingsTable) {
        if (active.length === 0) {
            myActiveBorrowingsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <p>You have no equipment currently borrowed. Visit "Browse & Request" to borrow items.</p>
                    </td>
                </tr>
            `;
        } else {
            myActiveBorrowingsTable.innerHTML = active.map(item => {
                const dueObj = parseDate(item.dueDate);
                const diffMs = dueObj.getTime() - todayObj.getTime();
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0;

                let remainingBadge = '';
                if (isOverdue) {
                    const daysPast = Math.abs(diffDays);
                    remainingBadge = `<span class="badge badge-overdue">OVERDUE BY ${daysPast} DAY${daysPast === 1 ? '' : 'S'}!</span>`;
                } else if (diffDays === 0) {
                    remainingBadge = `<span class="badge badge-pending">Due Today!</span>`;
                } else {
                    remainingBadge = `<span class="badge badge-approved">${diffDays} day${diffDays === 1 ? '' : 's'} remaining</span>`;
                }

                const catalogItem = allEquipment.find(e => e.equipmentId === item.equipmentId);
                const returnLocation = catalogItem?.location || "Main Laboratory Desk";

                return `
                    <tr>
                        <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                        <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                        <td>${formatDate(item.issueDate)}</td>
                        <td><strong>${formatDate(item.dueDate)}</strong></td>
                        <td>${remainingBadge}</td>
                        <td>${escapeHTML(returnLocation)}</td>
                    </tr>
                `;
            }).join("");
        }
    }

    // 2. History Table
    if (myHistoryTable) {
        if (history.length === 0) {
            myHistoryTable.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <p>No past borrowing history yet.</p>
                    </td>
                </tr>
            `;
        } else {
            myHistoryTable.innerHTML = history.map(item => {
                const condClass = {
                    "Good": "badge-cond-good",
                    "Fair": "badge-cond-fair",
                    "Damaged": "badge-cond-damaged"
                }[item.returnCondition] || "badge-cond-good";

                return `
                    <tr>
                        <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                        <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                        <td>${formatDate(item.issueDate)}</td>
                        <td>${formatDate(item.dueDate)}</td>
                        <td>${formatDate(item.returnDate)}</td>
                        <td><span class="badge ${condClass}">${escapeHTML(item.returnCondition || "Good")}</span></td>
                    </tr>
                `;
            }).join("");
        }
    }
}

// ==========================================================================
// TAB 2: BROWSE & REQUEST EQUIPMENT
// ==========================================================================

const equipmentTable = document.getElementById("equipmentTable");
const searchEquipment = document.getElementById("searchEquipment");
const filterCategory = document.getElementById("filterCategory");
const filterAvailability = document.getElementById("filterAvailability");

const requestModal = document.getElementById("requestModal");
const closeRequestModal = document.getElementById("closeRequestModal");
const requestForm = document.getElementById("requestForm");
const requestEquipmentDocId = document.getElementById("requestEquipmentDocId");
const requestEquipmentId = document.getElementById("requestEquipmentId");
const requestEquipmentName = document.getElementById("requestEquipmentName");
const requestEquipmentMeta = document.getElementById("requestEquipmentMeta");
const requestLabAttendant = document.getElementById("requestLabAttendant");
const requestStudentRollNo = document.getElementById("requestStudentRollNo");
const requestStudentCourse = document.getElementById("requestStudentCourse");
const requestFromDate = document.getElementById("requestFromDate");
const requestToDate = document.getElementById("requestToDate");
const requestPurpose = document.getElementById("requestPurpose");
const confirmRequestBtn = document.getElementById("confirmRequestBtn");
const requestMessage = document.getElementById("requestMessage");

function startEquipmentCatalogListener() {
    onSnapshot(collection(db, "equipment"), (snapshot) => {
        allEquipment = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        applyCatalogFilters();
        renderMyBorrowings();
        updateStudentStats();
    }, (error) => {
        console.error("Catalog listener error:", error);
    });
}

function applyCatalogFilters() {
    const searchVal = (searchEquipment?.value || "").trim().toLowerCase();
    const catVal = filterCategory?.value || "";
    const availVal = filterAvailability?.value || "Available";

    const filtered = allEquipment.filter(item => {
        const matchesSearch = !searchVal ||
            (item.equipmentId || "").toLowerCase().includes(searchVal) ||
            (item.name || "").toLowerCase().includes(searchVal) ||
            (item.location || "").toLowerCase().includes(searchVal);

        const matchesCat = !catVal || item.category === catVal;
        const matchesAvail = availVal === "All" || item.status === "Available";

        return matchesSearch && matchesCat && matchesAvail;
    });

    renderCatalogTable(filtered);
}

searchEquipment?.addEventListener("input", applyCatalogFilters);
filterCategory?.addEventListener("change", applyCatalogFilters);
filterAvailability?.addEventListener("change", applyCatalogFilters);

function renderCatalogTable(items) {
    if (!equipmentTable) return;

    if (items.length === 0) {
        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty-state">
                    <p>No equipment matching your criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    equipmentTable.innerHTML = items.map(item => {
        const isAvailable = item.status === "Available";
        const statusClass = {
            "Available": "badge-available",
            "Borrowed": "badge-borrowed",
            "Under Maintenance": "badge-maintenance",
            "Maintenance": "badge-maintenance"
        }[item.status] || "badge-available";

        const condClass = {
            "Good": "badge-cond-good",
            "Fair": "badge-cond-fair",
            "Damaged": "badge-cond-damaged"
        }[item.condition] || "badge-cond-good";

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                <td><strong>${escapeHTML(item.name)}</strong></td>
                <td>${escapeHTML(item.category || "General")}</td>
                <td>${escapeHTML(item.location || "Lab")}</td>
                <td><span class="badge ${condClass}">${escapeHTML(item.condition || "Good")}</span></td>
                <td><span class="badge ${statusClass}">${escapeHTML(item.status)}</span></td>
                <td>
                    ${isAvailable ? `
                        <button class="btn btn-primary btn-sm request-borrow-btn" data-id="${escapeHTML(item.documentId)}">
                            + Request
                        </button>
                    ` : `<span style="font-size: 12px; color: var(--slate-400)">Unavailable</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

// Request Modal
equipmentTable?.addEventListener("click", (e) => {
    const btn = e.target.closest(".request-borrow-btn");
    if (!btn) return;

    const docId = btn.dataset.id;
    const item = allEquipment.find(i => i.documentId === docId);
    if (!item) return;

    openRequestModal(item);
});

function openRequestModal(equipment) {
    if (!requestModal) return;

    requestForm.reset();
    requestEquipmentDocId.value = equipment.documentId;
    requestEquipmentId.value = equipment.equipmentId;
    requestEquipmentName.value = equipment.name;
    requestEquipmentMeta.value = `${equipment.category || "General"} • Location: ${equipment.location || "Lab"}`;

    const labAttendant = equipment.category ? `${equipment.category} Lab Attendant` : "General Lab Attendant";
    if (requestLabAttendant) requestLabAttendant.value = labAttendant;
    if (requestStudentRollNo) requestStudentRollNo.value = currentStudent?.rollNo || "N/A";
    if (requestStudentCourse) requestStudentCourse.value = currentStudent?.course || "N/A";

    requestFromDate.value = getTodayDateISO();

    const defReturn = new Date();
    defReturn.setDate(defReturn.getDate() + 3);
    const yyyy = defReturn.getFullYear();
    const mm = String(defReturn.getMonth() + 1).padStart(2, "0");
    const dd = String(defReturn.getDate()).padStart(2, "0");
    requestToDate.value = `${yyyy}-${mm}-${dd}`;

    if (requestMessage) requestMessage.textContent = "";

    requestModal.style.display = "flex";
}

closeRequestModal?.addEventListener("click", () => {
    requestModal.style.display = "none";
});
requestModal?.addEventListener("click", (e) => {
    if (e.target === requestModal) requestModal.style.display = "none";
});

// Submit Request
if (requestForm) {
    requestForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const docId = requestEquipmentDocId.value;
        const eqId = requestEquipmentId.value;
        const eqName = requestEquipmentName.value;
        const rawFromDate = requestFromDate.value;
        const rawToDate = requestToDate.value;
        const purpose = requestPurpose.value.trim();

        if (!docId || !rawFromDate || !rawToDate || !purpose) {
            showToast("Please fill all request fields.", "warning");
            return;
        }

        if (parseDate(rawToDate) < parseDate(rawFromDate)) {
            showToast("Return date cannot be earlier than start date.", "warning");
            return;
        }

        const existingPending = myRequests.find(r => r.equipmentDocId === docId && r.status === "Pending");
        if (existingPending) {
            showToast("You already have a pending request for this equipment.", "warning");
            return;
        }

        confirmRequestBtn.disabled = true;
        if (requestMessage) {
            requestMessage.textContent = "Submitting your request...";
            requestMessage.style.color = "var(--primary)";
        }

        try {
            const eqItem = allEquipment.find(i => i.documentId === docId);

            // Store formatted dates DD-MM-YYYY
            const formattedFrom = formatDate(rawFromDate);
            const formattedTo = formatDate(rawToDate);

            const assignedAttendant = requestLabAttendant?.value || (eqItem?.category ? `${eqItem.category} Lab Attendant` : "General Lab Attendant");

            await addDoc(collection(db, "requests"), {
                equipmentDocId: docId,
                equipmentId: eqId,
                equipmentName: eqName,
                category: eqItem?.category || "General",
                location: eqItem?.location || "Lab",
                labAttendant: assignedAttendant,
                studentUid: currentStudent.uid,
                studentName: currentStudent.name,
                studentEmail: currentStudent.email,
                studentRollNo: currentStudent.rollNo || "",
                studentCourse: currentStudent.course || "",
                fromDate: formattedFrom,
                toDate: formattedTo,
                purpose: purpose,
                status: "Pending",
                createdAt: new Date()
            });

            showToast("Borrowing request submitted successfully! An admin will review it.", "success");
            requestModal.style.display = "none";
            switchTab("tab-my-requests");
        } catch (error) {
            console.error("Submit request error:", error);
            showToast("Failed to submit request.", "error");
            if (requestMessage) {
                requestMessage.textContent = error.message;
                requestMessage.style.color = "var(--danger)";
            }
        } finally {
            confirmRequestBtn.disabled = false;
        }
    });
}

// ==========================================================================
// TAB 3: MY REQUESTS TRACKER (DD-MM-YYYY)
// ==========================================================================

const myRequestsTable = document.getElementById("myRequestsTable");

function startMyRequestsListener() {
    if (!currentStudent) return;

    const q = query(
        collection(db, "requests"),
        where("studentUid", "==", currentStudent.uid)
    );

    onSnapshot(q, (snapshot) => {
        myRequests = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        renderMyRequestsTable();
        updateStudentStats();
    }, (error) => {
        console.error("My requests listener error:", error);
    });
}

function renderMyRequestsTable() {
    if (!myRequestsTable) return;

    if (myRequests.length === 0) {
        myRequestsTable.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty-state">
                    <p>You have not submitted any equipment requests yet.</p>
                </td>
            </tr>
        `;
        return;
    }

    myRequestsTable.innerHTML = myRequests.map(req => {
        const isPending = req.status === "Pending";
        const isApproved = req.status === "Approved";
        const isRejected = req.status === "Rejected";

        let statusBadge = '<span class="badge">Unknown</span>';
        if (isPending) {
            statusBadge = '<span class="badge badge-pending">Pending Review</span>';
        } else if (isApproved) {
            statusBadge = '<span class="badge badge-approved">Approved • Pick up at Lab</span>';
        } else if (isRejected) {
            statusBadge = `<span class="badge badge-rejected" title="${escapeHTML(req.rejectionReason || 'No reason specified')}">Rejected</span>`;
        }

        const formattedFrom = formatDate(req.fromDate);
        const formattedTo = formatDate(req.toDate);
        const subDate = formatDate(req.createdAt);
        const attendantName = req.labAttendant || (req.category ? `${req.category} Lab Attendant` : "General Lab Attendant");

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(req.equipmentId)}</span></td>
                <td><strong>${escapeHTML(req.equipmentName)}</strong></td>
                <td>
                    <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:600;">
                        👤 ${escapeHTML(attendantName)}
                    </span>
                </td>
                <td>${formattedFrom} <span style="color: var(--slate-400)">to</span> ${formattedTo}</td>
                <td>
                    ${escapeHTML(req.purpose)}
                    ${isRejected && req.rejectionReason ? `
                        <div style="font-size: 11px; color: var(--danger); margin-top: 3px;">
                            <strong>Reason:</strong> ${escapeHTML(req.rejectionReason)}
                        </div>
                    ` : ''}
                </td>
                <td>${subDate}</td>
                <td>${statusBadge}</td>
                <td>
                    ${isPending ? `
                        <button class="btn btn-outline btn-sm cancel-request-btn" data-id="${escapeHTML(req.documentId)}" style="color: var(--danger);">
                            Cancel
                        </button>
                    ` : `<span style="font-size: 12px; color: var(--slate-400)">Completed</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

// Cancel Request Handler
myRequestsTable?.addEventListener("click", async (e) => {
    const cancelBtn = e.target.closest(".cancel-request-btn");
    if (!cancelBtn) return;

    const reqId = cancelBtn.dataset.id;
    const confirmed = confirm("Are you sure you want to cancel this borrowing request?");
    if (!confirmed) return;

    cancelBtn.disabled = true;
    try {
        await deleteDoc(doc(db, "requests", reqId));
        showToast("Request cancelled successfully.", "info");
    } catch (error) {
        console.error("Cancel request error:", error);
        showToast("Failed to cancel request.", "error");
        cancelBtn.disabled = false;
    }
});

// ==========================================================================
// SCANNED EVENT HANDLER (INTEGRATED SCANNER FOR STUDENT)
// ==========================================================================

window.addEventListener("labtrack:scanned", (e) => {
    const { equipment, actionsContainer } = e.detail;
    if (!actionsContainer) return;

    actionsContainer.innerHTML = "";

    const myActiveItem = myBorrowings.find(b => b.equipmentId === equipment.equipmentId && b.status === "Active");

    if (myActiveItem) {
        const infoBadge = document.createElement("div");
        infoBadge.innerHTML = `
            <div style="background: var(--primary-light); color: var(--primary); padding: 8px 12px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600;">
                ✓ This equipment is currently checked out to you! Due: ${formatDate(myActiveItem.dueDate)}
            </div>
        `;
        actionsContainer.appendChild(infoBadge);
        return;
    }

    const attendantName = equipment.category ? `${equipment.category} Lab Attendant` : "General Lab Attendant";

    if (equipment.status === "Available") {
        const reqBtn = document.createElement("button");
        reqBtn.className = "btn btn-primary";
        reqBtn.style.marginTop = "10px";
        reqBtn.style.width = "100%";
        reqBtn.style.display = "flex";
        reqBtn.style.alignItems = "center";
        reqBtn.style.justifyContent = "center";
        reqBtn.style.gap = "8px";
        reqBtn.style.fontSize = "14px";
        reqBtn.style.padding = "10px 16px";
        reqBtn.innerHTML = `📋 Request to Borrow (Transfer to ${escapeHTML(attendantName)})`;
        reqBtn.addEventListener("click", () => {
            document.getElementById("closeScannerBtn")?.click();
            openRequestModal(equipment);
        });
        actionsContainer.appendChild(reqBtn);
    } else {
        const unavailBadge = document.createElement("div");
        unavailBadge.innerHTML = `
            <span class="badge badge-borrowed" style="display:inline-block; margin-top:8px;">
                Currently ${escapeHTML(equipment.status)} - Cannot be requested right now.
            </span>
        `;
        actionsContainer.appendChild(unavailBadge);
    }
});
