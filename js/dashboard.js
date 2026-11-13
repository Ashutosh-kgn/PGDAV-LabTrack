import { auth, db, isAuthorizedEmail, firebaseConfig } from "./app.js";
import { initQrScanner } from "./scanner.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
    onAuthStateChanged,
    signOut,
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as secondarySignOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    getDocs,
    query,
    where,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ==========================================================================
// STATE MANAGEMENT & DOM REFERENCES
// ==========================================================================

let currentUser = null;
let allEquipment = [];
let allBorrowings = [];
let allRequests = [];
let allStudents = [];
let allMaintenance = [];

let editingEquipmentId = null;
let currentQrEquipment = null;

// UI Elements
const adminName = document.getElementById("adminName");
const adminAvatar = document.getElementById("adminAvatar");
const toastContainer = document.getElementById("toastContainer");

// ==========================================================================
// DATE FORMATTING & PARSING HELPERS (DD-MM-YYYY ACROSS WHOLE PROJECT)
// ==========================================================================

/**
 * Universal Date Formatter: converts any Date, Firestore Timestamp, or string to DD-MM-YYYY
 */
export function formatDate(val) {
    if (!val) return "N/A";

    // Firestore Timestamp
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

/**
 * Get Today's Date in ISO format for HTML5 <input type="date"> value
 */
function getTodayDateISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Get Today's Date in DD-MM-YYYY format
 */
function getTodayDateDMY() {
    return formatDate(new Date());
}

// ==========================================================================
// TOAST NOTIFICATION UTILITY
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

// Escape HTML
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
// AUTHENTICATION & ACCESS CONTROL
// ==========================================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }

    // Verify domain restriction
    if (!isAuthorizedEmail(user.email)) {
        await signOut(auth);
        window.location.replace("index.html");
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (
            !userDoc.exists() ||
            userDoc.data().role !== "admin" ||
            userDoc.data().active !== true
        ) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        currentUser = user;
        const adminData = userDoc.data();
        const displayName = adminData.name || "Administrator";

        if (adminName) adminName.textContent = displayName;
        if (adminAvatar) adminAvatar.textContent = displayName.charAt(0).toUpperCase();

        // Initialize Live Listeners
        startEquipmentListener();
        startPendingStudentsListener();
        startActiveBorrowingsListener();
        startMaintenanceListener();
        startBorrowingRequestsListener();

        // Initialize QR Scanner
        initQrScanner(db);

    } catch (error) {
        console.error("Dashboard auth error:", error);
        if (adminName) adminName.textContent = "Unable to load admin profile.";
        showToast("Error loading administrator credentials.", "error");
    }
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.replace("index.html");
    });
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

// Overview Quick Action Buttons
document.getElementById("overviewAddBtn")?.addEventListener("click", () => {
    switchTab("tab-inventory");
    document.getElementById("addEquipmentBtn")?.click();
});
document.getElementById("overviewScanBtn")?.addEventListener("click", () => {
    document.getElementById("openScannerBtn")?.click();
});
document.getElementById("overviewReportMaintenanceBtn")?.addEventListener("click", () => {
    switchTab("tab-maintenance");
    document.getElementById("reportMaintenanceBtn")?.click();
});
document.getElementById("overviewExportCsvBtn")?.addEventListener("click", () => {
    exportInventoryCSV();
});

// ==========================================================================
// STATS & METRICS AGGREGATION
// ==========================================================================

function updateDashboardStats() {
    const total = allEquipment.length;
    const available = allEquipment.filter(item => item.status === "Available").length;
    const borrowed = allEquipment.filter(item => item.status === "Borrowed").length;
    const maintenance = allEquipment.filter(item =>
        item.status === "Under Maintenance" || item.status === "Maintenance"
    ).length;

    const todayObj = parseDate(new Date());
    const overdueCount = allBorrowings.filter(b => {
        if (b.status !== "Active") return false;
        const dueObj = parseDate(b.dueDate);
        return dueObj < todayObj;
    }).length;

    const pendingRequestsCount = allRequests.filter(r => r.status === "Pending").length;
    const pendingStudentsCount = allStudents.filter(s => s.role === "student" && s.status === "pending").length;

    // Text Content Updates
    const totalEl = document.getElementById("totalEquipment");
    if (totalEl) totalEl.textContent = total;

    const availEl = document.getElementById("availableEquipment");
    if (availEl) availEl.textContent = available;

    const borrowEl = document.getElementById("borrowedEquipment");
    if (borrowEl) borrowEl.textContent = borrowed;

    const maintEl = document.getElementById("maintenanceEquipment");
    if (maintEl) maintEl.textContent = maintenance;

    const overdueEl = document.getElementById("overdueEquipment");
    if (overdueEl) overdueEl.textContent = overdueCount;

    const pendingStudEl = document.getElementById("overviewPendingStudents");
    if (pendingStudEl) pendingStudEl.textContent = pendingStudentsCount;

    // Tab Badges
    const invBadge = document.getElementById("tabInventoryCount");
    if (invBadge) invBadge.textContent = total;

    const reqBadge = document.getElementById("tabRequestsBadge");
    if (reqBadge) {
        reqBadge.textContent = pendingRequestsCount;
        if (pendingRequestsCount > 0) {
            reqBadge.classList.add("badge-alert");
        } else {
            reqBadge.classList.remove("badge-alert");
        }
    }

    const loansBadge = document.getElementById("tabLoansBadge");
    if (loansBadge) {
        loansBadge.textContent = allBorrowings.filter(b => b.status === "Active").length;
    }

    const maintBadge = document.getElementById("tabMaintenanceBadge");
    if (maintBadge) {
        const openMaint = allMaintenance.filter(m => m.status !== "Resolved").length;
        maintBadge.textContent = openMaint;
    }

    const studBadge = document.getElementById("tabStudentsBadge");
    if (studBadge) {
        studBadge.textContent = pendingStudentsCount;
        if (pendingStudentsCount > 0) {
            studBadge.classList.add("badge-alert");
        } else {
            studBadge.classList.remove("badge-alert");
        }
    }

    // Overdue Alert styling
    const overdueCard = document.getElementById("overdueCard");
    if (overdueCard) {
        if (overdueCount > 0) {
            overdueCard.style.borderColor = "var(--danger)";
            overdueCard.style.boxShadow = "0 0 0 2px rgba(220, 38, 38, 0.2)";
        } else {
            overdueCard.style.borderColor = "var(--slate-200)";
            overdueCard.style.boxShadow = "var(--shadow-sm)";
        }
    }
}

// ==========================================================================
// EQUIPMENT INVENTORY MANAGEMENT
// ==========================================================================

const equipmentTable = document.getElementById("equipmentTable");
const searchEquipment = document.getElementById("searchEquipment");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const filterCondition = document.getElementById("filterCondition");

const addEquipmentBtn = document.getElementById("addEquipmentBtn");
const equipmentModal = document.getElementById("equipmentModal");
const closeModal = document.getElementById("closeModal");
const equipmentForm = document.getElementById("equipmentForm");
const equipmentModalTitle = document.getElementById("equipmentModalTitle");
const equipmentMessage = document.getElementById("equipmentMessage");
const saveEquipmentBtn = document.getElementById("saveEquipmentBtn");

function applyEquipmentFilters() {
    const searchVal = (searchEquipment?.value || "").trim().toLowerCase();
    const catVal = filterCategory?.value || "";
    const statusVal = filterStatus?.value || "";
    const condVal = filterCondition?.value || "";

    const filtered = allEquipment.filter(item => {
        const matchesSearch = !searchVal ||
            (item.equipmentId || "").toLowerCase().includes(searchVal) ||
            (item.name || "").toLowerCase().includes(searchVal) ||
            (item.location || "").toLowerCase().includes(searchVal);

        const matchesCat = !catVal || item.category === catVal;
        const matchesStatus = !statusVal || item.status === statusVal;
        const matchesCond = !condVal || item.condition === condVal;

        return matchesSearch && matchesCat && matchesStatus && matchesCond;
    });

    renderEquipmentTable(filtered);
}

