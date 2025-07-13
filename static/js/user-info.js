document.addEventListener('DOMContentLoaded', function () {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDetailsContainer = document.getElementById('user-details-container');
    const userAvatar = userDetailsContainer ? userDetailsContainer.querySelector('.user-avatar') : null;
    const userNameSpan = userDetailsContainer ? userDetailsContainer.querySelector('.user-name') : null;
    const userRoleSpan = userDetailsContainer ? userDetailsContainer.querySelector('.user-role') : null;

    fetch("/api/users/me")
        .then(response => {
            if (!response.ok) {
                throw new Error("Not authenticated");
            }
            return response.json();
        })
        .then(data => {
            const { name, email, roles } = data;
            const role = Array.isArray(roles) && roles.length > 0 ? roles[0] : 'User';

            localStorage.setItem('username', name);
            localStorage.setItem('email', email);
            localStorage.setItem('userRole', role);

            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (userDetailsContainer) userDetailsContainer.style.display = 'flex';

            if (userNameSpan) userNameSpan.textContent = name;
            if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
            if (userRoleSpan) userRoleSpan.textContent = role;
        })
        .catch(error => {
            // If not logged in or error
            console.log("User not authenticated", error);
            localStorage.clear();

            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userDetailsContainer) userDetailsContainer.style.display = 'none';
        });
});

// Logout function
function logout() {
    localStorage.clear();
    window.location.href = "/api/auth/logout";
}
