import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDhdxo5xY_b3I7j5JSFZRFY6kO5jq5EMI0",
    authDomain: "qr-based-project.firebaseapp.com",
    projectId: "qr-based-project",
    storageBucket: "qr-based-project.firebasestorage.app",
    messagingSenderId: "495599145715",
    appId: "1:495599145715:web:b9d7d8cf532e294ee01d86",
    measurementId: "G-DB99HFJWBY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { sendPasswordResetEmail, signOut };

// Email domain constraint helper
export function isAuthorizedEmail(email) {
    if (!email || typeof email !== "string") return false;
    const clean = email.trim().toLowerCase();
    const domainPattern = /^[a-zA-Z0-9._%+-]+@pgdav\.du\.ac\.in$/;
    return domainPattern.test(clean);
}

console.log("Firebase initialized successfully!");

// Form elements
const loginSection = document.getElementById("loginSection");
const signupSection = document.getElementById("signupSection");

const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");

// Switch to Signup
showSignup?.addEventListener("click", (event) => {
    event.preventDefault();
    loginSection.style.display = "none";
    signupSection.style.display = "block";
});

// Switch to Login
showLogin?.addEventListener("click", (event) => {
    event.preventDefault();
    signupSection.style.display = "none";
    loginSection.style.display = "block";
});

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

setupPasswordToggle("toggleLoginPassword", "password");
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

// Student Signup
const signupForm = document.getElementById("signupForm");

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("signupName").value.trim();
        const rollNo = document.getElementById("signupRollNo")?.value.trim() || "";
        const course = document.getElementById("signupCourse")?.value.trim() || "";
        const email = document.getElementById("signupEmail").value.trim().toLowerCase();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const signupMessage = document.getElementById("signupMessage");
        const signupBtn = document.getElementById("signupBtn");

        if (!rollNo || !course) {
            signupMessage.textContent = "Please fill in your College Roll Number and Course.";
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

            await setDoc(doc(db, "users", user.uid), {
                name: name,
                email: email,
                rollNo: rollNo,
                course: course,
                role: "student",
                active: false,
                status: "pending",
                createdAt: serverTimestamp()
            });

            await signOut(auth);

            signupMessage.textContent =
                "Registration successful! Please wait for admin approval.";
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

// Login - Admin and Student
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const selectedRole = document.getElementById("loginRole").value;
        const message = document.getElementById("message");
        const loginBtn = document.getElementById("loginBtn");

        if (!isAuthorizedEmail(email)) {
            message.textContent = "Please enter an authorized institutional email address.";
            message.style.color = "var(--danger)";
            return;
        }

        loginBtn.disabled = true;
        message.textContent = "Verifying credentials...";
        message.style.color = "var(--primary)";

        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                await signOut(auth);
                throw new Error("User profile not found in database.");
            }

            const userData = userDoc.data();
            if (userData.role !== selectedRole) {
                await signOut(auth);
                throw new Error("Selected role does not match your account.");
            }

            if (userData.active !== true) {
                await signOut(auth);
                throw new Error("Your account is pending admin approval.");
            }

            if (userData.role === "admin") {
                message.textContent = "Admin login successful! Redirecting...";
                message.style.color = "var(--success)";
                window.location.href = "dashboard.html";
            } else if (userData.role === "student") {
                message.textContent = "Student login successful! Redirecting...";
                message.style.color = "var(--success)";
                window.location.href = "student.html";
            } else {
                await signOut(auth);
                throw new Error("Invalid user role.");
            }

        } catch (error) {
            console.error("Login error:", error);
            message.textContent = error.message;
            message.style.color = "var(--danger)";
        } finally {
            loginBtn.disabled = false;
        }
    });
}
