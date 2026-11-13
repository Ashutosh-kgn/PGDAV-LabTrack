import { auth, db, isAuthorizedEmail } from "./app.js";
import {
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Password Visibility Toggles
function setupPasswordToggle(buttonId, inputId) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener("click", () => {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        btn.textContent = isPassword ? "🙈" : "👁️";
    });
}

setupPasswordToggle("toggleSignupPassword", "signupPassword");
setupPasswordToggle("toggleConfirmPassword", "confirmPassword");

// Real-time Password Matching & Constraints Validation
const signupPasswordInput = document.getElementById("signupPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordMatchIndicator = document.getElementById("passwordMatchIndicator");

function validatePasswordMatching() {
    if (!signupPasswordInput || !confirmPasswordInput || !passwordMatchIndicator) return;

    const pw = signupPasswordInput.value;
    const cpw = confirmPasswordInput.value;

    if (!cpw) {
        passwordMatchIndicator.textContent = "";
        passwordMatchIndicator.className = "password-match-indicator";
        return;
    }

    if (pw === cpw) {
        passwordMatchIndicator.textContent = "✓ Passwords match";
        passwordMatchIndicator.className = "password-match-indicator match";
    } else {
        passwordMatchIndicator.textContent = "✕ Passwords do not match";
        passwordMatchIndicator.className = "password-match-indicator mismatch";
    }
}

signupPasswordInput?.addEventListener("input", validatePasswordMatching);
confirmPasswordInput?.addEventListener("input", validatePasswordMatching);

// Student Registration Form Handler
const signupForm = document.getElementById("signupForm");
const signupBtn = document.getElementById("signupBtn");
const signupMessage = document.getElementById("signupMessage");

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("signupName").value.trim();
        const rollNo = document.getElementById("signupRollNo")?.value.trim() || "";
        const course = document.getElementById("signupCourse")?.value.trim() || "";
        const email = document.getElementById("signupEmail").value.trim().toLowerCase();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!name || !rollNo || !course) {
            signupMessage.textContent = "Please fill in your Full Name, College Roll Number, and Course.";
            signupMessage.style.color = "var(--danger)";
            return;
        }

        if (!isAuthorizedEmail(email)) {
            signupMessage.textContent = "Please provide an authorized institutional email address.";
            signupMessage.style.color = "var(--danger)";
            return;
        }

        // Password Constraints: min 6 chars, letter + number
        if (password.length < 6) {
            signupMessage.textContent = "Password must be at least 6 characters long.";
            signupMessage.style.color = "var(--danger)";
            return;
        }

        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (!hasLetter || !hasNumber) {
            signupMessage.textContent = "Password must contain at least one letter and one number.";
            signupMessage.style.color = "var(--danger)";
            return;
        }

        if (password !== confirmPassword) {
            signupMessage.textContent = "Passwords do not match.";
            signupMessage.style.color = "var(--danger)";
            return;
        }

        signupBtn.disabled = true;
        signupMessage.textContent = "Creating student account...";
        signupMessage.style.color = "var(--primary)";

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            const userProfile = {
                name: name,
                email: email,
                role: "student",
                rollNo: rollNo,
                course: course,
                active: false,
                status: "pending",
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, "users", user.uid), userProfile);

            await signOut(auth);

            signupMessage.textContent = "Registration successful! Your account is pending admin approval. You can now login once approved.";
            signupMessage.style.color = "var(--success)";

            signupForm.reset();
            if (passwordMatchIndicator) passwordMatchIndicator.textContent = "";

        } catch (error) {
            console.error("Signup error:", error);
            signupMessage.textContent = error.message;
            signupMessage.style.color = "var(--danger)";
        } finally {
            signupBtn.disabled = false;
        }
    });
}

