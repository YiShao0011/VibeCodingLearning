"""
Outlook Email Reader with OAuth2 Support
Works with MFA-enabled corporate accounts.
Uses Microsoft Graph API instead of exchangelib.
"""

import os
import sys
import json
import webbrowser
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.parse

# Load environment variables
load_dotenv()

# Microsoft Graph API settings
GRAPH_API_ENDPOINT = "https://graph.microsoft.com/v1.0"
AZURE_AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0"
CLIENT_ID = "d3590ed6-52b3-4102-aedd-a47eb6b5b65d"  # Microsoft Office client ID
REDIRECT_URI = "http://localhost:8000/callback"
SCOPES = ["https://graph.microsoft.com/.default", "offline_access"]


class CallbackHandler(BaseHTTPRequestHandler):
    """Handle OAuth2 callback"""
    auth_code = None

    def do_GET(self):
        """Handle GET request from OAuth2 redirect"""
        if "code=" in self.path:
            query_params = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query_params)
            CallbackHandler.auth_code = params.get("code", [None])[0]
            
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h1>Authentication successful!</h1>"
                b"<p>You can close this window and return to the application.</p></body></html>"
            )
        else:
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h1>Authentication failed!</h1>"
                b"<p>No authorization code received.</p></body></html>"
            )

    def log_message(self, format, *args):
        """Suppress logging"""
        pass


