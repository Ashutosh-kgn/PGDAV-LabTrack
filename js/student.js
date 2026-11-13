import { auth, db } from "./app.js";
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

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
            email: userData.email || user.email || ""
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
    const today = getTodayDate();
    const overdueLoans = activeLoans.filter(b => b.dueDate < today);
    const pendingReqs = myRequests.filter(r => r.status === "Pending");

    // Text counters
    const availEl = document.getElementById("availableEquipment");
    if (availEl) availEl.textContent = available;

    const loansEl = document.getElementById("myActiveLoansCount");
    if (loansEl) loansEl.textContent = activeLoans.length;

    const pendingEl = document.getElementById("myPendingRequestsCount");
    if (pendingEl) pendingEl.textContent = pendingReqs.length;

    const overdueEl = document.getElementById("myOverdueCount");
    if (overdueEl) overdueEl.textContent = overdueLoans.length;

    // Badges on tabs
    const loansBadge = document.getElementById("tabLoansBadge");
    if (loansBadge) loansBadge.textContent = activeLoans.length;

    const browseBadge = document.getElementById("tabBrowseBadge");
    if (browseBadge) browseBadge.textContent = available;

    const requestsBadge = document.getElementById("tabRequestsBadge");
    if (requestsBadge) requestsBadge.textContent = pendingReqs.length;

    // Overdue Alert Styling
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
// TAB 1: MY ACTIVE BORROWINGS & TAB 4: BORROWING HISTORY
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
    const today = getTodayDate();
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
                const isOverdue = item.dueDate < today;
                const diffMs = new Date(item.dueDate) - new Date(today);
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                let remainingBadge = '';
                if (isOverdue) {
                    const daysPast = Math.abs(diffDays);
                    remainingBadge = `<span class="badge badge-overdue">OVERDUE BY ${daysPast} DAY${daysPast === 1 ? '' : 'S'}!</span>`;
                } else if (diffDays === 0) {
                    remainingBadge = `<span class="badge badge-pending">Due Today!</span>`;
                } else {
                    remainingBadge = `<span class="badge badge-approved">${diffDays} day${diffDays === 1 ? '' : 's'} remaining</span>`;
                }

                // Match location from catalog if available
                const catalogItem = allEquipment.find(e => e.equipmentId === item.equipmentId);
                const returnLocation = catalogItem?.location || "Main Laboratory Desk";

                return `
                    <tr>
                        <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                        <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                        <td>${escapeHTML(item.issueDate)}</td>
                        <td><strong>${escapeHTML(item.dueDate)}</strong></td>
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
                        <td>${escapeHTML(item.issueDate)}</td>
                        <td>${escapeHTML(item.dueDate)}</td>
                        <td>${escapeHTML(item.returnDate || "N/A")}</td>
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
    requestEquipmentMeta.value = `${equipment.category || "Lab"} • Location: ${equipment.location || "Lab"}`;

    const today = getTodayDate();
    requestFromDate.value = today;

    // Default return date: +3 days
    const defReturn = new Date();
    defReturn.setDate(defReturn.getDate() + 3);
    requestToDate.value = defReturn.toISOString().split("T")[0];

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
        const fromDate = requestFromDate.value;
        const toDate = requestToDate.value;
        const purpose = requestPurpose.value.trim();

        if (!docId || !fromDate || !toDate || !purpose) {
            showToast("Please fill all request fields.", "warning");
            return;
        }

        if (toDate < fromDate) {
            showToast("Return date cannot be earlier than start date.", "warning");
            return;
        }

        // Check if student already has a pending request for this item
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

            await addDoc(collection(db, "requests"), {
                equipmentDocId: docId,
                equipmentId: eqId,
                equipmentName: eqName,
                category: eqItem?.category || "General",
                location: eqItem?.location || "Lab",
                studentUid: currentStudent.uid,
                studentName: currentStudent.name,
                studentEmail: currentStudent.email,
                fromDate: fromDate,
                toDate: toDate,
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
// TAB 3: MY REQUESTS TRACKER
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
                <td colspan="7" class="table-empty-state">
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
            statusBadge = '<span class="badge badge-pending">Pending Admin Review</span>';
        } else if (isApproved) {
            statusBadge = '<span class="badge badge-approved">Approved • Pick up at Lab</span>';
        } else if (isRejected) {
            statusBadge = `<span class="badge badge-rejected" title="${escapeHTML(req.rejectionReason || 'No reason specified')}">Rejected</span>`;
        }

        let subDate = "Recently";
        if (req.createdAt?.toDate) {
            subDate = req.createdAt.toDate().toLocaleDateString();
        }

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(req.equipmentId)}</span></td>
                <td><strong>${escapeHTML(req.equipmentName)}</strong></td>
                <td>${escapeHTML(req.fromDate)} <span style="color: var(--slate-400)">to</span> ${escapeHTML(req.toDate)}</td>
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

    // Check if this student currently has it borrowed
    const myActiveItem = myBorrowings.find(b => b.equipmentId === equipment.equipmentId && b.status === "Active");

    if (myActiveItem) {
        const infoBadge = document.createElement("div");
        infoBadge.innerHTML = `
            <div style="background: var(--primary-light); color: var(--primary); padding: 8px 12px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600;">
                ✓ This equipment is currently checked out to you! Due: ${escapeHTML(myActiveItem.dueDate)}
            </div>
        `;
        actionsContainer.appendChild(infoBadge);
        return;
    }

    if (equipment.status === "Available") {
        const reqBtn = document.createElement("button");
        reqBtn.className = "btn btn-primary btn-sm";
        reqBtn.textContent = "+ Request to Borrow";
        reqBtn.addEventListener("click", () => {
            document.getElementById("closeScannerBtn")?.click();
            openRequestModal(equipment);
        });
        actionsContainer.appendChild(reqBtn);
    } else {
        const unavailBadge = document.createElement("div");
        unavailBadge.innerHTML = `
            <span class="badge badge-borrowed">
                Currently ${escapeHTML(equipment.status)} - Cannot be requested right now.
            </span>
        `;
        actionsContainer.appendChild(unavailBadge);
    }
});
