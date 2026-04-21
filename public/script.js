document.addEventListener("DOMContentLoaded", () => {
    
    // 0. Load Dynamic Settings
    fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            if (data) {
                const titleHeading = document.querySelector('.logo-text h1');
                const subtitleP = document.querySelector('.logo-text p');
                const logoImg = document.querySelector('.logo-img');
                
                if (titleHeading && data.title) titleHeading.textContent = data.title;
                if (subtitleP && data.subtitle) subtitleP.textContent = data.subtitle;
                if (logoImg && data.logoUrl) logoImg.src = data.logoUrl;
            }
        })
        .catch(err => console.error("Could not load display settings:", err));

    // 1. JS Execution Layer Fix
    const cContainer = document.getElementById('curtainContainer');
    const mainContainer = document.getElementById('mainContainer');

    // 2. Play CSS animation after 0.3s
    setTimeout(() => { 
        document.body.classList.add('curtains-opened'); 
    }, 300);

    // 3. Hide curtain entirely and show form gracefully after animation ends (2.0s map against 0.3s delay)
    setTimeout(() => {
        if (cContainer) cContainer.style.display = 'none';
        if (mainContainer) mainContainer.classList.add('show');
    }, 2000);



    // 3. Popup with Random Quote
    const quotes = [
        "Start your journey today.\nSuccess begins with action.",
        "Dream big.\nAct bigger.",
        "Education is the passport to the future,\nfor tomorrow belongs to those who prepare for it.",
        "Develop a passion for learning.\nIf you do, you will never cease to grow."
    ];

    setTimeout(() => {
        const popupOverlay = document.getElementById('popupOverlay');
        const popupQuote = document.getElementById('popupQuote');
        
        // Pick random quote
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        popupQuote.innerHTML = randomQuote.replace(/\n/g, '<br/>');

        popupOverlay.classList.remove('hidden');
    }, 2000); // Trigger 2s after load since form fades in immediately

    // Close popup
    const closePopupBtn = document.getElementById('closePopup');
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', () => {
            document.getElementById('popupOverlay').classList.add('hidden');
        });
    }

    // 3. Form Submission Handling
    const form = document.getElementById('alumniForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const emojiContainer = document.getElementById('emojiContainer');
    const emojiInput = document.getElementById('emojiValue');
    const messageSection = document.getElementById('feedbackMessageSection');
    const messageTextarea = document.getElementById('message');
    const messageLabel = document.getElementById('messageLabel');
    const successOverlay = document.getElementById('successOverlay');

    if (!form || !submitBtn || !statusMsg) {
        console.error('Form elements not found. Expected alumniForm, submitBtn, and statusMessage.');
        return;
    }

    // Emoji Logic
    if (emojiContainer) {
        const emojis = emojiContainer.querySelectorAll('.emoji-btn');
        emojis.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected class from all
                emojis.forEach(e => e.classList.remove('selected'));
                // Add selected class to clicked
                btn.classList.add('selected');
                
                // Store value
                const emojiVal = btn.dataset.emoji;
                emojiInput.value = emojiVal;
                
                // Show message section and submit button
                messageSection.classList.remove('hidden');
                submitBtn.classList.remove('hidden');

                // Validation rule
                if (['😐', '😕', '😣'].includes(emojiVal)) {
                    messageTextarea.required = true;
                    messageLabel.textContent = 'Message (Required)';
                } else {
                    messageTextarea.required = false;
                    messageLabel.textContent = 'Message (Optional)';
                }
            });
        });
    }

    // Custom Validation for Whatsapp
    const whatsappInput = document.getElementById('whatsapp');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value.length > 10) {
                e.target.value = e.target.value.slice(0, 10);
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Final Validation Check
        if (whatsappInput && whatsappInput.value.length !== 10) {
            alert('Whatsapp number must be exactly 10 digits.');
            return;
        }

        if (!emojiInput.value) {
            alert('Please select an emoji rating.');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        statusMsg.classList.add('hidden');
        statusMsg.classList.remove('success', 'error');

        const fields = new FormData(form);
        const requestData = {
            name: String(fields.get('name') || '').trim(),
            designation: String(fields.get('designation') || '').trim(),
            organisation: String(fields.get('organisation') || '').trim(),
            email: String(fields.get('email') || '').trim(),
            whatsapp: String(fields.get('whatsapp') || '').trim(),
            location: String(fields.get('location') || '').trim(),
            emoji: String(fields.get('emoji') || '').trim(),
            message: String(fields.get('message') || '').trim()
        };

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            const result = await response.json();

            if (result.success) {
                // Show Full Screen Success UI
                if (successOverlay) {
                    successOverlay.classList.remove('hidden');
                    // slight delay to allow display:block to apply before opacity transition
                    setTimeout(() => {
                        successOverlay.classList.add('show');
                    }, 50);
                } else {
                    statusMsg.textContent = 'Feedback submitted successfully!';
                    statusMsg.classList.add('success');
                    statusMsg.classList.remove('hidden');
                }
                form.reset();
                if (emojiContainer) {
                    emojiContainer.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('selected'));
                }
                messageSection.classList.add('hidden');
                submitBtn.classList.add('hidden');
            } else {
                statusMsg.textContent = result.message || 'Something went wrong. Please try again.';
                statusMsg.classList.add('error');
                statusMsg.classList.remove('hidden');
            }
        } catch (error) {
            statusMsg.textContent = 'Network error. Please try again later.';
            statusMsg.classList.add('error');
            statusMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
        }
    });
});