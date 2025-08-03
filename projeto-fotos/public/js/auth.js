document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro no login');
            }

            const result = await response.json();
            messageDiv.textContent = result.message;
            messageDiv.className = 'success';
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Erro:', error);
            messageDiv.textContent = error.message || 'Erro ao conectar com o servidor.';
            messageDiv.className = 'error';
        }
    });
});