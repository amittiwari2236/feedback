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

    if (!form || !submitBtn || !statusMsg) {
        console.error('Form elements not found. Expected alumniForm, submitBtn, and statusMessage.');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        statusMsg.classList.add('hidden');
        statusMsg.classList.remove('success', 'error');

        const fields = new FormData(form);
        const formData = {
            fullName: String(fields.get('fullName') || '').trim(),
            email: String(fields.get('email') || '').trim(),
            phone: String(fields.get('phone') || '').trim(),
            location: String(fields.get('location') || '').trim(),
            year: String(fields.get('year') || '').trim(),
            profession: String(fields.get('profession') || '').trim(),
            experience: String(fields.get('experience') || '').trim(),
            message: String(fields.get('message') || '').trim()
        };

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();

            if (result.success) {
                statusMsg.textContent = 'Application submitted successfully! We will contact you soon.';
                statusMsg.classList.add('success');
                statusMsg.classList.remove('hidden');
                form.reset();
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
            submitBtn.textContent = 'Submit Application';
        }
    });
});
