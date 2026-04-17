const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const normalizeText = (value) => String(value || '').trim();
const sanitizeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripWrappingQuotes = (value) => {
    const trimmed = normalizeText(value);

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
};

const looksLikePlaceholder = (value) => /your-service-account-email|your-project|your(?:\s|\\n)*key(?:\s|\\n)*here/i.test(value);
const getSpreadsheetId = () => normalizeText(process.env.GOOGLE_SHEET_ID);
const formatGoogleSheetsError = (error) => {
    const message = normalizeText(error?.message || 'Unknown Google Sheets error.');

    if (/invalid_grant:\s*invalid jwt signature/i.test(message)) {
        return 'Google Sheets service-account key is invalid or no longer active. Update google_sheet_key.json or the GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY values with an active key.';
    }

    return message;
};

let sheetsClientPromise = null;
let resolvedSheetRangePromise = null;
let cachedTransporter = undefined;

const getGoogleAuthOptions = () => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    const serviceAccountEmail = normalizeText(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    const privateKey = stripWrappingQuotes(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const hasUsableEnvCredentials =
        serviceAccountEmail &&
        privateKey &&
        !looksLikePlaceholder(serviceAccountEmail) &&
        !looksLikePlaceholder(privateKey);

    if (hasUsableEnvCredentials) {
        return {
            credentials: {
                client_email: serviceAccountEmail,
                private_key: privateKey,
            },
            scopes,
            source: 'environment variables',
        };
    }

    const keyFile = path.join(__dirname, 'google_sheet_key.json');
    if (fs.existsSync(keyFile)) {
        return {
            keyFile,
            scopes,
            source: 'google_sheet_key.json',
        };
    }

    return null;
};

const setupGoogleSheets = async () => {
    if (sheetsClientPromise) {
        return sheetsClientPromise;
    }

    try {
        const authOptions = getGoogleAuthOptions();
        if (!authOptions) {
            console.warn('Google Sheets credentials are missing.');
            return null;
        }

        sheetsClientPromise = (async () => {
            const { source, ...googleAuthOptions } = authOptions;
            const authConfig = new google.auth.GoogleAuth(googleAuthOptions);
            const client = await authConfig.getClient();

            console.log(`Google Sheets auth ready using ${source}.`);
            return google.sheets({ version: 'v4', auth: client });
        })();

        return await sheetsClientPromise;
    } catch (error) {
        sheetsClientPromise = null;
        console.error('Google Sheets init failed:', error.message);
        return null;
    }
};

const resolveSheetRange = async (sheets) => {
    const configuredRange = normalizeText(process.env.GOOGLE_SHEET_RANGE);
    if (configuredRange) {
        return configuredRange;
    }

    if (resolvedSheetRangePromise) {
        return resolvedSheetRangePromise;
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEET_ID is missing.');
    }

    resolvedSheetRangePromise = (async () => {
        const configuredSheetName = normalizeText(
            process.env.GOOGLE_SHEET_NAME || process.env.GOOGLE_WORKSHEET_NAME || process.env.GOOGLE_SHEET_TAB
        );
        const columnRange = normalizeText(process.env.GOOGLE_SHEET_COLUMNS || 'A:I');

        if (configuredSheetName) {
            return `${configuredSheetName}!${columnRange}`;
        }

        const metadata = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties(title))',
        });

        const sheetTitle = metadata.data.sheets?.[0]?.properties?.title;
        if (!sheetTitle) {
            throw new Error('No worksheet tab was found in the configured spreadsheet.');
        }

        return `${sheetTitle}!${columnRange}`;
    })();

    try {
        return await resolvedSheetRangePromise;
    } catch (error) {
        resolvedSheetRangePromise = null;
        throw error;
    }
};

const createTransporter = () => {
    if (cachedTransporter !== undefined) {
        return cachedTransporter;
    }

    const smtpUser = normalizeText(process.env.SMTP_USER);
    const smtpHost = normalizeText(process.env.SMTP_HOST || 'smtp.gmail.com');
    const rawSmtpPass = process.env.SMTP_PASS || '';

    if (!smtpUser || !rawSmtpPass) {
        console.warn('SMTP not configured.');
        cachedTransporter = null;
        return cachedTransporter;
    }

    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    const looksLikeGmail = /gmail/i.test(smtpHost) || /@gmail\.com$/i.test(smtpUser);
    const smtpPass = looksLikeGmail ? rawSmtpPass.replace(/\s+/g, '') : rawSmtpPass;

    cachedTransporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
    });

    return cachedTransporter;
};