class OutlookEmailReader:
    """Class to handle reading emails from Outlook using Microsoft Graph API"""

    def __init__(self):
        """Initialize the Outlook email reader"""
        self.access_token = None
        self.headers = None
        self.email = None
        self.connect()

    def connect(self):
        """Connect to Outlook account using OAuth2"""
        try:
            print("\n" + "="*60)
            print("Outlook Email Reader - OAuth2 Authentication")
            print("="*60)
            
            email = os.getenv("OUTLOOK_EMAIL") or input(
                "\nEnter your email address: "
            )
            self.email = email
            
            # Try to load cached token first
            token_file = ".token_cache.json"
            if os.path.exists(token_file):
                print("Found cached authentication token...")
                try:
                    with open(token_file, "r") as f:
                        token_data = json.load(f)
                        self.access_token = token_data.get("access_token")
                        self.headers = {
                            "Authorization": f"Bearer {self.access_token}",
                            "Content-Type": "application/json",
                        }
                    
                    # Test if token is valid
                    if self._test_connection():
                        print("✓ Using cached authentication token")
                        return True
                except Exception:
                    pass
            
            print("\nStarting OAuth2 authentication flow...")
            print("A browser window will open for you to sign in.")
            
            if self._authenticate_with_auth_code_flow():
                print("\n✓ Successfully connected to Outlook!")
                return True
            else:
                print("\n✗ Authentication failed")
                return False

        except Exception as e:
            print(f"Error during authentication: {e}")
            return False

    def _authenticate_with_auth_code_flow(self):
        """Authenticate using authorization code flow"""
        try:
            # Step 1: Start local server for callback
            server = HTTPServer(("localhost", 8000), CallbackHandler)
            server_thread = threading.Thread(target=server.handle_request)
            server_thread.daemon = True
            server_thread.start()
            
            # Step 2: Build authorization URL
            auth_url = (
                f"{AZURE_AUTH_ENDPOINT}/authorize?"
                f"client_id={CLIENT_ID}"
                f"&redirect_uri={urllib.parse.quote(REDIRECT_URI, safe='')}"
                f"&response_type=code"
                f"&scope={urllib.parse.quote(' '.join(SCOPES), safe='')}"
                f"&prompt=select_account"
            )
            
            # Step 3: Open browser
            print(f"\nOpening browser for authentication...")
            webbrowser.open(auth_url)
            print(f"If browser doesn't open, visit: {auth_url}")
            
            # Step 4: Wait for callback
            print("\nWaiting for authentication...")
            server_thread.join(timeout=120)
            server.server_close()
            
            if not CallbackHandler.auth_code:
                print("Authentication timeout or cancelled")
                return False
            
            # Step 5: Exchange code for token
            print("Exchanging authorization code for access token...")
            token_url = f"{AZURE_AUTH_ENDPOINT}/token"
            token_payload = {
                "client_id": CLIENT_ID,
                "code": CallbackHandler.auth_code,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
                "scope": " ".join(SCOPES),
            }
            
            response = requests.post(token_url, data=token_payload)
            response.raise_for_status()
            token_data = response.json()
            
            self.access_token = token_data["access_token"]
            self.headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            }
            
            # Cache the token
            with open(".token_cache.json", "w") as f:
                json.dump(token_data, f)
            
            return True
            
        except Exception as e:
            print(f"Authentication error: {e}")
            return False

    def _test_connection(self):
        """Test if the access token is valid"""
        try:
            response = requests.get(
                f"{GRAPH_API_ENDPOINT}/me",
                headers=self.headers,
            )
            return response.status_code == 200
        except Exception:
            return False

    def get_inbox_emails(self, limit=10):
        """
        Get emails from the inbox
        
        Args:
            limit: Number of emails to retrieve (default: 10)
            
        Returns:
            List of email dictionaries
        """
        try:
            if not self.access_token:
                print("Not connected to Outlook")
                return []

            # Get messages
            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$top={limit}&$orderby=receivedDateTime desc"
            )
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                email_data = {
                    "from": item["from"]["emailAddress"]["address"],
                    "from_name": item["from"]["emailAddress"]["name"],
                    "subject": item.get("subject", "[No Subject]"),
                    "date": datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00")),
                    "body_preview": item.get("bodyPreview", ""),
                    "is_read": item.get("isRead", False),
                    "has_attachments": item.get("hasAttachments", False),
                }
                emails.append(email_data)
            
            return emails

        except Exception as e:
            print(f"Error retrieving emails: {e}")
            return []

    def get_unread_emails(self):
        """Get unread emails from the inbox"""
        try:
            if not self.access_token:
                print("Not connected to Outlook")
                return []

            # Get unread messages
            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$filter=isRead eq false&$orderby=receivedDateTime desc&$top=50"
            )
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                email_data = {
                    "from": item["from"]["emailAddress"]["address"],
                    "from_name": item["from"]["emailAddress"]["name"],
                    "subject": item.get("subject", "[No Subject]"),
                    "date": datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00")),
                    "body_preview": item.get("bodyPreview", ""),
                    "is_read": item.get("isRead", False),
                    "has_attachments": item.get("hasAttachments", False),
                }
                emails.append(email_data)
            
            return emails

        except Exception as e:
            print(f"Error retrieving unread emails: {e}")
            return []

    def get_emails_from_date(self, days_back=7, limit=20):
        """
        Get emails from the last N days
        
        Args:
            days_back: Number of days to look back (default: 7)
            limit: Maximum number of emails to retrieve (default: 20)
            
        Returns:
            List of email dictionaries
        """
        try:
            if not self.access_token:
                print("Not connected to Outlook")
                return []

            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            
            # Get messages from date
            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$filter=receivedDateTime ge {cutoff_date}"
                f"&$orderby=receivedDateTime desc&$top={limit}"
            )
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                email_data = {
                    "from": item["from"]["emailAddress"]["address"],
                    "from_name": item["from"]["emailAddress"]["name"],
                    "subject": item.get("subject", "[No Subject]"),
                    "date": datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00")),
                    "body_preview": item.get("bodyPreview", ""),
                    "is_read": item.get("isRead", False),
                    "has_attachments": item.get("hasAttachments", False),
                }
                emails.append(email_data)
            
            return emails

        except Exception as e:
            print(f"Error retrieving emails: {e}")
            return []

    def search_emails(self, query, limit=10):
        """
        Search for emails by subject or sender
        
        Args:
            query: Search query
            limit: Maximum number of results (default: 10)
            
        Returns:
            List of matching email dictionaries
        """
        try:
            if not self.access_token:
                print("Not connected to Outlook")
                return []

            # Search emails
            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$search=\"subject:{query} OR from:{query}\""
                f"&$top={limit}"
            )
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                email_data = {
                    "from": item["from"]["emailAddress"]["address"],
                    "from_name": item["from"]["emailAddress"]["name"],
                    "subject": item.get("subject", "[No Subject]"),
                    "date": datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00")),
                    "body_preview": item.get("bodyPreview", ""),
                    "is_read": item.get("isRead", False),
                    "has_attachments": item.get("hasAttachments", False),
                }
                emails.append(email_data)
            
            return emails

        except Exception as e:
            print(f"Error searching emails: {e}")
            return []

    def display_emails(self, emails):
        """Display emails in a formatted manner"""
        if not emails:
            print("No emails found.")
            return

        print("\n" + "=" * 100)
        for i, email in enumerate(emails):
            status = "✓ Read" if email["is_read"] else "✗ Unread"
            attachments = " [📎 Attachments]" if email["has_attachments"] else ""
            print(f"\n[{i}] {status} {attachments}")
            print(f"From: {email['from_name']} <{email['from']}>")
            print(f"Subject: {email['subject']}")
            print(f"Date: {email['date'].strftime('%Y-%m-%d %H:%M:%S')}")
            preview = email['body_preview'][:200] + "..." if len(email['body_preview']) > 200 else email['body_preview']
            print(f"Preview: {preview}")
            print("-" * 100)


def main():
    """Main application loop"""
    reader = OutlookEmailReader()

    if not reader.access_token:
        print("Failed to authenticate with Outlook. Exiting.")
        sys.exit(1)

    while True:
        print("\n" + "=" * 50)
        print("Outlook Email Reader")
        print("=" * 50)
        print("1. View recent emails (last 10)")
        print("2. View unread emails")
        print("3. View emails from last 7 days")
        print("4. Search emails")
        print("5. Exit")
        print("=" * 50)

        choice = input("Enter your choice (1-5): ").strip()

        if choice == "1":
            emails = reader.get_inbox_emails(limit=10)
            reader.display_emails(emails)

        elif choice == "2":
            emails = reader.get_unread_emails()
            reader.display_emails(emails)
            print(f"\nTotal unread emails: {len(emails)}")

        elif choice == "3":
            emails = reader.get_emails_from_date(days_back=7)
            reader.display_emails(emails)
            print(f"\nTotal emails from last 7 days: {len(emails)}")

        elif choice == "4":
            query = input("Enter search query (subject or sender): ").strip()
            if query:
                emails = reader.search_emails(query)
                reader.display_emails(emails)
                print(f"\nTotal search results: {len(emails)}")
            else:
                print("Empty search query.")

        elif choice == "5":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()
