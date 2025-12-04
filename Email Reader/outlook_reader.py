"""
Outlook Email Reader with Device Code Flow OAuth2
Works with any corporate account without needing app registration.
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

# Microsoft endpoints
GRAPH_API_ENDPOINT = "https://graph.microsoft.com/v1.0"
DEVICE_CODE_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode"
TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

# Use a public client (no secret needed)
CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"  # Azure CLI client ID (public)
SCOPES = ["https://graph.microsoft.com/.default", "offline_access"]


class OutlookEmailReader:
    """Class to handle reading emails from Outlook using Microsoft Graph API"""

    def __init__(self):
        """Initialize the Outlook email reader"""
        self.access_token = None
        self.headers = None
        self.email = None
        self.connect()

    def connect(self):
        """Connect to Outlook account using device code flow"""
        try:
            print("\n" + "="*70)
            print("Outlook Email Reader - OAuth2 Authentication (Device Code Flow)")
            print("="*70)
            
            email = os.getenv("OUTLOOK_EMAIL") or input(
                "\nEnter your email address: "
            )
            self.email = email
            
            # Try to load cached token first
            token_file = ".token_cache.json"
            if os.path.exists(token_file):
                print("\nFound cached authentication token, attempting to use it...")
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
                        print("✓ Successfully authenticated using cached token")
                        return True
                    else:
                        print("Cached token expired, requesting new authentication...")
                except Exception as e:
                    print(f"Cache error: {e}, requesting new authentication...")
            
            print("\nStarting device code authentication flow...")
            
            if self._authenticate_with_device_code():
                print("\n✓ Successfully connected to Outlook!")
                return True
            else:
                print("\n✗ Authentication failed")
                return False

        except Exception as e:
            print(f"Error during authentication: {e}")
            return False

    def _authenticate_with_device_code(self):
        """Authenticate using device code flow"""
        try:
            # Step 1: Get device code
            print("\nRequesting device code from Microsoft...")
            device_code_payload = {
                "client_id": CLIENT_ID,
                "scope": " ".join(SCOPES),
            }
            
            response = requests.post(DEVICE_CODE_ENDPOINT, data=device_code_payload)
            response.raise_for_status()
            device_code_data = response.json()
            
            device_code = device_code_data["device_code"]
            user_code = device_code_data["user_code"]
            verification_uri = device_code_data["verification_uri"]
            expires_in = device_code_data.get("expires_in", 900)
            interval = device_code_data.get("interval", 5)
            
            # Step 2: Display instructions
            print("\n" + "="*70)
            print("📱 PLEASE DO THIS:")
            print("="*70)
            print(f"\n1. Visit this URL: {verification_uri}")
            print(f"2. Enter this code: {user_code}")
            print(f"\n3. Sign in with your corporate account ({self.email})")
            print("4. Approve the permissions")
            print("\n" + "="*70)
            print("Waiting for authentication (this window will wait)...\n")
            
            # Step 3: Poll for token
            token_payload = {
                "client_id": CLIENT_ID,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "scope": " ".join(SCOPES),
            }
            
            start_time = time.time()
            max_wait = expires_in
            poll_count = 0
            
            while time.time() - start_time < max_wait:
                try:
                    token_response = requests.post(TOKEN_ENDPOINT, data=token_payload)
                    
                    if token_response.status_code == 200:
                        token_data = token_response.json()
                        self.access_token = token_data.get("access_token")
                        self.headers = {
                            "Authorization": f"Bearer {self.access_token}",
                            "Content-Type": "application/json",
                        }
                        
                        # Cache the token
                        try:
                            with open(".token_cache.json", "w") as f:
                                json.dump(token_data, f)
                        except Exception:
                            pass
                        
                        print("✓ Authentication successful!")
                        return True
                    
                    elif token_response.status_code == 400:
                        error = token_response.json().get("error", "")
                        if error == "authorization_pending":
                            # Still waiting for user to authenticate
                            poll_count += 1
                            elapsed = int(time.time() - start_time)
                            if poll_count % 3 == 0:  # Print every 3rd poll
                                print(f"Still waiting... ({elapsed}s elapsed)")
                        elif error == "expired_token":
                            print("Device code expired. Please try again.")
                            return False
                        else:
                            print(f"Authentication error: {error}")
                            return False
                    else:
                        print(f"Token error: {token_response.status_code}")
                        print(token_response.text)
                        return False
                
                except requests.exceptions.RequestException as e:
                    print(f"Network error: {e}")
                    return False
                
                time.sleep(interval)
            
            print("Authentication timeout. Device code expired.")
            return False
            
        except Exception as e:
            print(f"Device code authentication error: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _test_connection(self):
        """Test if the access token is valid"""
        try:
            response = requests.get(
                f"{GRAPH_API_ENDPOINT}/me",
                headers=self.headers,
                timeout=5,
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
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
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
                except Exception:
                    continue
            
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
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
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
                except Exception:
                    continue
            
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
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
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
                except Exception:
                    continue
            
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
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
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
                except Exception:
                    continue
            
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