app.post('/api/submit', async (req, res) => {
    const { fullName, email, phone, course, location, year, profession, experience, message } = req.body;
    const courseOrLocation = normalizeText(location || course);

    console.log('Form Data Received:', req.body);

    const normalizedEmail = normalizeText(email);
    const sheetValues = [
        normalizeText(fullName),
        normalizedEmail,
        normalizeText(phone),
        courseOrLocation,
        normalizeText(year),
        normalizeText(profession),
        normalizeText(experience),
        normalizeText(message),
        new Date().toISOString(),
    ];

    const errors = [];

    try {
        const sheets = await setupGoogleSheets();
        const spreadsheetId = getSpreadsheetId();

        if (sheets && spreadsheetId) {
            const range = await resolveSheetRange(sheets);

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [sheetValues],
                },
            });

            console.log('Saved to Google Sheets');
        } else {
            const errorMessage = 'Google Sheets is not configured or GOOGLE_SHEET_ID is missing.';
            console.warn('Warning:', errorMessage);
            errors.push(errorMessage);
        }
    } catch (error) {
        const googleSheetsMessage = formatGoogleSheetsError(error);
        console.error('Google Sheets Error:', googleSheetsMessage);
        errors.push(`Google Sheets error: ${googleSheetsMessage}`);
    }

    if (errors.length === 0) {
        try {
            const transporter = createTransporter();
            const adminRecipients = (process.env.ADMIN_EMAILS || process.env.SMTP_USER || '')
                .split(',')
                .map((address) => address.trim())
                .filter(Boolean);

            if (transporter && adminRecipients.length > 0) {
                const adminMailOptions = {
                    from: normalizeText(process.env.SMTP_FROM || process.env.SMTP_USER),
                    to: adminRecipients,
                    subject: 'Feedback Submission',
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; background-color: #ffffff; padding: 24px; line-height: 1.6;">
                            <h2 style="margin: 0 0 16px; color: #1b1f4e;">Feedback Submission</h2>
                            <p style="margin: 0 0 18px;">A new feedback submission has been received from the website. The details are listed below.</p>
                            <table style="width: 100%; max-width: 680px; border-collapse: collapse; font-size: 14px;">
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold; width: 32%;">Name</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(fullName)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Email</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(normalizedEmail)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Phone</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(phone)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Location</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(courseOrLocation)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Batch Year</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(year)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Profession</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(profession)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Experience</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(experience)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Message</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${sanitizeHtml(message)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #ddd; background-color: #f4f6f8; font-weight: bold;">Submitted Date and Time</td>
                                    <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
                                </tr>
                            </table>
                        </div>
                    `,
                };

                await transporter.sendMail(adminMailOptions);
                console.log('Notification email sent to admin(s).');
            } else {
                const errorMessage = 'SMTP is not configured or the admin recipient email address is missing.';
                console.warn('Warning:', errorMessage);
                errors.push(errorMessage);
            }
        } catch (error) {
            console.error('Email Error:', error.message);
            errors.push(`Email error: ${error.message}`);
        }
    } else {
        console.warn('Skipping confirmation email because the submission was not stored successfully.');
    }

    if (errors.length > 0) {
        return res.status(500).json({ success: false, message: errors.join(' | ') });
    }

    return res.json({ success: true, message: 'Form submitted successfully!' });
});

app.get('/api/data', async (req, res) => {
    try {
        const sheets = await setupGoogleSheets();
        const spreadsheetId = getSpreadsheetId();

        if (sheets && spreadsheetId) {
            const range = await resolveSheetRange(sheets);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = (response.data.values || []).map((row) => {
                return row;
            });

            return res.json({
                success: true,
                data: rows,
            });
        }

        return res.json({
            success: false,
            message: 'Google Sheets not configured',
        });
    } catch (error) {
        console.error('Fetch Error:', error.message);
        return res.status(500).json({ success: false });
    }
});

app.get('/api/qr', async (req, res) => {
    try {
        const formUrl = process.env.HOST_URL || 'http://localhost:3000/';

        const qrImage = await qrcode.toDataURL(formUrl, {
            color: {
                dark: '#0a0f6a',
                light: '#ffffff',
            },
        });

        return res.json({ success: true, qrCodeUrl: qrImage });
    } catch (error) {
        console.error('QR Error:', error.message);
        return res.status(500).json({ success: false });
    }
});

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

app.get('/api/settings', (req, res) => {
    if (fs.existsSync(SETTINGS_FILE)) {
        res.sendFile(SETTINGS_FILE);
    } else {
        res.json({
            title: "Dev Sanskriti Vishwavidyalaya",
            subtitle: "A University with a difference",
            logoUrl: "https://www.dsvv.ac.in/wp-content/uploads/2022/07/unnamed.jpg"
        });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const { title, subtitle, logoUrl } = req.body;
        const config = {
            title: title || "Dev Sanskriti Vishwavidyalaya",
            subtitle: subtitle || "A University with a difference",
            logoUrl: logoUrl || "https://www.dsvv.ac.in/wp-content/uploads/2022/07/unnamed.jpg"
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Settings saved.' });
    } catch (err) {
        console.error('Settings save error:', err);
        res.status(500).json({ success: false, message: 'Failed to save settings.' });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

const startServer = (port = PORT) => {
    const server = app.listen(port, () => {
        const resolvedPort = server.address()?.port || port;
        console.log(`Server running on http://localhost:${resolvedPort}`);
    });

    return server;
};

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer,
    createTransporter,
    setupGoogleSheets,
    resolveSheetRange,
};
