"""
Outlook Email Reader - Local Web Interface
Simple web-based app to read Outlook emails without complex OAuth2.
Access via browser at http://localhost:5000
"""

import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
from flask import Flask, render_template_string, jsonify, request as flask_request

# Load environment variables
load_dotenv()

# Microsoft Graph API
GRAPH_API_ENDPOINT = "https://graph.microsoft.com/v1.0"

app = Flask(__name__)
email_reader = None


class OutlookEmailReader:
    """Simple email reader using hardcoded or environment token"""

    def __init__(self, token=None):
        """Initialize with access token"""
        self.access_token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        } if token else None

    def set_token(self, token):
        """Set access token"""
        self.access_token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def test_connection(self):
        """Test if token is valid"""
        if not self.access_token:
            return False
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
        """Get recent emails"""
        try:
            if not self.access_token:
                return {"error": "Not authenticated"}

            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$top={limit}&$orderby=receivedDateTime desc"
            )
            
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 401:
                return {"error": "Token expired or invalid"}
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
                    email_data = {
                        "from": item["from"]["emailAddress"]["address"],
                        "from_name": item["from"]["emailAddress"]["name"],
                        "subject": item.get("subject", "[No Subject]"),
                        "date": item["receivedDateTime"],
                        "body_preview": item.get("bodyPreview", ""),
                        "is_read": item.get("isRead", False),
                        "has_attachments": item.get("hasAttachments", False),
                    }
                    emails.append(email_data)
                except Exception:
                    continue
            
            return emails

        except Exception as e:
            return {"error": str(e)}

    def get_unread_emails(self):
        """Get unread emails"""
        try:
            if not self.access_token:
                return {"error": "Not authenticated"}

            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$filter=isRead eq false&$orderby=receivedDateTime desc&$top=50"
            )
            
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 401:
                return {"error": "Token expired or invalid"}
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
                    email_data = {
                        "from": item["from"]["emailAddress"]["address"],
                        "from_name": item["from"]["emailAddress"]["name"],
                        "subject": item.get("subject", "[No Subject]"),
                        "date": item["receivedDateTime"],
                        "body_preview": item.get("bodyPreview", ""),
                        "is_read": item.get("isRead", False),
                        "has_attachments": item.get("hasAttachments", False),
                    }
                    emails.append(email_data)
                except Exception:
                    continue
            
            return emails

        except Exception as e:
            return {"error": str(e)}

    def search_emails(self, query):
        """Search emails"""
        try:
            if not self.access_token:
                return {"error": "Not authenticated"}

            url = (
                f"{GRAPH_API_ENDPOINT}/me/mailFolders/inbox/messages"
                f"?$search=\"subject:{query}\"&$top=20"
            )
            
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 401:
                return {"error": "Token expired or invalid"}
            response.raise_for_status()
            data = response.json()
            
            emails = []
            for item in data.get("value", []):
                try:
                    email_data = {
                        "from": item["from"]["emailAddress"]["address"],
                        "from_name": item["from"]["emailAddress"]["name"],
                        "subject": item.get("subject", "[No Subject]"),
                        "date": item["receivedDateTime"],
                        "body_preview": item.get("bodyPreview", ""),
                        "is_read": item.get("isRead", False),
                        "has_attachments": item.get("hasAttachments", False),
                    }
                    emails.append(email_data)
                except Exception:
                    continue
            
            return emails

        except Exception as e:
            return {"error": str(e)}