searchEquipment?.addEventListener("input", applyEquipmentFilters);
filterCategory?.addEventListener("change", applyEquipmentFilters);
filterStatus?.addEventListener("change", applyEquipmentFilters);
filterCondition?.addEventListener("change", applyEquipmentFilters);

function renderEquipmentTable(items) {
    if (!equipmentTable) return;

    if (items.length === 0) {
        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty-state">
                    <p>No equipment matching your filters.</p>
                </td>
            </tr>
        `;
        return;
    }

    equipmentTable.innerHTML = items.map(item => {
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

        const isAvailable = item.status === "Available";

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                <td><strong>${escapeHTML(item.name)}</strong></td>
                <td>${escapeHTML(item.category || "General")}</td>
                <td>${escapeHTML(item.location || "Lab")}</td>
                <td><span class="badge ${condClass}">${escapeHTML(item.condition || "Good")}</span></td>
                <td><span class="badge ${statusClass}">${escapeHTML(item.status || "Available")}</span></td>
                <td>
                    <div class="action-btn-group">
                        <button class="edit-btn" data-id="${escapeHTML(item.documentId)}" title="Edit">
                            Edit
                        </button>
                        <button class="qr-btn" data-id="${escapeHTML(item.documentId)}" title="QR Code">
                            QR Code
                        </button>
                        ${isAvailable ? `
                            <button class="issue-btn" data-id="${escapeHTML(item.documentId)}" title="Issue to Student">
                                Issue
                            </button>
                        ` : ''}
                        <button class="delete-btn" data-id="${escapeHTML(item.documentId)}" title="Delete" ${item.status === "Borrowed" ? "disabled" : ""}>
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// Live Equipment Firestore Listener
function startEquipmentListener() {
    onSnapshot(collection(db, "equipment"), (snapshot) => {
        allEquipment = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        applyEquipmentFilters();
        // Synchronize requests and active borrowings
        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Equipment listener error:", error);
        showToast("Error loading equipment catalog.", "error");
    });
}

// Add Equipment Modal Open
addEquipmentBtn?.addEventListener("click", () => {
    editingEquipmentId = null;
    equipmentForm.reset();
    document.getElementById("equipmentId").disabled = false;
    if (equipmentModalTitle) equipmentModalTitle.textContent = "Add New Equipment";
    if (saveEquipmentBtn) saveEquipmentBtn.textContent = "Save Equipment";
    if (equipmentMessage) equipmentMessage.textContent = "";
    equipmentModal.style.display = "flex";
});

// Close Modal
closeModal?.addEventListener("click", () => {
    equipmentModal.style.display = "none";
});
equipmentModal?.addEventListener("click", (e) => {
    if (e.target === equipmentModal) equipmentModal.style.display = "none";
});

// Save / Edit Equipment Form
if (equipmentForm) {
    equipmentForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const eqId = document.getElementById("equipmentId").value.trim().toUpperCase();
        const name = document.getElementById("equipmentName").value.trim();
        const category = document.getElementById("category").value;
        const location = document.getElementById("location").value.trim();
        const condition = document.getElementById("condition").value;

        if (!eqId || !name || !category || !location || !condition) {
            showToast("Please fill in all equipment details.", "warning");
            return;
        }

        saveEquipmentBtn.disabled = true;
        equipmentMessage.textContent = "Saving equipment...";
        equipmentMessage.style.color = "var(--primary)";

        try {
            const equipmentRef = doc(db, "equipment", eqId);

            if (editingEquipmentId) {
                const targetRef = doc(db, "equipment", editingEquipmentId);
                await updateDoc(targetRef, {
                    name,
                    category,
                    location,
                    condition,
                    updatedAt: new Date()
                });
                showToast(`Equipment ${name} updated successfully!`, "success");
            } else {
                const existing = await getDoc(equipmentRef);
                if (existing.exists()) {
                    throw new Error(`Equipment ID "${eqId}" is already registered!`);
                }

                await setDoc(equipmentRef, {
                    equipmentId: eqId,
                    name,
                    category,
                    location,
                    condition,
                    status: "Available",
                    createdAt: new Date(),
                    createdBy: currentUser?.uid || ""
                });
                showToast(`Equipment ${eqId} added successfully!`, "success");
            }

            equipmentModal.style.display = "none";
            equipmentForm.reset();
        } catch (error) {
            console.error("Save equipment error:", error);
            equipmentMessage.textContent = error.message;
            equipmentMessage.style.color = "var(--danger)";
            showToast(error.message, "error");
        } finally {
            saveEquipmentBtn.disabled = false;
        }
    });
}

// Edit & Delete & Issue & QR Click Handlers on Inventory Table
equipmentTable?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".edit-btn");
    const deleteBtn = e.target.closest(".delete-btn");
    const qrBtn = e.target.closest(".qr-btn");
    const issueBtn = e.target.closest(".issue-btn");

    if (editBtn) {
        const docId = editBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (!item) return;

        editingEquipmentId = docId;
        document.getElementById("equipmentId").value = item.equipmentId;
        document.getElementById("equipmentId").disabled = true;
        document.getElementById("equipmentName").value = item.name;
        document.getElementById("category").value = item.category;
        document.getElementById("location").value = item.location;
        document.getElementById("condition").value = item.condition;

        if (equipmentModalTitle) equipmentModalTitle.textContent = "Edit Equipment";
        if (saveEquipmentBtn) saveEquipmentBtn.textContent = "Update Equipment";
        if (equipmentMessage) equipmentMessage.textContent = "";

        equipmentModal.style.display = "flex";
        return;
    }

    if (deleteBtn) {
        const docId = deleteBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (!item) return;

        if (item.status === "Borrowed") {
            showToast("Cannot delete equipment currently issued on loan!", "error");
            return;
        }

        const confirmed = confirm(`Are you sure you want to permanently delete "${item.name}" (${item.equipmentId})?`);
        if (!confirmed) return;

        try {
            deleteBtn.disabled = true;
            await deleteDoc(doc(db, "equipment", docId));
            showToast(`Equipment ${item.equipmentId} deleted.`, "info");
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Failed to delete equipment.", "error");
            deleteBtn.disabled = false;
        }
        return;
    }

    if (qrBtn) {
        const docId = qrBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (!item) return;
        openQrModal(item);
        return;
    }

    if (issueBtn) {
        const docId = issueBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (!item) return;
        openIssueModal(item);
        return;
    }
});

// ==========================================================================
// QR CODE GENERATION & PRINTING
// ==========================================================================

const qrModal = document.getElementById("qrModal");
const closeQrModal = document.getElementById("closeQrModal");
const qrCodeContainer = document.getElementById("qrCodeContainer");
const qrEquipmentName = document.getElementById("qrEquipmentName");
const qrEquipmentId = document.getElementById("qrEquipmentId");
const downloadQrBtn = document.getElementById("downloadQrBtn");
const printQrBtn = document.getElementById("printQrBtn");

async function openQrModal(item) {
    if (!qrModal || !qrCodeContainer) return;
    currentQrEquipment = item;

    if (qrEquipmentName) qrEquipmentName.textContent = item.name;
    if (qrEquipmentId) qrEquipmentId.textContent = `Asset ID: ${item.equipmentId} | ${item.location}`;

    qrCodeContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 190px; color: var(--slate-500);">
            <div style="width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px;"></div>
            <span style="font-size: 12px;">Generating QR via Python Service...</span>
        </div>
    `;

    qrModal.style.display = "flex";

    try {
        const response = await fetch(`/api/generate-qr?id=${encodeURIComponent(item.equipmentId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const qrSrc = data.qrDataUrl || data.dataUrl;
        if (qrSrc) {
            qrCodeContainer.innerHTML = `
                <img id="activeQrImage" src="${qrSrc}" alt="QR code for ${escapeHTML(item.equipmentId)}" style="width: 190px; height: 190px; display: block; margin: 0 auto; border-radius: 6px;" />
            `;
            return;
        }
        throw new Error(data.error || "No dataUrl returned");
    } catch (err) {
        console.warn("Python backend QR generation failed, using fallback:", err);
        qrCodeContainer.innerHTML = "";
        if (window.QRCode) {
            new window.QRCode(qrCodeContainer, {
                text: item.equipmentId,
                width: 190,
                height: 190,
                correctLevel: window.QRCode.CorrectLevel.H
            });
        } else {
            qrCodeContainer.innerHTML = `<p style="color: var(--danger)">QR generation failed.</p>`;
        }
    }
}

closeQrModal?.addEventListener("click", () => {
    qrModal.style.display = "none";
});
qrModal?.addEventListener("click", (e) => {
    if (e.target === qrModal) qrModal.style.display = "none";
});

downloadQrBtn?.addEventListener("click", () => {
    if (!currentQrEquipment) return;
    const canvas = qrCodeContainer?.querySelector("canvas");
    const img = qrCodeContainer?.querySelector("img");
    let url = img ? img.src : (canvas ? canvas.toDataURL("image/png") : null);

    if (!url) {
        showToast("QR code preview is generating, please wait...", "warning");
        return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `PGDAV-LabTrack-QR-${currentQrEquipment.equipmentId}.png`;
    a.click();
    showToast("QR code downloaded successfully!", "success");
});

printQrBtn?.addEventListener("click", () => {
    if (!currentQrEquipment) return;
    const img = qrCodeContainer?.querySelector("img");
    const canvas = qrCodeContainer?.querySelector("canvas");
    const src = img ? img.src : (canvas ? canvas.toDataURL("image/png") : null);

    if (!src) {
        showToast("QR code is not ready to print.", "warning");
        return;
    }

    const printWin = window.open("", "_blank", "width=500,height=600");
    if (!printWin) {
        window.print();
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Equipment QR Tag - ${escapeHTML(currentQrEquipment.equipmentId)}</title>
            <style>
                @page { margin: 10mm; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 90vh;
                    margin: 0;
                    background: #fff;
                    color: #0f172a;
                }
                .label-card {
                    border: 2px dashed #0284c7;
                    border-radius: 12px;
                    padding: 24px;
                    text-align: center;
                    width: 320px;
                    background: #f8fafc;
                }
                .label-title {
                    font-size: 18px;
                    font-weight: 800;
                    margin-bottom: 4px;
                    color: #0f172a;
                }
                .label-badge {
                    display: inline-block;
                    background: #e0f2fe;
                    color: #0369a1;
                    font-weight: 700;
                    font-size: 13px;
                    padding: 3px 10px;
                    border-radius: 999px;
                    margin-bottom: 12px;
                }
                .qr-img {
                    width: 190px;
                    height: 190px;
                    margin: 0 auto 12px;
                    display: block;
                    background: #fff;
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                .label-meta {
                    font-size: 12px;
                    color: #475569;
                    line-height: 1.6;
                }
                .label-footer {
                    margin-top: 14px;
                    font-size: 10px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            </style>
        </head>
        <body>
            <div class="label-card">
                <div class="label-title">${escapeHTML(currentQrEquipment.name)}</div>
                <div class="label-badge">ID: ${escapeHTML(currentQrEquipment.equipmentId)}</div>
                <img class="qr-img" src="${src}" alt="QR Code" />
                <div class="label-meta">
                    <div><strong>Category:</strong> ${escapeHTML(currentQrEquipment.category || "General")}</div>
                    <div><strong>Location:</strong> ${escapeHTML(currentQrEquipment.location || "N/A")}</div>
                    <div><strong>Condition:</strong> ${escapeHTML(currentQrEquipment.condition || "Good")}</div>
                </div>
                <div class="label-footer">PGDAV LabTrack Asset Tag • Python QR Backend Service</div>
            </div>
            <script>
                window.onload = function() {
                    window.focus();
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
});

// ==========================================================================
// ISSUE EQUIPMENT MODAL & TRANSACTION
// ==========================================================================

const issueModal = document.getElementById("issueModal");
const closeIssueModal = document.getElementById("closeIssueModal");
const issueForm = document.getElementById("issueForm");
const issueEquipmentDocId = document.getElementById("issueEquipmentDocId");
const issueEquipmentId = document.getElementById("issueEquipmentId");
const issueEquipmentName = document.getElementById("issueEquipmentName");
const issueStudent = document.getElementById("issueStudent");
const issueDateInput = document.getElementById("issueDate");
const dueDateInput = document.getElementById("dueDate");
const confirmIssueBtn = document.getElementById("confirmIssueBtn");
const issueMessage = document.getElementById("issueMessage");

function openIssueModal(equipment, defaultStudentUid = null) {
    if (!issueModal) return;

    issueForm.reset();
    issueEquipmentDocId.value = equipment.documentId;
    issueEquipmentId.value = equipment.equipmentId;
    issueEquipmentName.value = equipment.name;

    // Set ISO dates for browser pickers
    issueDateInput.value = getTodayDateISO();

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yyyy = nextWeek.getFullYear();
    const mm = String(nextWeek.getMonth() + 1).padStart(2, "0");
    const dd = String(nextWeek.getDate()).padStart(2, "0");
    dueDateInput.value = `${yyyy}-${mm}-${dd}`;

    if (issueMessage) issueMessage.textContent = "";

    loadApprovedStudents(defaultStudentUid);
    issueModal.style.display = "flex";
}

closeIssueModal?.addEventListener("click", () => {
    issueModal.style.display = "none";
});
issueModal?.addEventListener("click", (e) => {
    if (e.target === issueModal) issueModal.style.display = "none";
});

async function loadApprovedStudents(selectUid = null) {
    if (!issueStudent) return;
    issueStudent.innerHTML = `<option value="">Loading students...</option>`;

    try {
        const approved = allStudents.filter(s => s.role === "student" && s.status === "approved" && s.active === true);
        if (approved.length === 0) {
            issueStudent.innerHTML = `<option value="">No approved students found</option>`;
            return;
        }

        issueStudent.innerHTML = `<option value="">Select an approved student</option>` +
            approved.map(s => `
                <option value="${escapeHTML(s.uid)}" ${selectUid === s.uid ? "selected" : ""}>
                    ${escapeHTML(s.name || "Student")} (${escapeHTML(s.email)})
                </option>
            `).join("");
    } catch (err) {
        console.error("Load students error:", err);
        issueStudent.innerHTML = `<option value="">Error loading students</option>`;
    }
}

if (issueForm) {
    issueForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const eqDocId = issueEquipmentDocId.value;
        const studentUid = issueStudent.value;
        const rawIssueDate = issueDateInput.value;
        const rawDueDate = dueDateInput.value;

        if (!eqDocId || !studentUid || !rawIssueDate || !rawDueDate) {
            showToast("Please fill all issue fields.", "warning");
            return;
        }

        if (parseDate(rawDueDate) < parseDate(rawIssueDate)) {
            showToast("Due date cannot be before issue date.", "warning");
            return;
        }

        // Store formatted DD-MM-YYYY dates
        const formattedIssueDate = formatDate(rawIssueDate);
        const formattedDueDate = formatDate(rawDueDate);

        confirmIssueBtn.disabled = true;
        if (issueMessage) {
            issueMessage.textContent = "Issuing equipment...";
            issueMessage.style.color = "var(--primary)";
        }

        try {
            const equipmentRef = doc(db, "equipment", eqDocId);
            const studentRef = doc(db, "users", studentUid);
            const borrowingRef = doc(collection(db, "borrowings"));

            await runTransaction(db, async (transaction) => {
                const eqSnap = await transaction.get(equipmentRef);
                const stSnap = await transaction.get(studentRef);

                if (!eqSnap.exists()) throw new Error("Equipment does not exist.");
                if (!stSnap.exists()) throw new Error("Student record does not exist.");

                const eqData = eqSnap.data();
                const stData = stSnap.data();

                if (eqData.status !== "Available") {
                    throw new Error("This equipment is not available for issue.");
                }

                transaction.set(borrowingRef, {
                    borrowingId: borrowingRef.id,
                    equipmentDocId: eqDocId,
                    equipmentId: eqData.equipmentId,
                    equipmentName: eqData.name,
                    studentUid: studentUid,
                    studentName: stData.name || "Student",
                    studentEmail: stData.email || "",
                    issueDate: formattedIssueDate,
                    dueDate: formattedDueDate,
                    status: "Active",
                    issuedByUid: currentUser?.uid || "",
                    createdAt: new Date()
                });

                transaction.update(equipmentRef, {
                    status: "Borrowed",
                    currentBorrowingId: borrowingRef.id
                });
            });

            showToast("Equipment issued successfully!", "success");
            issueModal.style.display = "none";
            issueForm.reset();
        } catch (error) {
            console.error("Issue error:", error);
            showToast(error.message, "error");
            if (issueMessage) {
                issueMessage.textContent = error.message;
                issueMessage.style.color = "var(--danger)";
            }
        } finally {
            confirmIssueBtn.disabled = false;
        }
    });
}

// ==========================================================================
// ACTIVE BORROWINGS & RETURNS (SYNCHRONIZED WITH DD-MM-YYYY)
// ==========================================================================

const activeBorrowingsTable = document.getElementById("activeBorrowingsTable");
const filterLoansStatus = document.getElementById("filterLoansStatus");

const returnModal = document.getElementById("returnModal");
const closeReturnModal = document.getElementById("closeReturnModal");
const returnForm = document.getElementById("returnForm");
const returnBorrowingId = document.getElementById("returnBorrowingId");
const returnEquipmentDocId = document.getElementById("returnEquipmentDocId");
const returnEquipmentInfo = document.getElementById("returnEquipmentInfo");
const returnStudentInfo = document.getElementById("returnStudentInfo");
const returnCondition = document.getElementById("returnCondition");
const returnNotes = document.getElementById("returnNotes");
const confirmReturnBtn = document.getElementById("confirmReturnBtn");
const returnMessage = document.getElementById("returnMessage");

function startActiveBorrowingsListener() {
    onSnapshot(collection(db, "borrowings"), (snapshot) => {
        allBorrowings = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        renderActiveBorrowingsTable();
        // Synchronize requests as well
        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Borrowings error:", error);
        showToast("Error loading active borrowings.", "error");
    });
}

filterLoansStatus?.addEventListener("change", renderActiveBorrowingsTable);

function renderActiveBorrowingsTable() {
    if (!activeBorrowingsTable) return;

    const filter = filterLoansStatus?.value || "All";
    const todayObj = parseDate(new Date());

    const activeList = allBorrowings.filter(b => b.status === "Active");
    let displayList = activeList;

    if (filter === "Overdue") {
        displayList = activeList.filter(b => parseDate(b.dueDate) < todayObj);
    } else if (filter === "Normal") {
        displayList = activeList.filter(b => parseDate(b.dueDate) >= todayObj);
    }

    if (displayList.length === 0) {
        activeBorrowingsTable.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty-state">
                    <p>No active borrowings found.</p>
                </td>
            </tr>
        `;
        return;
    }

    activeBorrowingsTable.innerHTML = displayList.map(item => {
        const dueObj = parseDate(item.dueDate);
        const diffMs = dueObj.getTime() - todayObj.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;

        let statusBadge = '';
        if (isOverdue) {
            const daysPast = Math.abs(diffDays);
            statusBadge = `<span class="badge badge-overdue">Overdue (${daysPast}d)</span>`;
        } else if (diffDays === 0) {
            statusBadge = `<span class="badge badge-pending">Due Today</span>`;
        } else {
            statusBadge = `<span class="badge badge-approved">Due in ${diffDays}d</span>`;
        }

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                <td>
                    ${escapeHTML(item.studentName)}
                    <div style="font-size: 11px; color: var(--slate-500);">${escapeHTML(item.studentEmail)}</div>
                </td>
                <td>${formatDate(item.issueDate)}</td>
                <td><strong>${formatDate(item.dueDate)}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="return-btn" data-id="${escapeHTML(item.documentId)}">
                        Return
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Return Button Click Handler
activeBorrowingsTable?.addEventListener("click", (e) => {
    const returnBtn = e.target.closest(".return-btn");
    if (!returnBtn) return;

    const borrowingId = returnBtn.dataset.id;
    const borrowing = allBorrowings.find(b => b.documentId === borrowingId);
    if (!borrowing) return;

    openReturnModal(borrowing);
});

function openReturnModal(borrowing) {
    if (!returnModal) return;

    returnForm.reset();
    returnBorrowingId.value = borrowing.documentId;
    returnEquipmentDocId.value = borrowing.equipmentDocId;
    returnEquipmentInfo.value = `${borrowing.equipmentId} - ${borrowing.equipmentName}`;
    returnStudentInfo.value = `${borrowing.studentName} (${borrowing.studentEmail})`;
    returnCondition.value = "Good";
    if (returnMessage) returnMessage.textContent = "";

    returnModal.style.display = "flex";
}

closeReturnModal?.addEventListener("click", () => {
    returnModal.style.display = "none";
});
returnModal?.addEventListener("click", (e) => {
    if (e.target === returnModal) returnModal.style.display = "none";
});

// Process Return Form Submission
if (returnForm) {
    returnForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const bId = returnBorrowingId.value;
        const eqDocId = returnEquipmentDocId.value;
        const condition = returnCondition.value;
        const notes = returnNotes.value.trim();

        confirmReturnBtn.disabled = true;
        if (returnMessage) {
            returnMessage.textContent = "Processing return...";
            returnMessage.style.color = "var(--primary)";
        }

        try {
            const borrowingRef = doc(db, "borrowings", bId);
            const equipmentRef = doc(db, "equipment", eqDocId);

            await runTransaction(db, async (transaction) => {
                const bSnap = await transaction.get(borrowingRef);
                const eqSnap = await transaction.get(equipmentRef);

                if (!bSnap.exists()) throw new Error("Borrowing record not found.");
                if (!eqSnap.exists()) throw new Error("Equipment record not found.");

                const borrowingData = bSnap.data();
                const eqData = eqSnap.data();

                transaction.update(borrowingRef, {
                    status: "Returned",
                    returnDate: getTodayDateDMY(),
                    returnCondition: condition,
                    returnNotes: notes,
                    returnedByAdminUid: currentUser?.uid || ""
                });

                const newStatus = condition === "Damaged" ? "Under Maintenance" : "Available";
                transaction.update(equipmentRef, {
                    status: newStatus,
                    condition: condition,
                    currentBorrowingId: null
                });

                if (condition === "Damaged") {
                    const maintRef = doc(collection(db, "maintenance"));
                    transaction.set(maintRef, {
                        equipmentDocId: eqDocId,
                        equipmentId: eqData.equipmentId,
                        equipmentName: eqData.name,
                        description: `Returned damaged by ${borrowingData.studentName}. Notes: ${notes || "No notes provided."}`,
                        reportDate: getTodayDateDMY(),
                        status: "Open",
                        reportedByUid: currentUser?.uid || "",
                        createdAt: new Date()
                    });
                }
            });

            showToast("Equipment return processed successfully!", "success");
            returnModal.style.display = "none";
        } catch (error) {
            console.error("Return error:", error);
            showToast(error.message, "error");
            if (returnMessage) {
                returnMessage.textContent = error.message;
                returnMessage.style.color = "var(--danger)";
            }
        } finally {
            confirmReturnBtn.disabled = false;
        }
    });
}

// ==========================================================================
// TAB 3: BORROWING REQUESTS (SYNCHRONIZED WITH LIVE EQUIPMENT & DATES)
// ==========================================================================

const borrowingRequestsTable = document.getElementById("borrowingRequestsTable");
const filterRequestsStatus = document.getElementById("filterRequestsStatus");
const filterRequestsAttendant = document.getElementById("filterRequestsAttendant");

const rejectRequestModal = document.getElementById("rejectRequestModal");
const closeRejectRequestModal = document.getElementById("closeRejectRequestModal");
const rejectRequestForm = document.getElementById("rejectRequestForm");
const rejectRequestId = document.getElementById("rejectRequestId");
const rejectRequestSummary = document.getElementById("rejectRequestSummary");
const rejectionReason = document.getElementById("rejectionReason");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");

function startBorrowingRequestsListener() {
    onSnapshot(collection(db, "requests"), (snapshot) => {
        allRequests = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Requests listener error:", error);
    });
}

filterRequestsStatus?.addEventListener("change", renderBorrowingRequestsTable);
filterRequestsAttendant?.addEventListener("change", renderBorrowingRequestsTable);

function renderBorrowingRequestsTable() {
    if (!borrowingRequestsTable) return;

    const filter = filterRequestsStatus?.value || "Pending";
    const attendantFilter = filterRequestsAttendant?.value || "All";

    let list = allRequests;

    if (filter === "Pending") {
        list = allRequests.filter(r => r.status === "Pending");
    } else if (filter !== "All") {
        list = allRequests.filter(r => r.status === filter);
    }

    if (attendantFilter !== "All") {
        list = list.filter(r => {
            const att = (r.labAttendant || "").toLowerCase();
            const cat = (r.category || "").toLowerCase();
            const target = attendantFilter.toLowerCase();
            return att.includes(target) || cat.includes(target);
        });
    }

    if (list.length === 0) {
        borrowingRequestsTable.innerHTML = `
            <tr>
                <td colspan="9" class="table-empty-state">
                    <p>No ${filter.toLowerCase()} equipment requests matching the selected filter.</p>
                </td>
            </tr>
        `;
        return;
    }

    borrowingRequestsTable.innerHTML = list.map(req => {
        const isPending = req.status === "Pending";
        const isApproved = req.status === "Approved";
        const isRejected = req.status === "Rejected";

        // Synchronize with LIVE equipment inventory
        const liveEquipment = allEquipment.find(e =>
            (req.equipmentDocId && e.documentId === req.equipmentDocId) ||
            (req.equipmentId && e.equipmentId === req.equipmentId)
        );

        const liveStatus = liveEquipment ? liveEquipment.status : "Unknown";
        const isLiveAvailable = liveStatus === "Available";

        const liveStatusBadgeClass = {
            "Available": "badge-available",
            "Borrowed": "badge-borrowed",
            "Under Maintenance": "badge-maintenance",
            "Maintenance": "badge-maintenance"
        }[liveStatus] || "badge";

        let statusBadge = '<span class="badge">Unknown</span>';
        if (isPending) {
            statusBadge = '<span class="badge badge-pending">Pending Review</span>';
        } else if (isApproved) {
            statusBadge = '<span class="badge badge-approved">Approved & Issued</span>';
        } else if (isRejected) {
            statusBadge = `<span class="badge badge-rejected" title="${escapeHTML(req.rejectionReason || 'No reason')}">Rejected</span>`;
        }

        // Format dates as DD-MM-YYYY
        const formattedFrom = formatDate(req.fromDate);
        const formattedTo = formatDate(req.toDate);
        const formattedCreated = formatDate(req.createdAt);

        // Respective Lab Attendant
        const attendantName = req.labAttendant || (liveEquipment?.category ? `${liveEquipment.category} Lab Attendant` : (req.category ? `${req.category} Lab Attendant` : "General Lab Attendant"));

        // Actions column: if item is not available, provide contextual warning
        let actionCellContent = '';
        if (isPending) {
            if (isLiveAvailable) {
                actionCellContent = `
                    <div class="action-btn-group">
                        <button class="btn btn-success btn-sm approve-request-btn" data-id="${escapeHTML(req.documentId)}">
                            Approve & Issue
                        </button>
                        <button class="btn btn-danger btn-sm reject-request-btn" data-id="${escapeHTML(req.documentId)}">
                            Reject
                        </button>
                    </div>
                `;
            } else {
                actionCellContent = `
                    <div class="action-btn-group">
                        <span class="badge ${liveStatus === 'Borrowed' ? 'badge-borrowed' : 'badge-maintenance'}" style="font-size: 11px;">
                            ${liveStatus === 'Borrowed' ? 'Currently on Loan' : 'In Repair'}
                        </span>
                        <button class="btn btn-danger btn-sm reject-request-btn" data-id="${escapeHTML(req.documentId)}" title="Reject this request">
                            Reject
                        </button>
                    </div>
                `;
            }
        } else if (isApproved) {
            actionCellContent = `<span style="font-size: 12px; color: var(--success); font-weight: 600;">✓ Issued</span>`;
        } else {
            actionCellContent = `<span style="font-size: 12px; color: var(--slate-400)">Closed</span>`;
        }

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(req.studentName || "Student")}</strong>
                    ${req.studentRollNo ? `<div style="font-size: 11.5px; color: var(--primary); font-weight: 600;">Roll: ${escapeHTML(req.studentRollNo)}</div>` : ''}
                    ${req.studentCourse ? `<div style="font-size: 11px; color: var(--slate-600);">${escapeHTML(req.studentCourse)}</div>` : ''}
                    <div style="font-size: 11px; color: var(--slate-500);">${escapeHTML(req.studentEmail || "")}</div>
                </td>
                <td>
                    <strong>${escapeHTML(req.equipmentName || "Equipment")}</strong>
                    <div class="mono-id" style="font-size: 11px;">${escapeHTML(req.equipmentId || "")}</div>
                </td>
                <td>
                    <span class="badge ${liveStatusBadgeClass}">
                        ${escapeHTML(liveStatus)}
                    </span>
                </td>
                <td>
                    <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:600;">
                        👤 ${escapeHTML(attendantName)}
                    </span>
                </td>
                <td>
                    ${formattedFrom} <span style="color: var(--slate-400)">to</span> ${formattedTo}
                </td>
                <td>${escapeHTML(req.purpose || "Academic Lab")}</td>
                <td>${formattedCreated}</td>
                <td>${statusBadge}</td>
                <td>${actionCellContent}</td>
            </tr>
        `;
    }).join("");
}

// Request Table Click Handlers
borrowingRequestsTable?.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest(".approve-request-btn");
    const rejectBtn = e.target.closest(".reject-request-btn");

    if (approveBtn) {
        const reqId = approveBtn.dataset.id;
        const req = allRequests.find(r => r.documentId === reqId);
        if (!req) return;

        approveBtn.disabled = true;

        try {
            const equipmentRef = doc(db, "equipment", req.equipmentDocId || req.equipmentId);
            const requestRef = doc(db, "requests", reqId);
            const borrowingRef = doc(collection(db, "borrowings"));

            await runTransaction(db, async (transaction) => {
                const eqSnap = await transaction.get(equipmentRef);
                const reqSnap = await transaction.get(requestRef);

                if (!eqSnap.exists()) throw new Error("Equipment record not found.");
                if (!reqSnap.exists()) throw new Error("Request record no longer exists.");

                const eqData = eqSnap.data();
                if (eqData.status !== "Available") {
                    throw new Error(`Equipment is currently ${eqData.status}. Cannot approve request.`);
                }

                // Format dates in DD-MM-YYYY
                const issueDateFormatted = formatDate(req.fromDate) || getTodayDateDMY();
                const dueDateFormatted = formatDate(req.toDate) || getTodayDateDMY();

                // 1. Mark request Approved
                transaction.update(requestRef, {
                    status: "Approved",
                    reviewedAt: new Date(),
                    reviewedByUid: currentUser?.uid || ""
                });

                // 2. Create active borrowing
                transaction.set(borrowingRef, {
                    borrowingId: borrowingRef.id,
                    equipmentDocId: req.equipmentDocId || equipmentRef.id,
                    equipmentId: req.equipmentId || eqData.equipmentId,
                    equipmentName: req.equipmentName || eqData.name,
                    studentUid: req.studentUid,
                    studentName: req.studentName || "Student",
                    studentEmail: req.studentEmail || "",
                    issueDate: issueDateFormatted,
                    dueDate: dueDateFormatted,
                    status: "Active",
                    purpose: req.purpose || "",
                    issuedByUid: currentUser?.uid || "",
                    createdAt: new Date()
                });

                // 3. Mark equipment Borrowed
                transaction.update(equipmentRef, {
                    status: "Borrowed",
                    currentBorrowingId: borrowingRef.id
                });
            });

            showToast(`Request for ${req.equipmentName} approved & issued!`, "success");
        } catch (error) {
            console.error("Approve request error:", error);
            showToast(error.message, "error");
            approveBtn.disabled = false;
        }
        return;
    }

    if (rejectBtn) {
        const reqId = rejectBtn.dataset.id;
        const req = allRequests.find(r => r.documentId === reqId);
        if (!req) return;

        rejectRequestId.value = reqId;
        rejectRequestSummary.value = `${req.equipmentName} for ${req.studentName}`;
        rejectionReason.value = "";
        rejectRequestModal.style.display = "flex";
    }
});

closeRejectRequestModal?.addEventListener("click", () => {
    rejectRequestModal.style.display = "none";
});
rejectRequestModal?.addEventListener("click", (e) => {
    if (e.target === rejectRequestModal) rejectRequestModal.style.display = "none";
});

if (rejectRequestForm) {
    rejectRequestForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const reqId = rejectRequestId.value;
        const reason = rejectionReason.value.trim();

        if (!reqId || !reason) {
            showToast("Please provide a rejection reason.", "warning");
            return;
        }

        confirmRejectBtn.disabled = true;
        try {
            await updateDoc(doc(db, "requests", reqId), {
                status: "Rejected",
                rejectionReason: reason,
                reviewedAt: new Date(),
                reviewedByUid: currentUser?.uid || ""
            });

            showToast("Request rejected.", "info");
            rejectRequestModal.style.display = "none";
        } catch (error) {
            console.error("Reject request error:", error);
            showToast("Failed to reject request.", "error");
        } finally {
            confirmRejectBtn.disabled = false;
        }
    });
}

// ==========================================================================
// MAINTENANCE MANAGEMENT
// ==========================================================================

const maintenanceTable = document.getElementById("maintenanceTable");
const reportMaintenanceBtn = document.getElementById("reportMaintenanceBtn");
const maintenanceModal = document.getElementById("maintenanceModal");
const closeMaintenanceModal = document.getElementById("closeMaintenanceModal");
const maintenanceForm = document.getElementById("maintenanceForm");
const maintenanceSelect = document.getElementById("maintenanceEquipmentSelect");
const maintenanceDescription = document.getElementById("maintenanceDescription");
const maintenanceDate = document.getElementById("maintenanceDate");
const saveMaintenanceBtn = document.getElementById("saveMaintenanceBtn");
const maintenanceMessage = document.getElementById("maintenanceMessage");

function startMaintenanceListener() {
    onSnapshot(collection(db, "maintenance"), (snapshot) => {
        allMaintenance = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        renderMaintenanceTable();
        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Maintenance listener error:", error);
    });
}

function renderMaintenanceTable() {
    if (!maintenanceTable) return;

    if (allMaintenance.length === 0) {
        maintenanceTable.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty-state">
                    <p>No maintenance records logged.</p>
                </td>
            </tr>
        `;
        return;
    }

    maintenanceTable.innerHTML = allMaintenance.map(item => {
        const isResolved = item.status === "Resolved";
        const statusBadge = isResolved
            ? '<span class="badge badge-approved">Resolved</span>'
            : '<span class="badge badge-maintenance">In Repair</span>';

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                <td>${escapeHTML(item.description)}</td>
                <td>${formatDate(item.reportDate)}</td>
                <td>${statusBadge}</td>
                <td>
                    ${!isResolved ? `
                        <button class="resolve-maintenance-btn" data-id="${escapeHTML(item.documentId)}">
                            Mark Resolved
                        </button>
                    ` : `<span style="font-size: 12px; color: var(--slate-400)">Fixed</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

function loadMaintenanceEquipmentDropdown() {
    if (!maintenanceSelect) return;
    maintenanceSelect.innerHTML = `<option value="">Select Equipment</option>`;

    const eligible = allEquipment.filter(item => item.status !== "Borrowed");
    eligible.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.documentId;
        opt.textContent = `${item.equipmentId} - ${item.name} (${item.status})`;
        maintenanceSelect.appendChild(opt);
    });
}

reportMaintenanceBtn?.addEventListener("click", () => {
    maintenanceForm.reset();
    if (maintenanceDate) maintenanceDate.value = getTodayDateISO();
    if (maintenanceMessage) maintenanceMessage.textContent = "";
    loadMaintenanceEquipmentDropdown();
    maintenanceModal.style.display = "flex";
});

closeMaintenanceModal?.addEventListener("click", () => {
    maintenanceModal.style.display = "none";
});
maintenanceModal?.addEventListener("click", (e) => {
    if (e.target === maintenanceModal) maintenanceModal.style.display = "none";
});

if (maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const eqDocId = maintenanceSelect.value;
        const desc = maintenanceDescription.value.trim();
        const rawDate = maintenanceDate.value;

        if (!eqDocId || !desc || !rawDate) {
            showToast("Please fill all maintenance report fields.", "warning");
            return;
        }

        const formattedDate = formatDate(rawDate);

        saveMaintenanceBtn.disabled = true;
        try {
            const equipmentRef = doc(db, "equipment", eqDocId);
            const maintenanceRef = doc(collection(db, "maintenance"));

            await runTransaction(db, async (transaction) => {
                const eqDoc = await transaction.get(equipmentRef);
                if (!eqDoc.exists()) throw new Error("Equipment not found.");
                const eq = eqDoc.data();

                if (eq.status === "Borrowed") {
                    throw new Error("Borrowed equipment cannot be reported for maintenance directly.");
                }

                transaction.set(maintenanceRef, {
                    equipmentDocId: eqDocId,
                    equipmentId: eq.equipmentId,
                    equipmentName: eq.name,
                    description: desc,
                    reportDate: formattedDate,
                    status: "Open",
                    reportedByUid: currentUser?.uid || "",
                    createdAt: new Date()
                });

                transaction.update(equipmentRef, {
                    status: "Under Maintenance"
                });
            });

            showToast("Maintenance ticket reported successfully!", "success");
            maintenanceModal.style.display = "none";
        } catch (error) {
            console.error("Maintenance error:", error);
            showToast(error.message, "error");
        } finally {
            saveMaintenanceBtn.disabled = false;
        }
    });
}

// Resolve Maintenance Button
maintenanceTable?.addEventListener("click", async (e) => {
    const resolveBtn = e.target.closest(".resolve-maintenance-btn");
    if (!resolveBtn) return;

    const mId = resolveBtn.dataset.id;
    const confirmed = confirm("Has this maintenance service been completed and the equipment restored to good condition?");
    if (!confirmed) return;

    resolveBtn.disabled = true;
    try {
        const mRef = doc(db, "maintenance", mId);

        await runTransaction(db, async (transaction) => {
            const mDoc = await transaction.get(mRef);
            if (!mDoc.exists()) throw new Error("Maintenance record not found.");
            const mData = mDoc.data();

            if (mData.status === "Resolved") throw new Error("Issue already resolved.");

            const eqRef = doc(db, "equipment", mData.equipmentDocId);
            const eqDoc = await transaction.get(eqRef);

            transaction.update(mRef, {
                status: "Resolved",
                resolvedAt: new Date(),
                resolvedByUid: currentUser?.uid || ""
            });

            if (eqDoc.exists()) {
                transaction.update(eqRef, {
                    status: "Available",
                    condition: "Good",
                    currentBorrowingId: null
                });
            }
        });

        showToast("Equipment maintenance marked resolved! Asset is now Available.", "success");
    } catch (error) {
        console.error("Resolve error:", error);
        showToast(error.message, "error");
        resolveBtn.disabled = false;
    }
});

// ==========================================================================
// STUDENT MANAGEMENT & APPROVALS (SYNCHRONIZED DATES)
// ==========================================================================

const pendingStudentsTable = document.getElementById("pendingStudentsTable");
const pendingStudentCount = document.getElementById("pendingStudentCount");
const approvedStudentsTable = document.getElementById("approvedStudentsTable");

const pendingAssistantsTable = document.getElementById("pendingAssistantsTable");
const pendingAssistantCount = document.getElementById("pendingAssistantCount");
const approvedAssistantsTable = document.getElementById("approvedAssistantsTable");

function startPendingStudentsListener() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allStudents = snapshot.docs.map(docSnap => ({
            uid: docSnap.id,
            ...docSnap.data()
        }));

        renderStudentManagement();
        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Users listener error:", error);
    });
}

function renderStudentManagement() {
    // 1. Pending Students
    const pendingList = allStudents.filter(s => s.role === "student" && s.status === "pending");
    if (pendingStudentCount) {
        pendingStudentCount.textContent = `${pendingList.length} Pending`;
    }

    if (pendingStudentsTable) {
        if (pendingList.length === 0) {
            pendingStudentsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <p>No pending student registration requests.</p>
                    </td>
                </tr>
            `;
        } else {
            pendingStudentsTable.innerHTML = pendingList.map(s => {
                const regDate = formatDate(s.createdAt);

                return `
                    <tr>
                        <td><strong>${escapeHTML(s.name || "Student")}</strong></td>
                        <td><span class="mono-id" style="font-size: 12px; font-weight: 700; color: var(--primary);">${escapeHTML(s.rollNo || "N/A")}</span></td>
                        <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHTML(s.course || "N/A")}</span></td>
                        <td>${escapeHTML(s.email || "N/A")}</td>
                        <td>${regDate}</td>
                        <td>
                            <div class="action-btn-group">
                                <button class="approve-student-btn" data-uid="${escapeHTML(s.uid)}">
                                    Approve
                                </button>
                                <button class="reject-student-btn" data-uid="${escapeHTML(s.uid)}">
                                    Reject
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }

    // 2. Approved Students Directory
    if (approvedStudentsTable) {
        const approvedList = allStudents.filter(s => s.role === "student" && s.status === "approved");
        if (approvedList.length === 0) {
            approvedStudentsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <p>No approved students registered yet.</p>
                    </td>
                </tr>
            `;
        } else {
            approvedStudentsTable.innerHTML = approvedList.map(s => {
                const activeLoansCount = allBorrowings.filter(b => b.studentUid === s.uid && b.status === "Active").length;
                return `
                    <tr>
                        <td><strong>${escapeHTML(s.name || "Student")}</strong></td>
                        <td><span class="mono-id" style="font-size: 12px; font-weight: 700; color: var(--primary);">${escapeHTML(s.rollNo || "N/A")}</span></td>
                        <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHTML(s.course || "N/A")}</span></td>
                        <td>${escapeHTML(s.email)}</td>
                        <td><span class="badge badge-approved">Approved</span></td>
                        <td>
                            <span class="badge ${activeLoansCount > 0 ? "badge-borrowed" : "badge-available"}">
                                ${activeLoansCount} Active Loan${activeLoansCount === 1 ? "" : "s"}
                            </span>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }

    // 3. Approved Lab Assistants Directory (Admin Managed)
    if (approvedAssistantsTable) {
        const approvedAssistants = allStudents.filter(s => s.role === "lab_assistant");
        if (approvedAssistants.length === 0) {
            approvedAssistantsTable.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty-state">
                        <p>No lab assistants registered yet. Click "+ Register New Lab Assistant" above to provision an assistant.</p>
                    </td>
                </tr>
            `;
        } else {
            approvedAssistantsTable.innerHTML = approvedAssistants.map(a => {
                const labDept = a.department || "";
                const labEqCount = allEquipment.filter(e => {
                    if (!e.category) return false;
                    const cat = e.category.toLowerCase().trim();
                    const dep = labDept.toLowerCase().trim();
                    return cat === dep || cat.includes(dep.replace(" lab", "")) || dep.includes(cat);
                }).length;

                return `
                    <tr>
                        <td><strong>${escapeHTML(a.name || "Lab Assistant")}</strong></td>
                        <td><span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight: 600;">${escapeHTML(a.department || "Unassigned")}</span></td>
                        <td>${escapeHTML(a.email || "N/A")}</td>
                        <td><span class="badge badge-approved">Approved</span></td>
                        <td>
                            <span class="badge badge-available">
                                ${labEqCount} Equipment Item${labEqCount === 1 ? "" : "s"}
                            </span>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }
}

// Student Approval Actions
pendingStudentsTable?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const studentUid = btn.dataset.uid;
    const isApprove = btn.classList.contains("approve-student-btn");
    const isReject = btn.classList.contains("reject-student-btn");
    if (!studentUid || (!isApprove && !isReject)) return;

    const action = isApprove ? "approve" : "reject";
    const confirmed = confirm(`Are you sure you want to ${action} this student account?`);
    if (!confirmed) return;

    btn.disabled = true;
    try {
        const studentRef = doc(db, "users", studentUid);
        if (isApprove) {
            await updateDoc(studentRef, {
                active: true,
                status: "approved",
                approvedAt: new Date()
            });
            showToast("Student account approved successfully!", "success");
        } else {
            await updateDoc(studentRef, {
                active: false,
                status: "rejected",
                rejectedAt: new Date()
            });
            showToast("Student account rejected.", "info");
        }
    } catch (error) {
        console.error("Student approval error:", error);
        showToast("Error updating student status.", "error");
        btn.disabled = false;
    }
});

// ==========================================================================
// SUPER ADMIN LAB ASSISTANT DIRECT REGISTRATION
// ==========================================================================

let secondaryAuthInstance = null;
let secondaryAppInstance = null;
function getSecondaryInstances() {
    if (!secondaryAppInstance) {
        secondaryAppInstance = initializeApp(firebaseConfig, "AssistantRegApp");
        secondaryAuthInstance = getAuth(secondaryAppInstance);
    }
    return { secApp: secondaryAppInstance, secAuth: secondaryAuthInstance };
}

const openRegisterAssistantBtn = document.getElementById("openRegisterAssistantBtn");
const closeRegisterAssistantModal = document.getElementById("closeRegisterAssistantModal");
const registerAssistantModal = document.getElementById("registerAssistantModal");
const registerAssistantForm = document.getElementById("registerAssistantForm");
const assistantRegName = document.getElementById("assistantRegName");
const assistantRegDepartment = document.getElementById("assistantRegDepartment");
const assistantRegEmail = document.getElementById("assistantRegEmail");
const assistantRegPassword = document.getElementById("assistantRegPassword");
const toggleRegAssistantPassword = document.getElementById("toggleRegAssistantPassword");
const saveAssistantBtn = document.getElementById("saveAssistantBtn");
const assistantRegMessage = document.getElementById("assistantRegMessage");

openRegisterAssistantBtn?.addEventListener("click", () => {
    registerAssistantForm?.reset();
    if (assistantRegMessage) assistantRegMessage.textContent = "";
    if (registerAssistantModal) registerAssistantModal.style.display = "flex";
});

closeRegisterAssistantModal?.addEventListener("click", () => {
    if (registerAssistantModal) registerAssistantModal.style.display = "none";
});

registerAssistantModal?.addEventListener("click", (e) => {
    if (e.target === registerAssistantModal) {
        registerAssistantModal.style.display = "none";
    }
});

toggleRegAssistantPassword?.addEventListener("click", () => {
    if (!assistantRegPassword) return;
    const isPw = assistantRegPassword.type === "password";
    assistantRegPassword.type = isPw ? "text" : "password";
    toggleRegAssistantPassword.textContent = isPw ? "🙈" : "👁️";
});

registerAssistantForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = assistantRegName.value.trim();
    const department = assistantRegDepartment.value;
    const email = assistantRegEmail.value.trim().toLowerCase();
    const password = assistantRegPassword.value;

    if (!name || !department || !email || !password) {
        showToast("Please fill in all lab assistant details.", "warning");
        return;
    }

    if (!isAuthorizedEmail(email)) {
        assistantRegMessage.textContent = "Please provide an authorized institutional email address.";
        assistantRegMessage.style.color = "var(--danger)";
        return;
    }

    if (password.length < 6) {
        assistantRegMessage.textContent = "Password must be at least 6 characters long.";
        assistantRegMessage.style.color = "var(--danger)";
        return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        assistantRegMessage.textContent = "Password must contain at least one letter and one number.";
        assistantRegMessage.style.color = "var(--danger)";
        return;
    }

    saveAssistantBtn.disabled = true;
    assistantRegMessage.textContent = "Provisioning lab assistant account...";
    assistantRegMessage.style.color = "var(--primary)";

    try {
        const { secApp, secAuth } = getSecondaryInstances();
        const secDb = getFirestore(secApp);

        let userCred;
        try {
            userCred = await createUserWithEmailAndPassword(secAuth, email, password);
        } catch (createErr) {
            if (createErr.code === "auth/email-already-in-use") {
                // If Auth user was created in a previous attempt, sign in via secAuth to finalize the profile
                userCred = await signInWithEmailAndPassword(secAuth, email, password);
            } else {
                throw createErr;
            }
        }

        const assistantData = {
            uid: userCred.user.uid,
            name: name,
            email: email,
            role: "lab_assistant",
            department: department,
            active: true,
            status: "approved",
            createdAt: new Date(),
            approvedAt: new Date(),
            registeredBy: currentUser?.email || "Super Admin"
        };

        // Try writing with admin db first (Super Admin authority)
        try {
            await setDoc(doc(db, "users", userCred.user.uid), assistantData);
        } catch (adminDbErr) {
            console.warn("Admin db write attempt failed, trying secDb:", adminDbErr);
            // Fallback to secondary db (authenticated as assistant)
            await setDoc(doc(secDb, "users", userCred.user.uid), assistantData);
        }

        // Cleanly sign out secondary session
        await secondarySignOut(secAuth);

        showToast(`Lab Assistant ${name} successfully registered for ${department}!`, "success");
        if (registerAssistantModal) registerAssistantModal.style.display = "none";
        registerAssistantForm.reset();

    } catch (error) {
        console.error("Assistant registration error:", error);
        assistantRegMessage.textContent = error.message;
        assistantRegMessage.style.color = "var(--danger)";
    } finally {
        saveAssistantBtn.disabled = false;
    }
});

// ==========================================================================
// SCANNED EVENT HANDLER (INTEGRATED SCANNER ACTIONS)
// ==========================================================================

window.addEventListener("labtrack:scanned", (e) => {
    const { equipment, actionsContainer } = e.detail;
    if (!actionsContainer) return;

    actionsContainer.innerHTML = "";

    if (equipment.status === "Available") {
        const issueActionBtn = document.createElement("button");
        issueActionBtn.className = "btn btn-primary btn-sm";
        issueActionBtn.textContent = "Issue This Equipment";
        issueActionBtn.addEventListener("click", () => {
            document.getElementById("closeScannerBtn")?.click();
            openIssueModal(equipment);
        });
        actionsContainer.appendChild(issueActionBtn);
    } else if (equipment.status === "Borrowed") {
        const activeBorrowing = allBorrowings.find(b => b.equipmentId === equipment.equipmentId && b.status === "Active");
        if (activeBorrowing) {
            const returnActionBtn = document.createElement("button");
            returnActionBtn.className = "btn btn-success btn-sm";
            returnActionBtn.textContent = "Process Return";
            returnActionBtn.addEventListener("click", () => {
                document.getElementById("closeScannerBtn")?.click();
                openReturnModal(activeBorrowing);
            });
            actionsContainer.appendChild(returnActionBtn);
        }
    }

    const maintActionBtn = document.createElement("button");
    maintActionBtn.className = "btn btn-warning btn-sm";
    maintActionBtn.textContent = "Report Issue";
    maintActionBtn.addEventListener("click", () => {
        document.getElementById("closeScannerBtn")?.click();
        reportMaintenanceBtn?.click();
        if (maintenanceSelect) {
            maintenanceSelect.value = equipment.documentId;
        }
    });
    actionsContainer.appendChild(maintActionBtn);
});

// ==========================================================================
// CSV EXPORT UTILITIES (DD-MM-YYYY)
// ==========================================================================

function exportInventoryCSV() {
    if (allEquipment.length === 0) {
        showToast("No equipment to export.", "warning");
        return;
    }

    const headers = ["Equipment ID", "Name", "Category", "Location", "Condition", "Status"];
    const rows = allEquipment.map(item => [
        `"${item.equipmentId || ''}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${item.category || ''}"`,
        `"${item.location || ''}"`,
        `"${item.condition || ''}"`,
        `"${item.status || ''}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadCSV(csvContent, `PGDAV-LabTrack-Inventory-${getTodayDateDMY()}.csv`);
    showToast("Inventory exported to CSV successfully!", "success");
}

function exportLoansCSV() {
    const activeLoans = allBorrowings.filter(b => b.status === "Active");
    if (activeLoans.length === 0) {
        showToast("No active loans to export.", "warning");
        return;
    }

    const todayObj = parseDate(new Date());

    const headers = ["Equipment ID", "Equipment Name", "Student Name", "Student Email", "Issue Date (DD-MM-YYYY)", "Due Date (DD-MM-YYYY)", "Status"];
    const rows = activeLoans.map(item => [
        `"${item.equipmentId || ''}"`,
        `"${(item.equipmentName || '').replace(/"/g, '""')}"`,
        `"${item.studentName || ''}"`,
        `"${item.studentEmail || ''}"`,
        `"${formatDate(item.issueDate)}"`,
        `"${formatDate(item.dueDate)}"`,
        `"${parseDate(item.dueDate) < todayObj ? 'Overdue' : 'Active'}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadCSV(csvContent, `PGDAV-LabTrack-ActiveLoans-${getTodayDateDMY()}.csv`);
    showToast("Active loans exported to CSV!", "success");
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

document.getElementById("exportInventoryBtn")?.addEventListener("click", exportInventoryCSV);
document.getElementById("exportLoansBtn")?.addEventListener("click", exportLoansCSV);
