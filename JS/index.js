 function selectRole(role) {
            const options = document.querySelectorAll('.role-option');
            options.forEach(option => option.classList.remove('active'));
            
            if (role === 'farmer') {
                options[0].classList.add('active');
            } else {
                options[1].classList.add('active');
            }
        }

        function handleSignIn() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }
            
            // Demo mode - just show success message
            alert('Sign in successful! Redirecting to dashboard...');
            // In real app, would redirect: window.location.href = '/dashboard';
        }

        // Handle Enter key press
        document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSignIn();
            }
        });

        document.getElementById('email').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSignIn();
            }
        });