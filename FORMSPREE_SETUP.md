# FormSpree Setup Guide

This document explains how to set up [FormSpree](https://formspree.io/) to handle form submissions for the human study questionnaire.

## What is FormSpree?

FormSpree is a simple form processing service that allows static websites (such as GitHub Pages) to handle form submissions without writing backend code. It offers both free and paid plans.

## Setup Steps

### 1. Create a FormSpree Account

1. Visit [formspree.io](https://formspree.io/)
2. Click "Sign Up" to create a new account (you can sign in with your GitHub account)
3. Verify your email address

### 2. Create a New Form

1. Log in to your FormSpree account
2. Click the "New Form" button
3. Fill in the form name (e.g., "Human Study Questionnaire")
4. Select the form type (optional)
5. Click "Create Form"

### 3. Get Your Form ID

After creating the form, you'll receive a form ID. It looks something like this: `xrgkpzlq` (example).

### 4. Update the questionnaire.js File

1. Open the `questionnaire.js` file
2. Find the following line:
   ```javascript
   const formSpreeEndpoint = 'https://formspree.io/f/YOUR_FORM_ID';
   ```
3. Replace `YOUR_FORM_ID` with your actual FormSpree form ID

### 5. Test Form Submission

1. Deploy the updated website (push to GitHub)
2. Fill out and submit the questionnaire
3. Check the FormSpree dashboard to confirm receipt of the submission
4. You will also receive an email notification (based on FormSpree settings)

## Form Submission Data Structure

The data format for each submission is as follows:

```javascript
{
  "evaluator": {
    "name": "User Name",
    "email": "User Email",
    "additionalComments": "Additional Comments"
  },
  "responses": [
    {
      "videoId": "Video ID",
      "selectedOption": Selected Option Index,
      "comments": "User comments for this video"
    },
    // More video responses...
  ],
  "submittedAt": "ISO format timestamp"
}
```

## View Submission Data

1. Log in to FormSpree
2. Find your form
3. View the "Submissions" tab
4. You can view details of all submissions
5. Data can be exported as CSV or accessed via the FormSpree API

## Advanced Settings (Optional)

FormSpree offers more advanced features:

- Form validation rules
- Spam protection
- Custom redirect URLs
- Custom email notifications
- Webhooks integration
- And more

See the [FormSpree documentation](https://help.formspree.io/) for more information.

## Troubleshooting

If form submissions aren't working:

1. Check the browser console for errors
2. Confirm the FormSpree ID is correct
3. Ensure the website doesn't have CORS or CSP restrictions
4. Free plans have submission limits; check if you've exceeded the limit 