document.addEventListener("DOMContentLoaded", () => {

    // Tab switching
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(item.dataset.target).classList.add('active');
        });
    });

    // 1. Fetch QR Code
    fetch('/api/qr')
        .then(res => res.json())
        .then(data => {
            const qrLoading = document.getElementById('qrLoading');
            const qrImg = document.getElementById('qrImg');
            const downloadBtn = document.getElementById('downloadQrBtn');

            if (data.success && data.qrCodeUrl) {
                qrLoading.style.display = 'none';
                qrImg.src = data.qrCodeUrl;
                qrImg.style.display = 'block';
                downloadBtn.style.display = 'inline-block';

                downloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = data.qrCodeUrl;
                    a.download = 'form_qr.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            } else {
                qrLoading.textContent = "Failed to load QR code.";
            }
        })
        .catch(err => {
            document.getElementById('qrLoading').textContent = "Error loading QR code.";
        });

    // 2. Fetch Submissions
    fetch('/api/data')
        .then(res => res.json())
        .then(data => {
            const tableLoading = document.getElementById('tableLoading');
            const table = document.getElementById('submissionsTable');
            const tbody = document.getElementById('tableBody');

            if (data.success) {
                tableLoading.style.display = 'none';
                table.style.display = 'table';

                if (data.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No applications found yet.</td></tr>';
                    return;
                }

                const reversedData = [...data.data].reverse();

                // Form array struct: 0:Name, 1:Email, 2:Phone, 3:Location, 4:Year, 5:Profession, 6:Experience, 7:Message, 8:Date
                reversedData.forEach((row, index) => {
                    const tr = document.createElement('tr');

                    const dateTxt = row[8] ? new Date(row[8]).toLocaleString() : '-';
                    const cols = [
                        dateTxt,            // Date
                        row[0] || '-',      // Name
                        row[1] || '-',      // Email
                        row[2] || '-',      // Phone
                        row[3] || '-',      // Location
                        row[4] || '-',      // Batch Year
                        row[5] || '-',      // Profession
                    ];

                    cols.forEach(val => {
                        const td = document.createElement('td');
                        td.textContent = val;
                        tr.appendChild(td);
                    });

                    // Action column
                    const actionTd = document.createElement('td');
                    const viewBtn = document.createElement('button');
                    viewBtn.className = 'view-msg-btn';
                    viewBtn.textContent = 'View Full';
                    viewBtn.onclick = () => showModal(row);
                    actionTd.appendChild(viewBtn);
                    tr.appendChild(actionTd);

                    tbody.appendChild(tr);
                });
            } else {
                tableLoading.textContent = data.message || "Failed to fetch submissions.";
            }
        })
        .catch(err => {
            document.getElementById('tableLoading').textContent = "Error communicating with server.";
        });

    // 3. Load Settings
    fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            if (data) {
                document.getElementById('cfgTitle').value = data.title || "";
                document.getElementById('cfgSubtitle').value = data.subtitle || "";
                document.getElementById('cfgLogo').value = data.logoUrl || "";
            }
        });

    // 4. Save Settings
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = document.getElementById('settingsMsg');
        msg.textContent = 'Saving...';
        msg.style.color = '#666';

        const payload = {
            title: document.getElementById('cfgTitle').value,
            subtitle: document.getElementById('cfgSubtitle').value,
            logoUrl: document.getElementById('cfgLogo').value
        };

        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    msg.textContent = 'Settings saved successfully! Overrides are now active.';
                    msg.style.color = '#28a745';
                } else {
                    msg.textContent = 'Failed to save settings.';
                    msg.style.color = '#dc3545';
                }
            })
            .catch(err => {
                msg.textContent = 'Error saving settings.';
                msg.style.color = '#dc3545';
            });
    });
});

function showModal(row) {
    // 0:Name, 1:Email, 2:Phone, 3:Location, 4:Year, 5:Profession, 6:Experience, 7:Message, 8:Date
    const modalContent = document.getElementById('modalContent');
    const safeContent = (text) => {
        const div = document.createElement('div');
        div.textContent = text || '-';
        return div.innerHTML;
    };

    modalContent.innerHTML = `
        <p><strong>Date & Time:</strong> ${row[8] ? new Date(row[8]).toLocaleString() : '-'}</p>
        <p><strong>Full Name:</strong> ${safeContent(row[0])}</p>
        <p><strong>Email:</strong> ${safeContent(row[1])}</p>
        <p><strong>Phone:</strong> ${safeContent(row[2])}</p>
        <p><strong>Subject / Location:</strong> ${safeContent(row[3])}</p>
        <p><strong>Batch Year:</strong> ${safeContent(row[4])}</p>
        <p><strong>Profession:</strong> ${safeContent(row[5])}</p>
        <p><strong>Experience:</strong> ${safeContent(row[6])}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <p><strong>Message / Query:</strong><br/> <span style="white-space: pre-wrap;">${safeContent(row[7])}</span></p>
    `;
    document.getElementById('detailsModal').classList.add('active');
}

function closeModal() {
    document.getElementById('detailsModal').classList.remove('active');
}
