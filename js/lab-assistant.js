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
    setDoc,
    addDoc,
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

let currentAssistant = null;
let allEquipment = [];
let allBorrowings = [];
let allRequests = [];
let allStudents = [];
let allMaintenance = [];

let editingEquipmentId = null;
let currentQrEquipment = null;

// Header UI
const assistantName = document.getElementById("assistantName");
const assistantAvatar = document.getElementById("assistantAvatar");
const assistantLabBadge = document.getElementById("assistantLabBadge");
const assistantDepartmentTag = document.getElementById("assistantDepartmentTag");
const overviewLabTitle = document.getElementById("overviewLabTitle");
const inventorySectionTitle = document.getElementById("inventorySectionTitle");
const toastContainer = document.getElementById("toastContainer");

// ==========================================================================
// UNIVERSAL DATE HELPERS (STRICT DD-MM-YYYY ACROSS WHOLE PROJECT)
// ==========================================================================

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
        const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dmyMatch) {
            const dd = dmyMatch[1].padStart(2, "0");
            const mm = dmyMatch[2].padStart(2, "0");
            const yyyy = dmyMatch[3];
            return `${dd}-${mm}-${yyyy}`;
        }

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
// TOAST NOTIFICATIONS & SANITIZATION
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

function escapeHTML(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
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

document.getElementById("overviewAddEquipmentBtn")?.addEventListener("click", () => {
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

// ==========================================================================
// AUTHENTICATION & ACCESS CONTROL
// ==========================================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }

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
            userData.role !== "lab_assistant" ||
            userData.active !== true ||
            userData.status !== "approved"
        ) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        currentAssistant = {
            uid: user.uid,
            name: userData.name || "Lab Assistant",
            email: userData.email || user.email || "",
            department: userData.department || "Computer Science Lab"
        };

        // Populate Header Info
        if (assistantName) assistantName.textContent = currentAssistant.name;
        if (assistantAvatar) assistantAvatar.textContent = currentAssistant.name.charAt(0).toUpperCase();
        if (assistantLabBadge) assistantLabBadge.textContent = currentAssistant.department;
        if (assistantDepartmentTag) assistantDepartmentTag.textContent = currentAssistant.department;
        if (overviewLabTitle) overviewLabTitle.textContent = `${currentAssistant.department} Overview`;
        if (inventorySectionTitle) inventorySectionTitle.textContent = `${currentAssistant.department} Inventory`;

        // Lock category field in Add Equipment modal to this lab
        const catInput = document.getElementById("category");
        if (catInput) catInput.value = currentAssistant.department;

        // Start Live Scoped Listeners
        startEquipmentListener();
        startBorrowingsListener();
        startRequestsListener();
        startMaintenanceListener();
        loadApprovedStudentsList();

        // Initialize Integrated Camera Scanner
        initQrScanner(db);

    } catch (error) {
        console.error("Lab Assistant auth error:", error);
        showToast("Error authenticating Lab Assistant account.", "error");
    }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

// ==========================================================================
// KPI STATS CALCULATION
// ==========================================================================

function updateDashboardStats() {
    const totalCount = allEquipment.length;
    const availCount = allEquipment.filter(item => item.status === "Available").length;
    const activeLoans = allBorrowings.filter(b => b.status === "Active");
    const pendingReqs = allRequests.filter(r => r.status === "Pending");
    const todayObj = parseDate(new Date());

    const overdueLoans = activeLoans.filter(b => {
        const dueObj = parseDate(b.dueDate);
        return dueObj < todayObj;
    });

    const statTotalEl = document.getElementById("statTotalEquipment");
    if (statTotalEl) statTotalEl.textContent = totalCount;

    const statAvailEl = document.getElementById("statAvailable");
    if (statAvailEl) statAvailEl.textContent = availCount;

    const statBorrowedEl = document.getElementById("statBorrowed");
    if (statBorrowedEl) statBorrowedEl.textContent = activeLoans.length;

    const statPendingEl = document.getElementById("statPendingRequests");
    if (statPendingEl) statPendingEl.textContent = pendingReqs.length;

    const statOverdueEl = document.getElementById("statOverdue");
    if (statOverdueEl) statOverdueEl.textContent = overdueLoans.length;

    const tabInvBadge = document.getElementById("tabInventoryBadge");
    if (tabInvBadge) tabInvBadge.textContent = totalCount;

    const tabReqBadge = document.getElementById("tabRequestsBadge");
    if (tabReqBadge) tabReqBadge.textContent = pendingReqs.length;

    const tabLoanBadge = document.getElementById("tabLoansBadge");
    if (tabLoanBadge) tabLoanBadge.textContent = activeLoans.length;

    const overdueCard = document.getElementById("overdueCard");
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
// TAB 2: LAB EQUIPMENT INVENTORY (DEPARTMENT SCOPED)
// ==========================================================================

const equipmentTable = document.getElementById("equipmentTable");
const searchEquipment = document.getElementById("searchEquipment");
const filterStatus = document.getElementById("filterStatus");
const filterCondition = document.getElementById("filterCondition");

const addEquipmentBtn = document.getElementById("addEquipmentBtn");
const equipmentModal = document.getElementById("equipmentModal");
const closeModal = document.getElementById("closeModal");
const equipmentForm = document.getElementById("equipmentForm");
const equipmentModalTitle = document.getElementById("equipmentModalTitle");
const saveEquipmentBtn = document.getElementById("saveEquipmentBtn");
const equipmentMessage = document.getElementById("equipmentMessage");

function normalizeLabName(name) {
    if (!name) return "";
    return name.trim().toLowerCase();
}

function matchesAssistantLab(itemCategory) {
    if (!currentAssistant || !currentAssistant.department) return true;
    const myLab = normalizeLabName(currentAssistant.department);
    const cat = normalizeLabName(itemCategory);
    return cat === myLab || cat.includes(myLab.replace(" lab", "")) || myLab.includes(cat);
}

function startEquipmentListener() {
    onSnapshot(collection(db, "equipment"), (snapshot) => {
        const rawDocs = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        // Filter strictly to this assistant's assigned lab
        allEquipment = rawDocs.filter(item => matchesAssistantLab(item.category));

        renderEquipmentTable();
        renderBorrowingRequestsTable();
        renderMaintenanceEquipmentSelect();
        updateDashboardStats();
    }, (error) => {
        console.error("Equipment listener error:", error);
        showToast("Error loading laboratory inventory.", "error");
    });
}

function renderEquipmentTable() {
    if (!equipmentTable) return;

    const searchVal = (searchEquipment?.value || "").trim().toLowerCase();
    const statusVal = filterStatus?.value || "";
    const condVal = filterCondition?.value || "";

    const filtered = allEquipment.filter(item => {
        const matchesSearch = !searchVal ||
            (item.equipmentId || "").toLowerCase().includes(searchVal) ||
            (item.name || "").toLowerCase().includes(searchVal) ||
            (item.location || "").toLowerCase().includes(searchVal);

        const matchesStat = !statusVal || item.status === statusVal;
        const matchesCond = !condVal || item.condition === condVal;

        return matchesSearch && matchesStat && matchesCond;
    });

    if (filtered.length === 0) {
        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty-state">
                    <p>No equipment found in ${escapeHTML(currentAssistant?.department || "this lab")}.</p>
                </td>
            </tr>
        `;
        return;
    }

    equipmentTable.innerHTML = filtered.map(item => {
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
                <td>${escapeHTML(item.location || "Lab Shelf")}</td>
                <td><span class="badge ${condClass}">${escapeHTML(item.condition || "Good")}</span></td>
                <td><span class="badge ${statusClass}">${escapeHTML(item.status)}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm view-qr-btn" data-id="${escapeHTML(item.documentId)}">
                        🔲 QR Code
                    </button>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn btn-primary btn-sm edit-btn" data-id="${escapeHTML(item.documentId)}">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${escapeHTML(item.documentId)}" data-code="${escapeHTML(item.equipmentId)}">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

searchEquipment?.addEventListener("input", renderEquipmentTable);
filterStatus?.addEventListener("change", renderEquipmentTable);
filterCondition?.addEventListener("change", renderEquipmentTable);

// Add Equipment Modal Open
addEquipmentBtn?.addEventListener("click", () => {
    editingEquipmentId = null;
    equipmentForm.reset();
    document.getElementById("equipmentId").disabled = false;
    document.getElementById("category").value = currentAssistant?.department || "Laboratory";
    if (equipmentModalTitle) equipmentModalTitle.textContent = `Add New Equipment to ${currentAssistant?.department || "Lab"}`;
    if (saveEquipmentBtn) saveEquipmentBtn.textContent = "Save Equipment";
    if (equipmentMessage) equipmentMessage.textContent = "";
    equipmentModal.style.display = "flex";
});

closeModal?.addEventListener("click", () => {
    equipmentModal.style.display = "none";
});
equipmentModal?.addEventListener("click", (e) => {
    if (e.target === equipmentModal) equipmentModal.style.display = "none";
});

// Edit & Delete & QR Click Handlers
equipmentTable?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".edit-btn");
    const deleteBtn = e.target.closest(".delete-btn");
    const qrBtn = e.target.closest(".view-qr-btn");

    if (qrBtn) {
        const docId = qrBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (item) openQrModal(item);
        return;
    }

    if (editBtn) {
        const docId = editBtn.dataset.id;
        const item = allEquipment.find(i => i.documentId === docId);
        if (!item) return;

        editingEquipmentId = docId;
        document.getElementById("equipmentId").value = item.equipmentId;
        document.getElementById("equipmentId").disabled = true;
        document.getElementById("equipmentName").value = item.name;
        document.getElementById("category").value = item.category || currentAssistant?.department;
        document.getElementById("location").value = item.location || "";
        document.getElementById("condition").value = item.condition || "Good";

        if (equipmentModalTitle) equipmentModalTitle.textContent = `Edit Equipment (${item.equipmentId})`;
        if (saveEquipmentBtn) saveEquipmentBtn.textContent = "Update Equipment";
        if (equipmentMessage) equipmentMessage.textContent = "";
        equipmentModal.style.display = "flex";
        return;
    }

    if (deleteBtn) {
        const docId = deleteBtn.dataset.id;
        const eqCode = deleteBtn.dataset.code;

        const activeLoan = allBorrowings.find(b => b.equipmentId === eqCode && b.status === "Active");
        if (activeLoan) {
            alert(`Cannot delete ${eqCode} because it is currently borrowed by a student.`);
            return;
        }

        const confirmed = confirm(`Are you sure you want to permanently delete ${eqCode} from ${currentAssistant?.department}?`);
        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, "equipment", docId));
            showToast(`${eqCode} deleted successfully.`, "info");
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Failed to delete equipment.", "error");
        }
    }
});

// Equipment Form Submit
if (equipmentForm) {
    equipmentForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const eqId = document.getElementById("equipmentId").value.trim().toUpperCase();
        const name = document.getElementById("equipmentName").value.trim();
        const category = currentAssistant?.department || document.getElementById("category").value.trim();
        const location = document.getElementById("location").value.trim();
        const condition = document.getElementById("condition").value;

        if (!eqId || !name || !location || !condition) {
            equipmentMessage.textContent = "Please fill in all required fields.";
            equipmentMessage.style.color = "var(--danger)";
            return;
        }

        saveEquipmentBtn.disabled = true;
        equipmentMessage.textContent = "Saving equipment...";
        equipmentMessage.style.color = "var(--primary)";

        try {
            if (editingEquipmentId) {
                // Update
                await updateDoc(doc(db, "equipment", editingEquipmentId), {
                    name,
                    category,
                    location,
                    condition,
                    updatedAt: new Date(),
                    updatedBy: currentAssistant.uid
                });
                showToast("Equipment updated successfully!", "success");
            } else {
                // Check uniqueness
                const q = query(collection(db, "equipment"), where("equipmentId", "==", eqId));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    equipmentMessage.textContent = `Equipment ID ${eqId} already exists in the system.`;
                    equipmentMessage.style.color = "var(--danger)";
                    saveEquipmentBtn.disabled = false;
                    return;
                }

                await setDoc(doc(db, "equipment", eqId), {
                    equipmentId: eqId,
                    name,
                    category,
                    location,
                    condition,
                    status: "Available",
                    addedByUid: currentAssistant.uid,
                    addedByName: currentAssistant.name,
                    createdAt: new Date()
                });
                showToast(`Equipment ${eqId} added to ${category}!`, "success");
            }

            equipmentModal.style.display = "none";
            equipmentForm.reset();
        } catch (error) {
            console.error("Save equipment error:", error);
            equipmentMessage.textContent = error.message;
            equipmentMessage.style.color = "var(--danger)";
        } finally {
            saveEquipmentBtn.disabled = false;
        }
    });
}

// Export Inventory CSV
document.getElementById("exportInventoryBtn")?.addEventListener("click", () => {
    if (allEquipment.length === 0) {
        showToast("No equipment records to export.", "warning");
        return;
    }

    const headers = ["Equipment ID", "Name", "Category / Lab", "Location", "Condition", "Status"];
    const rows = allEquipment.map(item => [
        `"${item.equipmentId || ""}"`,
        `"${item.name || ""}"`,
        `"${item.category || ""}"`,
        `"${item.location || ""}"`,
        `"${item.condition || ""}"`,
        `"${item.status || ""}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LabTrack-Inventory-${(currentAssistant?.department || "Lab").replace(/\s+/g, "_")}.csv`;
    a.click();
    showToast("Laboratory CSV exported successfully!", "success");
});

// ==========================================================================
// QR CODE GENERATION & PRINTING (PYTHON BACKEND SERVICE)
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
        const response = await fetch(`/api/generate-qr?id=${encodeURIComponent(item.equipmentId)}&name=${encodeURIComponent(item.name)}&category=${encodeURIComponent(item.category || '')}&location=${encodeURIComponent(item.location || '')}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const qrSrc = data.qrDataUrl || data.dataUrl;

        if (qrSrc) {
            qrCodeContainer.innerHTML = `
                <img id="activeQrImage" src="${qrSrc}" alt="QR code for ${escapeHTML(item.equipmentId)}" style="width: 190px; height: 190px; display: block; margin: 0 auto; border-radius: 6px;" />
            `;
            return;
        }
        throw new Error("No dataUrl returned from Python service");
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
    a.download = `LabTrack-QR-${currentQrEquipment.equipmentId}.png`;
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
            <title>Lab Tag - ${escapeHTML(currentQrEquipment.equipmentId)}</title>
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
                    <div><strong>Department:</strong> ${escapeHTML(currentQrEquipment.category || currentAssistant?.department || "Lab")}</div>
                    <div><strong>Location:</strong> ${escapeHTML(currentQrEquipment.location || "N/A")}</div>
                    <div><strong>Condition:</strong> ${escapeHTML(currentQrEquipment.condition || "Good")}</div>
                </div>
                <div class="label-footer">LabTrack Asset Tag • Python QR Backend Service</div>
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
// TAB 3: STUDENT BORROWING REQUESTS (ROUTED TO THIS LAB)
// ==========================================================================

const borrowingRequestsTable = document.getElementById("borrowingRequestsTable");
const filterRequestsStatus = document.getElementById("filterRequestsStatus");

const rejectRequestModal = document.getElementById("rejectRequestModal");
const closeRejectRequestModal = document.getElementById("closeRejectRequestModal");
const rejectRequestForm = document.getElementById("rejectRequestForm");
const rejectRequestId = document.getElementById("rejectRequestId");
const rejectRequestSummary = document.getElementById("rejectRequestSummary");
const rejectionReason = document.getElementById("rejectionReason");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");

function startRequestsListener() {
    onSnapshot(collection(db, "requests"), (snapshot) => {
        const rawDocs = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        // Filter requests routed to this lab
        allRequests = rawDocs.filter(req => matchesAssistantLab(req.category) || (req.labAttendant && req.labAttendant.includes(currentAssistant?.department?.replace(" Lab", ""))));

        renderBorrowingRequestsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Requests listener error:", error);
    });
}

filterRequestsStatus?.addEventListener("change", renderBorrowingRequestsTable);

function renderBorrowingRequestsTable() {
    if (!borrowingRequestsTable) return;

    const filter = filterRequestsStatus?.value || "Pending";
    let list = allRequests;

    if (filter === "Pending") {
        list = allRequests.filter(r => r.status === "Pending");
    } else if (filter !== "All") {
        list = allRequests.filter(r => r.status === filter);
    }

    if (list.length === 0) {
        borrowingRequestsTable.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty-state">
                    <p>No ${filter.toLowerCase()} equipment requests for ${escapeHTML(currentAssistant?.department || "this lab")}.</p>
                </td>
            </tr>
        `;
        return;
    }

    borrowingRequestsTable.innerHTML = list.map(req => {
        const isPending = req.status === "Pending";
        const isApproved = req.status === "Approved";
        const isRejected = req.status === "Rejected";

        // Check availability in equipment catalog
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

        const formattedFrom = formatDate(req.fromDate);
        const formattedTo = formatDate(req.toDate);
        const formattedCreated = formatDate(req.createdAt);

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
                            ${liveStatus === 'Borrowed' ? 'On Loan' : 'In Repair'}
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
                    ${formattedFrom} <span style="color: var(--slate-400)">to</span> ${formattedTo}
                </td>
                <td>${escapeHTML(req.purpose || "Laboratory Practice")}</td>
                <td>${formattedCreated}</td>
                <td>${statusBadge}</td>
                <td>${actionCellContent}</td>
            </tr>
        `;
    }).join("");
}

// Request Actions: Approve or Reject
borrowingRequestsTable?.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest(".approve-request-btn");
    const rejectBtn = e.target.closest(".reject-request-btn");

    if (approveBtn) {
        const reqId = approveBtn.dataset.id;
        const req = allRequests.find(r => r.documentId === reqId);
        if (!req) return;

        approveBtn.disabled = true;

        try {
            await runTransaction(db, async (transaction) => {
                const eqQuery = query(collection(db, "equipment"), where("equipmentId", "==", req.equipmentId));
                const eqSnap = await getDocs(eqQuery);

                if (eqSnap.empty) throw new Error("Equipment record not found.");
                const eqDoc = eqSnap.docs[0];
                const eqData = eqDoc.data();

                if (eqData.status !== "Available") {
                    throw new Error(`Equipment is currently ${eqData.status}. Cannot approve request.`);
                }

                // 1. Update Equipment status
                transaction.update(eqDoc.ref, {
                    status: "Borrowed",
                    lastIssuedTo: req.studentName || "Student",
                    lastIssuedDate: formatDate(new Date())
                });

                // 2. Update Request status
                const reqRef = doc(db, "requests", reqId);
                transaction.update(reqRef, {
                    status: "Approved",
                    handledBy: currentAssistant.uid,
                    handledByName: currentAssistant.name,
                    approvedAt: new Date()
                });

                // 3. Create Borrowing record
                const newBorrowingRef = doc(collection(db, "borrowings"));
                transaction.set(newBorrowingRef, {
                    equipmentDocId: eqDoc.id,
                    equipmentId: req.equipmentId,
                    equipmentName: req.equipmentName,
                    category: req.category || currentAssistant.department,
                    studentUid: req.studentUid,
                    studentName: req.studentName,
                    studentEmail: req.studentEmail,
                    studentRollNo: req.studentRollNo || "",
                    studentCourse: req.studentCourse || "",
                    issueDate: formatDate(new Date()),
                    dueDate: formatDate(req.toDate),
                    status: "Active",
                    issuedBy: currentAssistant.name,
                    issuedByUid: currentAssistant.uid,
                    requestId: reqId,
                    createdAt: new Date()
                });
            });

            showToast(`Approved and issued ${req.equipmentName} to ${req.studentName}!`, "success");
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
        rejectRequestSummary.value = `${req.equipmentName} (${req.equipmentId}) requested by ${req.studentName}`;
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

rejectRequestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reqId = rejectRequestId.value;
    const reason = rejectionReason.value.trim();

    if (!reqId || !reason) return;

    confirmRejectBtn.disabled = true;
    try {
        await updateDoc(doc(db, "requests", reqId), {
            status: "Rejected",
            rejectionReason: reason,
            rejectedAt: new Date(),
            rejectedBy: currentAssistant.uid,
            rejectedByName: currentAssistant.name
        });

        showToast("Borrowing request rejected.", "info");
        rejectRequestModal.style.display = "none";
    } catch (error) {
        console.error("Reject request error:", error);
        showToast(error.message, "error");
    } finally {
        confirmRejectBtn.disabled = false;
    }
});

// ==========================================================================
// TAB 4: ACTIVE BORROWINGS & RETURNS
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

function startBorrowingsListener() {
    onSnapshot(collection(db, "borrowings"), (snapshot) => {
        const rawDocs = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        // Filter borrowings for items belonging to this lab
        allBorrowings = rawDocs.filter(b => matchesAssistantLab(b.category));

        renderActiveBorrowingsTable();
        updateDashboardStats();
    }, (error) => {
        console.error("Borrowings listener error:", error);
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
                    <p>No active borrowings matching this filter in ${escapeHTML(currentAssistant?.department || "this lab")}.</p>
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
            statusBadge = `<span class="badge badge-overdue">OVERDUE BY ${daysPast} DAY${daysPast === 1 ? '' : 'S'}</span>`;
        } else if (diffDays === 0) {
            statusBadge = `<span class="badge badge-pending">Due Today!</span>`;
        } else {
            statusBadge = `<span class="badge badge-available">${diffDays} day${diffDays === 1 ? '' : 's'} remaining</span>`;
        }

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(item.equipmentId)}</span></td>
                <td><strong>${escapeHTML(item.equipmentName)}</strong></td>
                <td>
                    <strong>${escapeHTML(item.studentName || "Student")}</strong>
                    ${item.studentRollNo ? `<div style="font-size: 11px; color: var(--primary);">Roll: ${escapeHTML(item.studentRollNo)}</div>` : ''}
                    <div style="font-size: 11px; color: var(--slate-500);">${escapeHTML(item.studentEmail || "")}</div>
                </td>
                <td>${formatDate(item.issueDate)}</td>
                <td><strong>${formatDate(item.dueDate)}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-success btn-sm process-return-btn"
                        data-borrowing-id="${escapeHTML(item.documentId)}"
                        data-equipment-id="${escapeHTML(item.equipmentId)}"
                        data-equipment-name="${escapeHTML(item.equipmentName)}"
                        data-student-name="${escapeHTML(item.studentName)}"
                        data-student-email="${escapeHTML(item.studentEmail)}">
                        Process Return
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Process Return Click
activeBorrowingsTable?.addEventListener("click", (e) => {
    const btn = e.target.closest(".process-return-btn");
    if (!btn) return;

    returnForm.reset();
    returnBorrowingId.value = btn.dataset.borrowingId;
    returnEquipmentInfo.value = `${btn.dataset.equipmentName} (${btn.dataset.equipmentId})`;
    returnStudentInfo.value = `${btn.dataset.studentName} (${btn.dataset.studentEmail})`;
    returnCondition.value = "Good";
    if (returnMessage) returnMessage.textContent = "";

    returnModal.style.display = "flex";
});

closeReturnModal?.addEventListener("click", () => {
    returnModal.style.display = "none";
});
returnModal?.addEventListener("click", (e) => {
    if (e.target === returnModal) returnModal.style.display = "none";
});

// Process Return Submit
if (returnForm) {
    returnForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const borrowingId = returnBorrowingId.value;
        const condition = returnCondition.value;
        const notes = returnNotes.value.trim();

        if (!borrowingId || !condition) return;

        confirmReturnBtn.disabled = true;
        if (returnMessage) {
            returnMessage.textContent = "Processing return and updating inventory...";
            returnMessage.style.color = "var(--primary)";
        }

        try {
            const borrowingRef = doc(db, "borrowings", borrowingId);
            const borrowingSnap = await getDoc(borrowingRef);

            if (!borrowingSnap.exists()) {
                throw new Error("Borrowing record not found.");
            }

            const borrowingData = borrowingSnap.data();

            await runTransaction(db, async (transaction) => {
                const eqQuery = query(collection(db, "equipment"), where("equipmentId", "==", borrowingData.equipmentId));
                const eqSnap = await getDocs(eqQuery);

                const newStatus = condition === "Damaged" ? "Under Maintenance" : "Available";

                if (!eqSnap.empty) {
                    const eqDocRef = eqSnap.docs[0].ref;
                    transaction.update(eqDocRef, {
                        status: newStatus,
                        condition: condition,
                        lastReturnedDate: formatDate(new Date())
                    });
                }

                transaction.update(borrowingRef, {
                    status: "Returned",
                    returnDate: formatDate(new Date()),
                    returnCondition: condition,
                    returnNotes: notes,
                    processedBy: currentAssistant.name,
                    processedByUid: currentAssistant.uid
                });
            });

            showToast(`Equipment ${borrowingData.equipmentId} returned successfully! Restocked as ${condition}.`, "success");
            returnModal.style.display = "none";
        } catch (error) {
            console.error("Return error:", error);
            showToast("Failed to process return.", "error");
            if (returnMessage) {
                returnMessage.textContent = error.message;
                returnMessage.style.color = "var(--danger)";
            }
        } finally {
            confirmReturnBtn.disabled = false;
        }
    });
}

// Export Loans CSV
document.getElementById("exportLoansBtn")?.addEventListener("click", () => {
    const activeList = allBorrowings.filter(b => b.status === "Active");
    if (activeList.length === 0) {
        showToast("No active loans to export.", "warning");
        return;
    }

    const headers = ["Equipment ID", "Equipment Name", "Student Name", "Student Roll No", "Student Email", "Issue Date", "Due Date", "Status"];
    const rows = activeList.map(item => [
        `"${item.equipmentId || ""}"`,
        `"${item.equipmentName || ""}"`,
        `"${item.studentName || ""}"`,
        `"${item.studentRollNo || ""}"`,
        `"${item.studentEmail || ""}"`,
        `"${formatDate(item.issueDate)}"`,
        `"${formatDate(item.dueDate)}"`,
        `"${item.status || "Active"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LabTrack-Active-Loans-${(currentAssistant?.department || "Lab").replace(/\s+/g, "_")}.csv`;
    a.click();
    showToast("Loans CSV exported successfully!", "success");
});

// ==========================================================================
// TAB 5: MAINTENANCE & REPAIRS
// ==========================================================================

const maintenanceTable = document.getElementById("maintenanceTable");
const reportMaintenanceBtn = document.getElementById("reportMaintenanceBtn");
const maintenanceModal = document.getElementById("maintenanceModal");
const closeMaintenanceModal = document.getElementById("closeMaintenanceModal");
const maintenanceForm = document.getElementById("maintenanceForm");
const maintenanceEquipmentSelect = document.getElementById("maintenanceEquipmentSelect");
const maintenanceDescription = document.getElementById("maintenanceDescription");
const maintenanceDate = document.getElementById("maintenanceDate");
const saveMaintenanceBtn = document.getElementById("saveMaintenanceBtn");
const maintenanceMessage = document.getElementById("maintenanceMessage");

function startMaintenanceListener() {
    onSnapshot(collection(db, "maintenance"), (snapshot) => {
        const rawDocs = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            documentId: docSnap.id
        }));

        // Filter maintenance records for items belonging to this lab
        allMaintenance = rawDocs.filter(m => matchesAssistantLab(m.category));

        renderMaintenanceTable();
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
                    <p>No maintenance records logged for ${escapeHTML(currentAssistant?.department || "this lab")}.</p>
                </td>
            </tr>
        `;
        return;
    }

    maintenanceTable.innerHTML = allMaintenance.map(record => {
        const isPending = record.status === "Reported" || record.status === "In Progress";
        const statusBadge = isPending
            ? `<span class="badge badge-maintenance">In Repair</span>`
            : `<span class="badge badge-available">Resolved</span>`;

        return `
            <tr>
                <td><span class="mono-id">${escapeHTML(record.equipmentId)}</span></td>
                <td><strong>${escapeHTML(record.equipmentName)}</strong></td>
                <td>${escapeHTML(record.description)}</td>
                <td>${formatDate(record.reportDate)}</td>
                <td>${statusBadge}</td>
                <td>
                    ${isPending ? `
                        <button class="btn btn-success btn-sm resolve-maintenance-btn" data-id="${escapeHTML(record.documentId)}" data-eq-id="${escapeHTML(record.equipmentId)}">
                            Mark Resolved
                        </button>
                    ` : `<span style="font-size: 12px; color: var(--slate-400)">Closed</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

function renderMaintenanceEquipmentSelect() {
    if (!maintenanceEquipmentSelect) return;
    maintenanceEquipmentSelect.innerHTML = '<option value="">Select Equipment</option>' +
        allEquipment.map(item => `
            <option value="${escapeHTML(item.equipmentId)}" data-doc-id="${escapeHTML(item.documentId)}" data-name="${escapeHTML(item.name)}">
                ${escapeHTML(item.equipmentId)} - ${escapeHTML(item.name)} (${item.status})
            </option>
        `).join("");
}

reportMaintenanceBtn?.addEventListener("click", () => {
    maintenanceForm.reset();
    renderMaintenanceEquipmentSelect();
    maintenanceDate.value = getTodayDateISO();
    if (maintenanceMessage) maintenanceMessage.textContent = "";
    maintenanceModal.style.display = "flex";
});

closeMaintenanceModal?.addEventListener("click", () => {
    maintenanceModal.style.display = "none";
});
maintenanceModal?.addEventListener("click", (e) => {
    if (e.target === maintenanceModal) maintenanceModal.style.display = "none";
});

maintenanceForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedOption = maintenanceEquipmentSelect.options[maintenanceEquipmentSelect.selectedIndex];
    const eqId = selectedOption.value;
    const eqName = selectedOption.dataset.name;
    const docId = selectedOption.dataset.docId;
    const desc = maintenanceDescription.value.trim();
    const rawDate = maintenanceDate.value;

    if (!eqId || !desc || !rawDate) return;

    saveMaintenanceBtn.disabled = true;
    if (maintenanceMessage) {
        maintenanceMessage.textContent = "Logging maintenance report...";
        maintenanceMessage.style.color = "var(--primary)";
    }

    try {
        await addDoc(collection(db, "maintenance"), {
            equipmentId: eqId,
            equipmentName: eqName,
            equipmentDocId: docId,
            category: currentAssistant?.department || "Laboratory",
            description: desc,
            reportDate: formatDate(rawDate),
            status: "Reported",
            reportedBy: currentAssistant.name,
            reportedByUid: currentAssistant.uid,
            createdAt: new Date()
        });

        // Update equipment status to Under Maintenance
        const eqRef = doc(db, "equipment", docId);
        await updateDoc(eqRef, {
            status: "Under Maintenance",
            condition: "Damaged"
        });

        showToast(`Report logged. ${eqId} marked as Under Maintenance.`, "warning");
        maintenanceModal.style.display = "none";
    } catch (error) {
        console.error("Maintenance submit error:", error);
        showToast("Failed to log maintenance.", "error");
        if (maintenanceMessage) {
            maintenanceMessage.textContent = error.message;
            maintenanceMessage.style.color = "var(--danger)";
        }
    } finally {
        saveMaintenanceBtn.disabled = false;
    }
});

maintenanceTable?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".resolve-maintenance-btn");
    if (!btn) return;

    const recordId = btn.dataset.id;
    const eqId = btn.dataset.eqId;

    btn.disabled = true;
    try {
        await updateDoc(doc(db, "maintenance", recordId), {
            status: "Resolved",
            resolvedDate: formatDate(new Date()),
            resolvedBy: currentAssistant.name,
            resolvedByUid: currentAssistant.uid
        });

        const q = query(collection(db, "equipment"), where("equipmentId", "==", eqId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, {
                status: "Available",
                condition: "Good"
            });
        }

        showToast(`Maintenance resolved. ${eqId} is now Available!`, "success");
    } catch (error) {
        console.error("Resolve maintenance error:", error);
        showToast(error.message, "error");
        btn.disabled = false;
    }
});

// Load Approved Students for manual issue dropdown
async function loadApprovedStudentsList() {
    const issueStudentSelect = document.getElementById("issueStudent");
    if (!issueStudentSelect) return;

    try {
        const q = query(collection(db, "users"), where("role", "==", "student"), where("status", "==", "approved"));
        const snap = await getDocs(q);
        allStudents = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

        if (allStudents.length === 0) {
            issueStudentSelect.innerHTML = '<option value="">No approved students available</option>';
        } else {
            issueStudentSelect.innerHTML = '<option value="">Select Student</option>' +
                allStudents.map(s => `
                    <option value="${escapeHTML(s.uid)}" data-name="${escapeHTML(s.name)}" data-email="${escapeHTML(s.email)}" data-roll="${escapeHTML(s.rollNo || '')}" data-course="${escapeHTML(s.course || '')}">
                        ${escapeHTML(s.name)} ${s.rollNo ? `(Roll: ${escapeHTML(s.rollNo)})` : ''} - ${escapeHTML(s.email)}
                    </option>
                `).join("");
        }
    } catch (err) {
        console.error("Error loading students:", err);
    }
}

// Scanned QR Event Listener
window.addEventListener("labtrack:scanned", (e) => {
    const { equipment, actionsContainer } = e.detail;
    if (!actionsContainer) return;

    actionsContainer.innerHTML = "";

    const isThisLab = matchesAssistantLab(equipment.category);
    if (!isThisLab) {
        actionsContainer.innerHTML = `
            <div style="background: #fef2f2; color: #b91c1c; padding: 10px; border-radius: var(--radius-md); font-size: 13px;">
                ⚠️ This item belongs to <strong>${escapeHTML(equipment.category || "another lab")}</strong>. You can only manage items in <strong>${escapeHTML(currentAssistant?.department || "your lab")}</strong>.
            </div>
        `;
        return;
    }

    if (equipment.status === "Available") {
        const issueBtn = document.createElement("button");
        issueBtn.className = "btn btn-primary btn-sm";
        issueBtn.textContent = "📋 Issue to Student";
        issueBtn.addEventListener("click", () => {
            document.getElementById("closeScannerBtn")?.click();
            switchTab("tab-inventory");
            const item = allEquipment.find(i => i.equipmentId === equipment.equipmentId);
            if (item) openQrModal(item);
        });
        actionsContainer.appendChild(issueBtn);
    } else if (equipment.status === "Borrowed") {
        const activeLoan = allBorrowings.find(b => b.equipmentId === equipment.equipmentId && b.status === "Active");
        if (activeLoan) {
            const retBtn = document.createElement("button");
            retBtn.className = "btn btn-success btn-sm";
            retBtn.textContent = "📥 Process Return";
            retBtn.addEventListener("click", () => {
                document.getElementById("closeScannerBtn")?.click();
                switchTab("tab-loans");
            });
            actionsContainer.appendChild(retBtn);
        }
    }
});
