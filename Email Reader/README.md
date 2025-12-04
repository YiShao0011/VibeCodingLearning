# Outlook Email Reader

A Python application to read and manage your Outlook emails easily.

## Features

- 📧 View recent emails from your inbox
- 🔍 Search emails by subject or sender
- ✉️ View unread emails
- 📅 Filter emails by date range
- 🔐 Secure authentication with OAuth2 or basic auth
- 📎 Display attachment indicators
- ✓ Mark emails as read

## Requirements

- Python 3.7+
- Outlook/Microsoft 365 account
- Active internet connection

## Installation

### 1. Clone or Download the Project

Navigate to the project directory in your terminal.

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Authentication

#### Option A: Using OAuth2 (Recommended for Microsoft 365)

1. Register an Azure application:
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a new app registration
   - Add permissions: `Mail.Read`, `Mail.ReadWrite`
   - Create a client secret
   
2. Copy `.env.example` to `.env`

3. Fill in your credentials:
   ```
   OUTLOOK_EMAIL=your-email@example.com
   OUTLOOK_CLIENT_ID=your-azure-app-id
   OUTLOOK_CLIENT_SECRET=your-azure-app-secret
   OUTLOOK_TENANT_ID=your-azure-tenant-id
   ```

#### Option B: Using Basic Authentication

1. Copy `.env.example` to `.env`

2. For Microsoft 365 accounts, create an **app password**:
   - Go to https://account.microsoft.com/account/security
   - Create an app password for mail
   - Use this password instead of your regular password

3. Fill in your credentials:
   ```
   OUTLOOK_EMAIL=your-email@example.com
   OUTLOOK_PASSWORD=your-app-password
   ```

## Usage

Run the application:

```bash
python outlook_reader.py
```

The application will present a menu with the following options:

1. **View recent emails** - Display the 10 most recent emails
2. **View unread emails** - Show all unread emails
3. **View emails from last 7 days** - Filter by date range
4. **Search emails** - Search by subject or sender
5. **Exit** - Close the application

## Troubleshooting

### "Authentication failed" error
- Ensure your credentials are correct
- For Microsoft 365, use an app password instead of your regular password
- Check that you have internet connectivity

### "Connection timeout" error
- Verify your internet connection
- Check if your firewall blocks the connection
- Try again in a moment

### No emails displayed
- Ensure your Outlook account has emails
- Check that the search query is correct
- Verify your account permissions

## Security Notes

- Never commit your `.env` file to version control
- Use app passwords instead of your actual password
- Store credentials securely
- The application does not store any emails locally

## API Reference

### OutlookEmailReader Class

#### Methods

- `get_inbox_emails(limit=10)` - Retrieve recent emails
- `get_unread_emails()` - Get all unread emails
- `get_emails_from_date(days_back=7, limit=20)` - Get emails from specific date range
- `search_emails(query, limit=10)` - Search emails
- `mark_as_read(email_index)` - Mark email as read
- `display_emails(emails)` - Format and display emails

## License

MIT License

## Support

For issues or questions, please create an issue in the repository.
