import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export function initQrScanner(db, options = {}) {

    const openScannerBtn = document.getElementById("openScannerBtn");
    const scannerModal = document.getElementById("scannerModal");
    const closeScannerBtn = document.getElementById("closeScannerBtn");
    const stopScannerBtn = document.getElementById("stopScannerBtn");

    const scannerStatus = document.getElementById("scannerStatus");
    const scanResult = document.getElementById("scanResult");

    if (!openScannerBtn || !scannerModal) return;

    let scanner = null;
    let isStarting = false;
    let isProcessing = false;

    // Stop camera scanner
    async function stopScanner() {
        if (!scanner) return;
        const currentScanner = scanner;
        scanner = null;

        try {
            if (currentScanner.isScanning) {
                await currentScanner.stop();
            }
            currentScanner.clear();
        } catch (error) {
            console.error("Scanner stop error:", error);
        }
    }

    // Helper: Escape HTML
    function escapeHTML(str) {
        return String(str ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[c]);
    }

    // Fetch equipment by ID or Doc ID
    async function fetchEquipment(searchId) {
        if (!searchId) return;

        try {
            const cleanId = searchId.trim().toUpperCase();
            scannerStatus.textContent = `Searching for "${cleanId}"...`;

            // Try doc by ID directly
            const directRef = doc(db, "equipment", cleanId);
            const directSnap = await getDoc(directRef);

            let equipment = null;
            let documentId = cleanId;

            if (directSnap.exists()) {
                equipment = directSnap.data();
                documentId = directSnap.id;
            } else {
                // Try query by equipmentId field
                const q = query(
                    collection(db, "equipment"),
                    where("equipmentId", "==", cleanId)
                );
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    const firstDoc = querySnap.docs[0];
                    equipment = firstDoc.data();
                    documentId = firstDoc.id;
                }
            }

            if (!equipment) {
                scanResult.innerHTML = `
                    <div class="scan-result-card" style="border-left: 4px solid var(--danger);">
                        <h4 style="color: var(--danger); margin-bottom: 6px;">Equipment Not Found</h4>
                        <p>No equipment matching <strong>${escapeHTML(cleanId)}</strong> exists in the database.</p>
                    </div>
                `;
                scannerStatus.textContent = "No matching equipment found.";
                return;
            }

            equipment.documentId = documentId;

            // Render rich card
            const statusClass = {
                "Available": "badge-available",
                "Borrowed": "badge-borrowed",
                "Under Maintenance": "badge-maintenance",
                "Maintenance": "badge-maintenance"
            }[equipment.status] || "badge-available";

            const conditionClass = {
                "Good": "badge-cond-good",
                "Fair": "badge-cond-fair",
                "Damaged": "badge-cond-damaged"
            }[equipment.condition] || "badge-cond-good";

            scanResult.innerHTML = `
                <div class="scan-result-card" style="border-left: 4px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700;">${escapeHTML(equipment.name)}</h3>
                            <span class="mono-id">${escapeHTML(equipment.equipmentId)}</span>
                        </div>
                        <span class="badge ${statusClass}">${escapeHTML(equipment.status)}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; font-size: 13px;">
                        <p><strong>Category:</strong> ${escapeHTML(equipment.category || "N/A")}</p>
                        <p><strong>Location:</strong> ${escapeHTML(equipment.location || "N/A")}</p>
                        <p><strong>Condition:</strong> <span class="badge ${conditionClass}">${escapeHTML(equipment.condition || "Good")}</span></p>
                        <p><strong>Status:</strong> ${escapeHTML(equipment.status)}</p>
                    </div>

                    <div class="scan-result-actions" id="scanResultActions"></div>
                </div>
            `;

            // Add role-specific action buttons
            const actionsContainer = document.getElementById("scanResultActions");
            if (actionsContainer) {
                // Dispatch event so dashboards can handle context-aware actions
                window.dispatchEvent(new CustomEvent("labtrack:scanned", {
                    detail: { equipment, actionsContainer }
                }));
            }

            scannerStatus.textContent = "Equipment identified successfully!";

        } catch (error) {
            console.error("Equipment lookup error:", error);
            scannerStatus.textContent = "Unable to fetch equipment details.";
            scanResult.innerHTML = `
                <div class="scan-result-card" style="border-left: 4px solid var(--danger);">
                    <p style="color: var(--danger);">Error looking up equipment: ${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    // Start camera
    async function startScanner() {
        if (isStarting || scanner) return;

        if (!window.Html5Qrcode) {
            scannerStatus.textContent = "QR Scanner library failed to load. Use manual search below.";
            return;
        }

        isStarting = true;
        isProcessing = false;
        scannerStatus.textContent = "Requesting camera permission...";
        scanResult.innerHTML = "";

        try {
            scanner = new window.Html5Qrcode("qr-reader");

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 220, height: 220 }
                },
                async (decodedText) => {
                    if (isProcessing) return;
                    isProcessing = true;
                    await stopScanner();

                    const equipmentId = decodedText.trim();
                    scannerStatus.textContent = "QR scanned! Fetching equipment...";
                    await fetchEquipment(equipmentId);
                },
                () => {}
            );

            scannerStatus.textContent = "Camera active. Point at an equipment QR code.";

        } catch (error) {
            console.error("Camera error:", error);
            scannerStatus.textContent = "Camera unavailable or permission denied. You can enter Equipment ID below.";
            await stopScanner();
        } finally {
            isStarting = false;
        }
    }

    // Ensure manual search controls exist in scanner modal
    let manualSearchForm = document.getElementById("manualQrLookupForm");
    if (!manualSearchForm) {
        const manualContainer = document.createElement("div");
        manualContainer.className = "manual-lookup-box";
        manualContainer.innerHTML = `
            <form id="manualQrLookupForm" style="display: flex; gap: 8px; width: 100%;">
                <input type="text" id="manualEquipmentInput" placeholder="Enter Equipment ID (e.g., LAB001)" required>
                <button type="submit" class="btn btn-primary btn-sm">Look Up</button>
            </form>
        `;

        if (scannerModal.querySelector(".scanner-content")) {
            scannerModal.querySelector(".scanner-content").appendChild(manualContainer);
        }

        manualSearchForm = document.getElementById("manualQrLookupForm");
        if (manualSearchForm) {
            manualSearchForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const input = document.getElementById("manualEquipmentInput");
                if (input && input.value.trim()) {
                    await fetchEquipment(input.value.trim());
                }
            });
        }
    }

    // Open scanner modal
    openScannerBtn.addEventListener("click", async () => {
        scannerModal.style.display = "flex";
        await startScanner();
    });

    // Close scanner modal
    if (closeScannerBtn) {
        closeScannerBtn.addEventListener("click", async () => {
            await stopScanner();
            scannerModal.style.display = "none";
        });
    }

    // Stop scanner button
    if (stopScannerBtn) {
        stopScannerBtn.addEventListener("click", async () => {
            await stopScanner();
            scannerStatus.textContent = "Camera stopped. Use manual search if needed.";
        });
    }

    // Modal background click
    scannerModal.addEventListener("click", async (e) => {
        if (e.target === scannerModal) {
            await stopScanner();
            scannerModal.style.display = "none";
        }
    });

    // Return lookup function so callers can trigger programmatically
    return {
        lookup: fetchEquipment,
        stop: stopScanner
    };
}