# HTML Template
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Outlook Email Reader</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Segoe UI, Arial, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #0078d4; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { margin-bottom: 10px; }
        .auth-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .form-group button { background: #0078d4; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .form-group button:hover { background: #005a9e; }
        .menu { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .menu button { background: white; border: 1px solid #ddd; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        .menu button:hover { background: #f0f0f0; }
        .menu button.active { background: #0078d4; color: white; border-color: #0078d4; }
        .email-list { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .email-item { border-bottom: 1px solid #eee; padding: 15px; cursor: pointer; transition: background 0.2s; }
        .email-item:hover { background: #f9f9f9; }
        .email-from { font-weight: 500; color: #0078d4; }
        .email-subject { font-weight: 600; margin: 5px 0; }
        .email-preview { color: #666; font-size: 13px; margin: 5px 0; }
        .email-date { color: #999; font-size: 12px; }
        .email-meta { display: flex; gap: 10px; align-items: center; margin-top: 5px; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; }
        .unread { background: #d0e6ff; color: #0078d4; }
        .attachment { background: #f0f0f0; color: #333; }
        .error { background: #fee; color: #c33; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .success { background: #efe; color: #3c3; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .loading { text-align: center; padding: 20px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Outlook Email Reader</h1>
            <p id="user-info">Not authenticated</p>
        </div>

        <div class="auth-section">
            <div class="form-group">
                <label for="token">Access Token (from Microsoft Graph API):</label>
                <textarea id="token" style="width: 100%; height: 100px; font-family: monospace; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                <small>Paste your Microsoft Graph access token here. Learn more at: https://developer.microsoft.com/en-us/graph/graph-explorer</small>
            </div>
            <button onclick="setToken()" style="background: #107c10; padding: 12px 20px; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                ✓ Authenticate
            </button>
            <p style="margin-top: 10px; color: #666; font-size: 13px;">
                Need a token? Visit <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank">Graph Explorer</a>
            </p>
        </div>

        <div class="menu">
            <button onclick="loadInbox()" class="active">📥 Recent Emails</button>
            <button onclick="loadUnread()">✉️ Unread</button>
            <button onclick="loadSearch()">🔍 Search</button>
        </div>

        <div id="search-section" style="display: none; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px;">
                <input type="text" id="search-query" placeholder="Search emails..." style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="performSearch()" style="background: #0078d4; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Search</button>
            </div>
        </div>

        <div id="content">
            <div class="loading">Click "Recent Emails" to load your inbox</div>
        </div>
    </div>

    <script>
        function setToken() {
            const token = document.getElementById('token').value.trim();
            if (!token) {
                alert('Please paste your access token');
                return;
            }
            fetch('/api/set-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    document.getElementById('user-info').textContent = '✓ Authenticated';
                    loadInbox();
                } else {
                    alert('Invalid token: ' + data.error);
                }
            });
        }

        function loadInbox() {
            document.getElementById('search-section').style.display = 'none';
            document.getElementById('content').innerHTML = '<div class="loading">Loading emails...</div>';
            fetch('/api/inbox').then(r => r.json()).then(data => {
                if (data.error) {
                    document.getElementById('content').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                } else {
                    displayEmails(data);
                }
            });
        }

        function loadUnread() {
            document.getElementById('search-section').style.display = 'none';
            document.getElementById('content').innerHTML = '<div class="loading">Loading unread emails...</div>';
            fetch('/api/unread').then(r => r.json()).then(data => {
                if (data.error) {
                    document.getElementById('content').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                } else {
                    displayEmails(data);
                }
            });
        }

        function loadSearch() {
            document.getElementById('search-section').style.display = 'block';
            document.getElementById('content').innerHTML = '<div class="loading">Enter a search query</div>';
        }

        function performSearch() {
            const query = document.getElementById('search-query').value.trim();
            if (!query) {
                alert('Please enter a search query');
                return;
            }
            document.getElementById('content').innerHTML = '<div class="loading">Searching...</div>';
            fetch('/api/search?q=' + encodeURIComponent(query)).then(r => r.json()).then(data => {
                if (data.error) {
                    document.getElementById('content').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                } else {
                    displayEmails(data);
                }
            });
        }

        function displayEmails(emails) {
            if (!Array.isArray(emails) || emails.length === 0) {
                document.getElementById('content').innerHTML = '<div class="error">No emails found</div>';
                return;
            }
            
            let html = '<div class="email-list">';
            emails.forEach(email => {
                const date = new Date(email.date).toLocaleDateString() + ' ' + new Date(email.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                const preview = (email.body_preview || '').substring(0, 100);
                html += `
                    <div class="email-item">
                        <div class="email-from">${escapeHtml(email.from_name)} &lt;${escapeHtml(email.from)}&gt;</div>
                        <div class="email-subject">${escapeHtml(email.subject)}</div>
                        <div class="email-preview">${escapeHtml(preview)}</div>
                        <div class="email-meta">
                            <span class="email-date">${date}</span>
                            ${email.is_read ? '' : '<span class="badge unread">Unread</span>'}
                            ${email.has_attachments ? '<span class="badge attachment">📎 Attachments</span>' : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            document.getElementById('content').innerHTML = html;
        }

        function escapeHtml(text) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    </script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route("/api/set-token", methods=["POST"])
def set_token():
    data = flask_request.json
    token = data.get("token", "").strip()
    
    if not token:
        return jsonify({"success": False, "error": "Token is empty"})
    
    email_reader.set_token(token)
    
    if email_reader.test_connection():
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Invalid token or no internet connection"})


@app.route("/api/inbox")
def inbox():
    if not email_reader.access_token:
        return jsonify({"error": "Not authenticated. Please set your access token."})
    result = email_reader.get_inbox_emails(limit=20)
    if isinstance(result, dict) and "error" in result:
        return jsonify(result)
    return jsonify(result)


@app.route("/api/unread")
def unread():
    if not email_reader.access_token:
        return jsonify({"error": "Not authenticated. Please set your access token."})
    result = email_reader.get_unread_emails()
    if isinstance(result, dict) and "error" in result:
        return jsonify(result)
    return jsonify(result)


@app.route("/api/search")
def search():
    if not email_reader.access_token:
        return jsonify({"error": "Not authenticated. Please set your access token."})
    query = flask_request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Search query is empty"})
    result = email_reader.search_emails(query)
    if isinstance(result, dict) and "error" in result:
        return jsonify(result)
    return jsonify(result)


def main():
    global email_reader
    email_reader = OutlookEmailReader()
    
    print("\n" + "="*70)
    print("Outlook Email Reader - Web Interface")
    print("="*70)
    print("\n🌐 Opening web interface at: http://localhost:5000")
    print("\nInstructions:")
    print("1. Visit https://developer.microsoft.com/en-us/graph/graph-explorer")
    print("2. Sign in with your corporate account")
    print("3. Grant permissions for Mail.Read")
    print("4. Copy the access token from Graph Explorer")
    print("5. Paste it in the web interface above")
    print("\nPress Ctrl+C to stop the server\n")
    
    import webbrowser
    webbrowser.open("http://localhost:5000")
    
    app.run(debug=False, host="localhost", port=5000)


if __name__ == "__main__":
    main()
