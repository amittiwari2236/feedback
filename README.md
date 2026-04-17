# QR Admission System Setup

This repository contains the admission form frontend and backend. Follow these steps to set up the integrations.

## 1. Local Setup
1. Open this directory in your terminal and run `npm install`.
2. Copy `.env.example` to `.env` (or just rename it to `.env`).
3. Fill out the environment variables according to the steps below.
4. Run `npm start` to start the server.

## 2. SMTP Setup (for Email Notifications)
Since you are using a Gmail account (`amittiwari2236@gmail.com`), you need an "App Password":
1. Go to your Google Account Settings -> Security.
2. Enable 2-Step Verification if you haven't.
3. Search for "App Passwords". Set the app name to "AdmissionForm" and click generate.
4. Copy the generated 16-character password.
5. In `.env`, set `SMTP_USER=amittiwari2236@gmail.com` and `SMTP_PASS=the_16_character_password`.

## 3. Google Sheets Setup (for Storage)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to "APIs & Services" -> "Library". Search for **Google Sheets API** and enable it.
4. Go to "APIs & Services" -> "Credentials". Click "Create Credentials" -> "Service Account".
5. Fill details and create. Then click the created service account, go to the **Keys** tab, click "Add Key" -> "Create new key" -> JSON.
6. A JSON file will download. Open it.
7. From the JSON, copy the `client_email` and put it as `GOOGLE_SERVICE_ACCOUNT_EMAIL` in `.env`.
8. Copy the `private_key` (including `-----BEGIN PRIVATE KEY...`) and put it inside quotes for `GOOGLE_PRIVATE_KEY` in `.env`.
9. **Important:** Create a new Google Sheet. Copy its ID from the URL (e.g. `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`). Set this as `GOOGLE_SHEET_ID`.
10. Finally, inside your Google Sheet, click "Share" and share it with the `client_email` as an "Editor".

## Running the app
URL: `http://localhost:3000`
Admin panel: `http://localhost:3000/admin`
